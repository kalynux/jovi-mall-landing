"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { AccountShell } from "@/components/shop/account/AccountShell";
import { Button, Icon, type IconName } from "@/components/shop/ds";
import { useAuth } from "@/lib/auth/useAuth";
import { ApiError } from "@/lib/auth/auth.types";
import { translateError } from "@/lib/auth/error-translator";
import {
  ACCOUNT_CLOSURE_CONFIRMATION,
  closeAccount,
} from "@/lib/shop/account-closure.api";

/**
 * Close account — the in-app path both app stores require.
 *
 * A screen rather than a dialog, deliberately. `ConfirmDialog` is the right
 * surface for "empty this cart"; this one has to carry a disclosure the shopper
 * can read at their own pace, and a typed confirmation that a sheet would crowd.
 * It is also what a store reviewer is sent to, and a reachable URL is easier to
 * hand over than a tap path.
 *
 * ── The wording is load-bearing ──────────────────────────────────────────────
 *
 * The backend anonymises and retains (ADR-A02 D-1) and forbids calling that a
 * deletion (D-2). The bullets below are the same promise the endpoint returns in
 * its own success message, split so each clause is separately readable — what
 * goes, what stays, and why it stays. Saying "your data will be deleted" here
 * would be the one thing the design refuses to do, and would be a false promise
 * to a store reviewer as much as to a shopper.
 *
 * ⚠ That constraint is per-language, not just English. Every one of fr/es/pt/ar
 * has a strong everyday verb for "delete" — supprimer, eliminar, apagar, حذف —
 * and `shop.close.*` deliberately uses none of them: it says close (fermer /
 * cerrar / fechar / إغلاق), removed-from-your-profile and kept-as-records. A
 * translation that reaches for the obvious verb re-breaks D-2 silently, in a
 * language the reviewer of this file may not read.
 */

/**
 * What closing does, in the order someone worries about it.
 *
 * Keys, not sentences: this array is module-level, evaluated once at import
 * time, where there is no render and so no `useTranslations`. The component
 * resolves them (LOCALISATION.md § 3).
 */
const CONSEQUENCES: { icon: IconName; textKey: string }[] = [
  { icon: "user-x", textKey: "consequences.profile" },
  { icon: "package", textKey: "consequences.orders" },
  { icon: "log-out", textKey: "consequences.sessions" },
  { icon: "download", textKey: "consequences.downloads" },
];

/** A refusal, and where the person can go to do something about it. */
interface Refusal {
  text: string;
  next?: { href: string; labelKey: "refused.seeOrders" | "refused.contactSupport" };
}

