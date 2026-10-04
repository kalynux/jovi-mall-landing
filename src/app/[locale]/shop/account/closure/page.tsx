"use client";

import { useState, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { localePath } from "@/i18n/routing";
import { useLocale } from "@/lib/i18n-provider";
import {
  AccountShell,
  AccountSkeleton,
  ResourceError,
} from "@/components/shop/account/AccountShell";
import { Button, EmptyState, Icon, type IconName } from "@/components/shop/ds";
import { useAuth } from "@/lib/auth/useAuth";
import { ApiError } from "@/lib/auth/auth.types";
import { translateError } from "@/lib/auth/error-translator";
import { useApiResource } from "@/lib/shop/useApiResource";
import { formatMoney } from "@/lib/shop/format";
import { ACCOUNT_CLOSED_PATH, BOOKING_LIST } from "@/lib/shop/shop.routes";
import {
  confirmClosureRequest,
  declineClosureRequest,
  DECLINE_NOTE_MAX,
  getClosureRequest,
  ROLE_CLOSURE_CONFIRMATION,
  type ClosureBlocker,
  type ClosureRequest,
  type ClosureWarning,
} from "@/lib/shop/closure-request.api";

/**
 * Answering an administrator's request to close the shopping account —
 * ADR-A10, api-doc/me/role-closure.md.
 *
 * ⚠ **This URL is frozen into a WhatsApp template** (`customer_account_closure_requested`)
 * the day Meta approves it, and the in-app notification and push point here too
 * (`notification-routing.ts`). It must not move.
 *
 * ── Two answers, one of them irreversible ────────────────────────────────────
 *
 * Nothing has happened yet when someone arrives: the administrator only asked.
 * So the page leads with that — nothing changes unless you confirm, and the
 * request lapses on its own — before it shows either button. Confirming sits
 * behind the same typed phrase as `/shop/account/close`, because it runs the
 * same anonymise-and-retain closure. Declining is one tap with an optional note.
 *
 * The wording rule from `close/page.tsx` applies here in all five languages:
 * close, removed, kept — never delete (ADR-A02 D-2). `shop.closureRequest.*`
 * was checked for supprimer / eliminar / apagar / حذف when it was written.
 *
 * ── The administrator's reason is shown as written ───────────────────────────
 *
 * It is free text in whatever language they wrote it, so it is not translated,
 * and `dir="auto"` lets an English reason sit correctly inside the Arabic page.
 */

/** What confirming does, in the order someone worries about it. */
const CONSEQUENCES: { icon: IconName; textKey: string }[] = [
  { icon: "user-x", textKey: "consequences.profile" },
  { icon: "package", textKey: "consequences.orders" },
  { icon: "log-out", textKey: "consequences.signOut" },
  { icon: "lock", textKey: "consequences.final" },
];

/** Where each customer blocker can be settled. Unknown codes get no link. */
const BLOCKER_LINKS: Record<string, { href: string; labelKey: string }> = {
  orders_in_flight: { href: "/shop/account/orders", labelKey: "blockers.seeOrders" },
  bookings_upcoming: { href: BOOKING_LIST, labelKey: "blockers.seeBookings" },
};

const BLOCKER_ICONS: Record<string, IconName> = {
  orders_in_flight: "truck",
  bookings_upcoming: "calendar-clock",
};

/** `details.blockers` off a 422, validated rather than cast. */
function blockersOf(err: ApiError): ClosureBlocker[] | null {
  const raw = err.details?.blockers;
  if (!Array.isArray(raw)) return null;
  return raw.filter(
    (b): b is ClosureBlocker =>
      typeof b === "object" && b !== null && typeof (b as ClosureBlocker).code === "string",
  );
}

export default function ClosureRequestPage() {
  const t = useTranslations("shop.closureRequest");
  const tError = useTranslations("errors");
  const tKey = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const { locale } = useLocale();
  const { logout } = useAuth();

  const resource = useApiResource<ClosureRequest | null>(() => getClosureRequest());

  const [typed, setTyped] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"confirm" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Answered here: declined, or gone between the read and the write. */
  const [settled, setSettled] = useState<"kept" | "gone" | null>(null);

  const title = tKey("shop.nav.titles.closure");
  const back = (
    <Button variant="secondary" onClick={() => router.push("/shop/account")}>
      {t("backToAccount")}
    </Button>
  );

  const dateOf = (iso: string) =>
    format.dateTime(new Date(iso), { dateStyle: "long", timeStyle: "short" });

  /** A refusal that means "this request is not open any more" — never retried. */
  function isGone(err: unknown): boolean {
    return (
      err instanceof ApiError &&
      (err.code === "ROLE_CLOSURE_REQUEST_EXPIRED" || err.code === "ROLE_CLOSURE_REQUEST_NOT_FOUND")
    );
  }

  async function confirm(request: ClosureRequest) {
    if (busy || !request.canConfirm || typed.trim() !== ROLE_CLOSURE_CONFIRMATION) return;
    setBusy("confirm");
    setError(null);

    try {
      const answered = await confirmClosureRequest();

      /**
       * The server has cleared the cookies; `logout` drops the rest (a bearer
       * pair, push registration, provider state) and navigates.
       *
       * `accountClosed: false` — the person still holds a business role, so
       * they go to sign in to it. `true` — nothing is left to sign in to, so
       * they get the page that says so. A missing outcome is not expected; the
       * closed page without `?all` is the answer that is true either way.
       */
      const outcome = answered.outcome;
      if (outcome?.accountClosed === false) {
        await logout(localePath(locale, "/login"));
      } else {
        const closed = localePath(locale, ACCOUNT_CLOSED_PATH);
        await logout(outcome?.accountClosed ? `${closed}?all=1` : closed);
      }
      // Deliberately leaves `busy` set: the page is navigating away, and a
      // second press would be a confirm against an account that is closed.
    } catch (err) {
      setBusy(null);
      if (isGone(err)) {
        setSettled("gone");
        return;
      }
      if (err instanceof ApiError && err.code === "ROLE_CLOSURE_BLOCKED") {
        // Something became live between the read and the confirm. Show what,
        // from the refusal itself, and take the button away.
        const blockers = blockersOf(err);
        if (blockers) resource.set({ ...request, blockers, canConfirm: false });
      }
      setError(translateError(tError, err));
    }
  }

  async function decline() {
    if (busy) return;
    setBusy("decline");
    setError(null);
    try {
      await declineClosureRequest(note);
      setSettled("kept");
    } catch (err) {
      if (isGone(err)) setSettled("gone");
      else setError(translateError(tError, err));
    } finally {
      setBusy(null);
    }
  }

  let body: ReactNode;
  if (settled === "kept") {
    body = <Outcome icon="circle-check-big" title={t("kept.title")} description={t("kept.description")} action={back} />;
  } else if (settled === "gone") {
    body = <Outcome icon="hourglass" title={t("gone.title")} description={t("gone.description")} action={back} />;
  } else if (resource.status === "loading") {
    body = <AccountSkeleton />;
  } else if (resource.status === "error") {
    body = <ResourceError error={resource.error} onRetry={resource.reload} fallback={tError("UNKNOWN_ERROR")} />;
  } else if (!resource.data) {
    body = <Outcome icon="shield-check" title={t("empty.title")} description={t("empty.description")} action={back} />;
  } else if (resource.data.status !== "pending") {
    body = <Outcome icon="hourglass" title={t("gone.title")} description={t("gone.description")} action={back} />;
  } else {
    const request = resource.data;
    const blockers = request.blockers ?? [];
    const typedOk = typed.trim() === ROLE_CLOSURE_CONFIRMATION;

    body = (
      <>
        {/* What has happened — and what has not. */}
        <div
          style={{
            border: "1px solid var(--danger-border)",
            borderRadius: "var(--radius-lg)",
            background: "var(--surface)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: 12,
              padding: 14,
              background: "var(--danger-bg)",
              borderBottom: "1px solid var(--danger-border)",
            }}
          >
            <Icon name="triangle-alert" size={20} style={{ color: "var(--danger)", flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
                {t("headline")}
              </p>
              <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--text-body)", margin: "4px 0 0" }}>
                {t("nothingChanges", { date: dateOf(request.expiresAt) })}
              </p>
            </div>
          </div>

          <div style={{ padding: 14 }}>
            <SectionLabel>{t("reasonLabel")}</SectionLabel>
            <blockquote
              dir="auto"
              style={{
                margin: 0,
                padding: "10px 12px",
                borderInlineStart: "3px solid var(--border)",
                background: "var(--surface-2)",
                borderRadius: "var(--radius-md)",
                fontSize: 14,
                lineHeight: 1.5,
                color: "var(--text-strong)",
                whiteSpace: "pre-wrap",
                overflowWrap: "anywhere",
              }}
            >
              {request.reason}
            </blockquote>
          </div>
        </div>

        {blockers.length > 0 && (
          <section style={{ marginTop: 18 }} aria-labelledby="closure-blockers">
            <h2 id="closure-blockers" style={HEADING}>
              {t("blockersTitle")}
            </h2>
            <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
              {t("blockersIntro")}
            </p>
            <ul style={{ ...CARD_LIST, borderColor: "var(--warning-border, var(--border))" }}>
              {blockers.map((b, i) => {
                const link = BLOCKER_LINKS[b.code];
                return (
                  <li key={`${b.code}-${i}`} style={ROW}>
                    <Icon
                      name={BLOCKER_ICONS[b.code] ?? "circle-alert"}
                      size={17}
                      style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 1 }}
                    />
                    <div style={{ flex: 1 }}>
                      <span style={ROW_TEXT}>
                        {link ? t(`blockers.${b.code}`, { count: b.count }) : t("blockers.other")}
                      </span>
                      {link && (
                        <Link
                          href={link.href}
                          style={{
                            display: "inline-block",
                            marginTop: 4,
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--brand)",
                          }}
                        >
                          {t(link.labelKey)}
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section style={{ marginTop: 18 }} aria-labelledby="closure-consequences">
          <h2 id="closure-consequences" style={HEADING}>
            {t("consequencesTitle")}
          </h2>
          <ul style={CARD_LIST}>
            {CONSEQUENCES.map((c) => (
              <li key={c.textKey} style={ROW}>
                <Icon name={c.icon} size={17} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 1 }} />
                <span style={ROW_TEXT}>{t(c.textKey)}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* What confirming forfeits — before the button, never blocking. A
            customer has no plan or credit today; rendered anyway, because the
            payload can carry them and the contract says to show them. */}
        {request.warnings.length > 0 && (
          <section style={{ marginTop: 18 }} aria-labelledby="closure-warnings">
            <h2 id="closure-warnings" style={HEADING}>
              {t("warningsTitle")}
            </h2>
            <ul style={CARD_LIST}>
              {request.warnings.map((w, i) => (
                <li key={`${w.code}-${i}`} style={ROW}>
                  <Icon name="coins" size={17} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 1 }} />
                  <span style={ROW_TEXT}>{warningText(w)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Confirm — the deliberate step. */}
        <section style={{ marginTop: 22 }}>
          <label
            htmlFor="closure-request-confirm"
            style={{ display: "block", fontSize: 13.5, fontWeight: 700, color: "var(--text-strong)", marginBottom: 7 }}
          >
            {/* The phrase is a wire value, the same English in every locale —
                see the matching note in `close/page.tsx`. */}
            {t.rich("typeToConfirm", {
              phrase: ROLE_CLOSURE_CONFIRMATION,
              code: (chunks) => (
                <span dir="ltr" style={{ fontFamily: "var(--font-mono, monospace)" }}>
                  {chunks}
                </span>
              ),
            })}
          </label>
          <input
            id="closure-request-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            disabled={busy !== null || !request.canConfirm}
            dir="ltr"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="characters"
            spellCheck={false}
            aria-describedby={error ? "closure-request-error" : undefined}
            placeholder={ROLE_CLOSURE_CONFIRMATION}
            style={{
              width: "100%",
              height: 46,
              padding: "0 13px",
              borderRadius: "var(--radius-md)",
              border: `1px solid ${typedOk ? "var(--danger)" : "var(--border)"}`,
              background: "var(--surface)",
              color: "var(--text-strong)",
              fontSize: 15,
              letterSpacing: 0.3,
            }}
          />

          {error && (
            <p
              id="closure-request-error"
              role="alert"
              style={{ color: "var(--danger)", fontSize: 13, marginTop: 9, lineHeight: 1.45 }}
            >
              {error}
            </p>
          )}

          <Button
            variant="danger"
            size="lg"
            block
            disabled={!request.canConfirm || !typedOk || busy !== null}
            onClick={() => void confirm(request)}
            style={{ marginTop: 14 }}
          >
            {busy === "confirm" ? t("confirming") : t("confirm")}
          </Button>
          {!request.canConfirm && (
            <p className="muted" style={{ fontSize: 12.5, textAlign: "center", marginTop: 10 }}>
              {t("blockedHint")}
            </p>
          )}
        </section>

        {/* Decline. */}
        <section
          style={{
            marginTop: 26,
            paddingTop: 18,
            borderTop: "1px solid var(--border-subtle)",
          }}
          aria-labelledby="closure-keep"
        >
          <h2 id="closure-keep" style={HEADING}>
            {t("keepTitle")}
          </h2>
          <p className="muted" style={{ fontSize: 13.5, margin: "0 0 10px", lineHeight: 1.5 }}>
            {t("keepBody")}
          </p>
          <label htmlFor="closure-request-note" style={{ display: "block", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            {t("noteLabel")}
          </label>
          <textarea
            id="closure-request-note"
            className="field"
            rows={3}
            dir="auto"
            maxLength={DECLINE_NOTE_MAX}
            placeholder={t("notePlaceholder")}
            value={note}
            disabled={busy !== null}
            onChange={(e) => setNote(e.target.value)}
            style={{ width: "100%" }}
          />
          <Button
            variant="secondary"
            size="lg"
            block
            disabled={busy !== null}
            onClick={() => void decline()}
            style={{ marginTop: 10 }}
          >
            {busy === "decline" ? t("keeping") : t("keep")}
          </Button>
        </section>
      </>
    );
  }

  function warningText(w: ClosureWarning): string {
    if (w.code === "prepaid_plan_forfeited") {
      const plan = w.planCode ?? "";
      return w.expiresAt
        ? t("warnings.planUntil", { plan, date: format.dateTime(new Date(w.expiresAt), { dateStyle: "long" }) })
        : t("warnings.plan", { plan });
    }
    if (w.code === "credit_balance_forfeited" && typeof w.amount === "number") {
      return t("warnings.credit", { amount: formatMoney(w.amount, "XAF") });
    }
    return t("warnings.other");
  }

  return (
    <AccountShell title={title} description={t("description")}>
      {body}
    </AccountShell>
  );
}

function Outcome({
  icon,
  title,
  description,
  action,
}: {
  icon: IconName;
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
      <EmptyState icon={icon} title={title} description={description} />
      {action}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      className="muted"
      style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 6 }}
    >
      {children}
    </div>
  );
}

const HEADING = {
  fontSize: 14.5,
  fontWeight: 800,
  color: "var(--text-strong)",
  margin: "0 0 8px",
} as const;

const CARD_LIST = {
  listStyle: "none",
  margin: 0,
  padding: 14,
  display: "grid",
  gap: 13,
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-lg)",
  background: "var(--surface)",
} as const;

const ROW = { display: "flex", gap: 11, alignItems: "flex-start" } as const;

const ROW_TEXT = { fontSize: 13.5, lineHeight: 1.5, color: "var(--text-body)" } as const;
