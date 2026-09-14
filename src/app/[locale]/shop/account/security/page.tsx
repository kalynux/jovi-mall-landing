"use client";

import { useCallback, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Badge, Button, Skeleton } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { useApiResource } from "@/lib/shop/useApiResource";
import { ApiError } from "@/lib/auth/auth.types";
import {
  cancelEmailChange,
  cancelPhoneChange,
  confirmPhoneChange,
  getContact,
  requestEmailChange,
  requestPhoneChange,
  type ContactState,
  type PendingContactChange,
} from "@/lib/me/contact.api";
import { changePassword, PASSWORD_RULES, passwordMeetsPolicy } from "@/lib/me/password.api";
import { IS_NATIVE_BUILD } from "@/lib/platform";

/**
 * Sign-in details: the email and phone the account is resolved by, and the
 * password.
 *
 * ── The identifier does not move until it is proved ──────────────────────────
 *
 * Every control here writes a **pending** change and nothing else. The current
 * email and phone keep signing the account in until a confirmation lands, which
 * is what makes a typo recoverable — the alternative, writing the new value and
 * flagging it unverified, locks the account out with the correction form behind
 * the sign-in.
 *
 * So the page always renders both: what you sign in with today, and what is
 * waiting to be proved.
 */
export default function SecurityPage() {
  const { status } = useAuthGuard();
  const tKey = useTranslations();

  // Keyed on `status` so the read runs once the guard has a session, and again
  // if that session is re-established.
  const resource = useApiResource<ContactState>(() => getContact(), [status]);
  const contact = resource.data;

  const reload = useCallback(async () => {
    resource.reload();
  }, [resource]);

  if (status === "loading" || !contact) {
    return (
      <div className="mx-auto max-w-[680px] px-4 py-6 sm:px-6">
        <Skeleton height={120} style={{ marginBottom: 12 }} />
        <Skeleton height={120} style={{ marginBottom: 12 }} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[680px] px-4 py-6 sm:px-6">
      <h1 className="sr-only">{tKey("shop.nav.titles.security")}</h1>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <EmailSection contact={contact} onChanged={reload} />
        <PhoneSection contact={contact} onChanged={reload} />
        <PasswordSection />
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 16,
      }}
    >
      <h2 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 800 }}>{title}</h2>
      {children}
    </section>
  );
}

/**
 * The pending-change disclosure: what is waiting, and until when.
 *
 * `note` arrives already translated AND already carrying its own expiry
 * clause. That is deliberate — the note and the deadline are one continuous
 * piece of prose, and rendering them as `{note} Expires {date}.` would build a
 * sentence out of parts, which is the one thing no catalogue can fix from the
 * outside (LOCALISATION.md § 4). So the caller owns the whole sentence and this
 * component owns only the frame around it.
 */
function Pending({ change, note }: { change: PendingContactChange; note: string }) {
  const t = useTranslations("shop.security");

  return (
    <div style={{ marginTop: 8 }}>
      <Badge size="sm" tone="warning" icon="clock">
        {t("waitingOn", { target: change.target })}
      </Badge>
      <p className="muted" style={{ fontSize: 12.5, margin: "6px 0 0" }}>
        {note}
      </p>
    </div>
  );
}

/**
 * Maps the contract's error codes to instructions that differ from each other.
 *
 * Returns a KEY, not a sentence — module level, no render, no hook
 * (LOCALISATION.md § 3) — and is named `…Key` so that a call site which forgets
 * to resolve it is a compile error rather than a dotted path rendered at a
 * shopper. The codes double as the message names, but the list stays explicit:
 * a code that is not handled here has no key, and falling through to the shared
 * `somethingWentWrong` is much better than a `MISSING_MESSAGE` crash.
 *
 * The six sentences are deliberately distinct from one another — EXPIRED says
 * "start again" where TOKEN_INVALID says "check the link", because those are
 * different instructions to a person holding a stale email.
 *
 * The seventh case is not a CONTACT_CHANGE code at all. `MAIL_ALL_PROVIDERS_FAILED`
 * is the backend's 502 for "no configured mail provider accepted the message",
 * so the change was never opened and the only instruction is to try again. It
 * borrows the shared `errors.` sentence instead of getting one of this page's
 * own, because the identical failure reaches the verification send — one string
 * said one way beats two that drift apart.
 */