export default function CloseAccountPage() {
  const t = useTranslations("shop.close");
  const tError = useTranslations("errors");
  // The screen title is route vocabulary and already lives in `shop.nav`.
  const tKey = useTranslations();
  const tAuthMe = useTranslations("authMe");
  const format = useFormatter();
  const router = useRouter();
  const { logout } = useAuth();

  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Refusal | null>(null);

  /**
   * The three refusals the contract asks a client to explain in its own words
   * (api-doc/me/account-closure.md). Both 422s carry the fact that makes the
   * sentence useful — how many orders, which roles — and a way onward, so they
   * never collapse into "cannot close account". Anything else takes the shared
   * error ladder.
   */
  function refusalOf(err: unknown): Refusal {
    if (err instanceof ApiError) {
      if (err.code === "ACCOUNT_CLOSURE_ORDERS_IN_FLIGHT") {
        const count = err.details?.activeOrderCount;
        return {
          text:
            typeof count === "number"
              ? t("refused.ordersInFlight", { count })
              : t("ordersInFlight"),
          next: { href: "/shop/account/orders", labelKey: "refused.seeOrders" },
        };
      }

      if (err.code === "ACCOUNT_CLOSURE_ROLE_NOT_ELIGIBLE") {
        // A vendor, agency or agent role hangs a shop, stock or a COD balance
        // off this identity. There is no self-service way to close one yet, so
        // the way onward is support.
        const blocking = err.details?.blockingRoles;
        const names = tAuthMe.raw("roleNames") as Record<string, string>;
        const roles = Array.isArray(blocking)
          ? blocking.filter((r): r is string => typeof r === "string").map((r) => names[r] ?? r)
          : [];
        if (roles.length > 0) {
          return {
            text: t("refused.roleNotEligible", { roles: format.list(roles) }),
            next: { href: "/shop/account/support/new", labelKey: "refused.contactSupport" },
          };
        }
      }

      // The account is not `active` — in practice a second request that lost
      // the race to the first. Retrying can only fail again.
      if (err.code === "USER_STATUS_CONFLICT") return { text: t("refused.alreadyClosed") };
    }
    return { text: translateError(tError, err) };
  }

  // Compared against the constant rather than matched loosely: the backend
  // takes it as a `z.literal`, so a lowercase attempt is a round trip that can
  // only fail. Disabling until it matches keeps that failure off the wire.
  const confirmed = typed.trim() === ACCOUNT_CLOSURE_CONFIRMATION;

  async function submit() {
    if (!confirmed || busy) return;

    setBusy(true);
    setError(null);

    try {
      await closeAccount(typed.trim());

      /**
       * Every token minted before the closure is now refused, so the session
       * has to end here. `logout()` discards the stored pair *before* it calls
       * the endpoint, which is what makes this safe: the logout request itself
       * will 403 on a closed account, and that is caught and ignored.
       *
       * It then leaves through `/` — the locale bootstrap — rather than
       * `/shop`, which is a path the native export never writes.
       */
      await logout();
    } catch (err) {
      setError(refusalOf(err));
      // Deliberately not cleared on success: the page is navigating away, and
      // re-enabling the button would offer a second attempt at a closed account.
      setBusy(false);
    }
  }

  return (
    <AccountShell
      title={tKey("shop.nav.titles.close")}
      description={t("description")}
    >
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
          <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-strong)", margin: 0 }}>
            {t("warning")}
          </p>
        </div>

        <ul style={{ listStyle: "none", margin: 0, padding: 14, display: "grid", gap: 13 }}>
          {CONSEQUENCES.map((c) => (
            <li key={c.icon} style={{ display: "flex", gap: 11, alignItems: "flex-start" }}>
              <Icon
                name={c.icon}
                size={17}
                style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 1 }}
              />
              <span style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--text-body)" }}>
                {t(c.textKey)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div style={{ marginTop: 22 }}>
        <label
          htmlFor="closure-confirm"
          style={{
            display: "block",
            fontSize: 13.5,
            fontWeight: 700,
            color: "var(--text-strong)",
            marginBottom: 7,
          }}
        >
          {/*
            The phrase is a WIRE VALUE — the backend takes it as a `z.literal`,
            so it is the same eleven English characters in all five locales. It
            is injected as a value rather than written into the catalogues,
            where a translator would quite reasonably have translated it and
            made the request impossible to validate. `dir="ltr"` stops Arabic
            from reordering it inside the surrounding RTL sentence.
          */}
          {t.rich("typeToConfirm", {
            phrase: ACCOUNT_CLOSURE_CONFIRMATION,
            code: (chunks) => (
              <span dir="ltr" style={{ fontFamily: "var(--font-mono, monospace)" }}>
                {chunks}
              </span>
            ),
          })}
        </label>

        <input
          id="closure-confirm"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          disabled={busy}
          // What is typed here is the English literal, in every locale.
          dir="ltr"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          aria-describedby={error ? "closure-error" : undefined}
          placeholder={ACCOUNT_CLOSURE_CONFIRMATION}
          style={{
            width: "100%",
            height: 46,
            padding: "0 13px",
            borderRadius: "var(--radius-md)",
            border: `1px solid ${confirmed ? "var(--danger)" : "var(--border)"}`,
            background: "var(--surface)",
            color: "var(--text-strong)",
            fontSize: 15,
            letterSpacing: 0.3,
          }}
        />

        {error && (
          <p
            id="closure-error"
            role="alert"
            style={{ color: "var(--danger)", fontSize: 13, marginTop: 9, lineHeight: 1.45 }}
          >
            {error.text}
          </p>
        )}
        {error?.next && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push(error.next!.href)}
            style={{ marginTop: 8 }}
          >
            {t(error.next.labelKey)}
          </Button>
        )}

        <Button
          variant="danger"
          size="lg"
          block
          disabled={!confirmed || busy}
          onClick={() => void submit()}
          style={{ marginTop: 14 }}
        >
          {busy ? t("closing") : t("submit")}
        </Button>

        <p className="muted" style={{ fontSize: 12.5, textAlign: "center", marginTop: 12 }}>
          {t("ordersInFlight")}
        </p>
      </div>
    </AccountShell>
  );
}