function contactMessageKey(err: unknown): string {
  const code = err instanceof ApiError ? err.code : undefined;
  switch (code) {
    case "CONTACT_CHANGE_SAME_IDENTIFIER":
    case "CONTACT_CHANGE_IDENTIFIER_TAKEN":
    case "CONTACT_CHANGE_NOT_PENDING":
    case "CONTACT_CHANGE_EXPIRED":
    case "CONTACT_CHANGE_TOKEN_INVALID":
    case "CONTACT_CHANGE_PHONE_UNPROVEN":
      return `shop.security.errors.${code}`;
    // Retryable, and deliberately not `somethingWentWrong`: the mail chain
    // failed, nothing about the account moved, and the button works.
    case "MAIL_ALL_PROVIDERS_FAILED":
      return `errors.${code}`;
    default:
      return "shop.common.somethingWentWrong";
  }
}

function EmailSection({
  contact,
  onChanged,
}: {
  contact: ContactState;
  onChanged: () => Promise<void>;
}) {
  const { flash } = useToast();
  const t = useTranslations("shop.security");
  const tCommon = useTranslations("shop.common");
  const tKey = useTranslations();
  const format = useFormatter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await requestEmailChange(value.trim());
      setValue("");
      await onChanged();
      flash(t("email.sent"));
    } catch (err) {
      flash(tKey(contactMessageKey(err)));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await cancelEmailChange();
      await onChanged();
    } catch (err) {
      flash(tKey(contactMessageKey(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={t("email.title")}>
      <p style={{ margin: 0, fontSize: 14 }}>
        {contact.email ?? <span className="muted">{t("email.none")}</span>}
      </p>

      {contact.pendingEmail ? (
        <>
          <Pending
            change={contact.pendingEmail}
            note={t("email.pendingNote", {
              date: format.dateTime(new Date(contact.pendingEmail.expiresAt), {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          />
          <div style={{ marginTop: 10 }}>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void cancel()}>
              {t("cancelChange")}
            </Button>
          </div>
        </>
      ) : (
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <input
            className="field"
            style={{ flex: "1 1 200px" }}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={t("email.placeholder")}
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button size="sm" disabled={!value.trim() || busy} onClick={() => void submit()}>
            {busy ? tCommon("sending") : tCommon("change")}
          </Button>
        </div>
      )}
    </Card>
  );
}

function PhoneSection({
  contact,
  onChanged,
}: {
  contact: ContactState;
  onChanged: () => Promise<void>;
}) {
  const router = useRouter();
  const { flash } = useToast();
  const t = useTranslations("shop.security");
  const tCommon = useTranslations("shop.common");
  const tKey = useTranslations();
  const format = useFormatter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [unproven, setUnproven] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await requestPhoneChange(value.trim());
      setValue("");
      await onChanged();
    } catch (err) {
      flash(tKey(contactMessageKey(err)));
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setUnproven(false);
    try {
      await confirmPhoneChange();
      await onChanged();
      flash(t("phone.confirmed"));
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      // The one refusal with somewhere to go: the fix is a WhatsApp connection,
      // so route there rather than repeating the error.
      if (code === "CONTACT_CHANGE_PHONE_UNPROVEN") setUnproven(true);
      else flash(tKey(contactMessageKey(err)));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await cancelPhoneChange();
      setUnproven(false);
      await onChanged();
    } catch (err) {
      flash(tKey(contactMessageKey(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={t("phone.title")}>
      <p style={{ margin: 0, fontSize: 14 }}>
        {contact.phone ?? <span className="muted">{t("phone.none")}</span>}
      </p>

      {contact.pendingPhone ? (
        <>
          <Pending
            change={contact.pendingPhone}
            note={t("phone.pendingNote", {
              date: format.dateTime(new Date(contact.pendingPhone.expiresAt), {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          />

          {unproven && (
            <p style={{ fontSize: 13, margin: "8px 0 0", color: "var(--danger)" }}>
              {t("phone.unproven")}
            </p>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <Button size="sm" disabled={busy} onClick={() => void confirm()}>
              {busy ? t("phone.checking") : tCommon("confirm")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              // Connections live on the notification settings screen, which is
              // where ChatChannels is mounted.
              onClick={() => router.push("/shop/account/notifications/settings")}
            >
              {t("phone.connectWhatsApp")}
            </Button>
            <Button variant="ghost" size="sm" disabled={busy} onClick={() => void cancel()}>
              {tCommon("cancel")}
            </Button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
            <input
              className="field"
              style={{ flex: "1 1 200px" }}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+237 6XX XXX XXX"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <Button size="sm" disabled={!value.trim() || busy} onClick={() => void submit()}>
              {busy ? tCommon("saving") : tCommon("change")}
            </Button>
          </div>
          {/* Said up front, because it is the part people do not expect: the
              proof is an inbound WhatsApp message, not a code we send. */}
          <p className="muted" style={{ fontSize: 12.5, margin: "8px 0 0" }}>
            {t("phone.howItWorks")}
          </p>
        </>
      )}
    </Card>
  );
}

function PasswordSection() {
  const { flash } = useToast();
  const t = useTranslations("shop.security");
  const tCommon = useTranslations("shop.common");
  const [open, setOpen] = useState(false);
  const [oldPassword, setOld] = useState("");
  const [newPassword, setNew] = useState("");
  const [busy, setBusy] = useState(false);

  const valid = oldPassword.length > 0 && passwordMeetsPolicy(newPassword);

  const submit = async () => {
    setBusy(true);
    try {
      await changePassword(oldPassword, newPassword);
      setOld("");
      setNew("");
      setOpen(false);
      flash(
        IS_NATIVE_BUILD
          ? t("password.changedSignInAgain")
          : t("password.changedOthersSignedOut"),
      );
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      flash(
        code === "AUTH_INVALID_CREDENTIALS"
          ? t("password.wrongCurrent")
          : t("password.failed"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title={t("password.title")}>
      {/* Most customers have never set one: an account is created by the bot with
          a system-generated password and signs in with a magic link or code.

          This card is therefore the SECONDARY thing on the screen, and the
          screen is "Sign-in details" — `shop.nav.titles.security` — in every
          locale. None of the five names this page after the password, because
          for most of the people who open it there is no password to change. */}
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>
        {t("password.intro")}
      </p>

      {!open ? (
        <div style={{ marginTop: 10 }}>
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            {t("password.change")}
          </Button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
          <input
            className="field"
            type="password"
            autoComplete="current-password"
            placeholder={t("password.current")}
            value={oldPassword}
            onChange={(e) => setOld(e.target.value)}
          />
          <input
            className="field"
            type="password"
            autoComplete="new-password"
            placeholder={t("password.new")}
            value={newPassword}
            onChange={(e) => setNew(e.target.value)}
          />

          <ul style={{ margin: "2px 0 0", paddingLeft: 18, fontSize: 12.5 }}>
            {PASSWORD_RULES.map((rule) => (
              <li
                key={rule.label}
                style={{
                  color: rule.test(newPassword) ? "var(--success)" : "var(--text-muted)",
                }}
              >
                {rule.label}
              </li>
            ))}
          </ul>

          {/* Stated before they commit, because it is a consequence they cannot
              undo and would otherwise discover on another device. */}
          <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
            {IS_NATIVE_BUILD
              ? t("password.signsOutAll")
              : t("password.signsOutOthers")}
          </p>

          <div style={{ display: "flex", gap: 8 }}>
            <Button size="sm" disabled={!valid || busy} onClick={() => void submit()}>
              {busy ? tCommon("saving") : tCommon("save")}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {tCommon("cancel")}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
