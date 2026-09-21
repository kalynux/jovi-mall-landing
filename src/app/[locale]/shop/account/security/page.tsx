"use client";

import { useCallback, useEffect, useState } from "react";
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
  getContact,
  requestEmailChange,
  requestPhoneChange,
  type ContactState,
  type PendingContactChange,
} from "@/lib/me/contact.api";
import {
  confirmPhoneCode,
  getPhoneVerification,
  requestPhoneCode,
  RESEND_COOLDOWN_SECONDS,
} from "@/lib/me/phone-verification.api";
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
 * The `PHONE_VERIFICATION_*` codes come from the WhatsApp code that proves a
 * phone change. `CODE_INVALID` and `CODE_EXPIRED` stay distinct for the same
 * reason — retype versus ask for a new code.
 *
 * Two cases borrow the shared `errors.` sentence instead of getting one of this
 * page's own. `MAIL_ALL_PROVIDERS_FAILED` is the backend's 502 for "no
 * configured mail provider accepted the message", so the change was never
 * opened and the only instruction is to try again; the identical failure
 * reaches the verification send, and one string said one way beats two that
 * drift apart. `PHONE_VERIFICATION_DELIVERY_FAILED` is the WhatsApp twin: a
 * 502 in the masked `external_service` category, whose fallback copy would say
 * a service is down when WhatsApp simply refused one send.
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
    case "PHONE_VERIFICATION_NO_TARGET":
    case "PHONE_VERIFICATION_CODE_INVALID":
    case "PHONE_VERIFICATION_CODE_EXPIRED":
    case "PHONE_VERIFICATION_TOO_MANY_ATTEMPTS":
    case "PHONE_VERIFICATION_RESEND_TOO_SOON":
      return `shop.security.errors.${code}`;
    // Retryable, and deliberately not `somethingWentWrong`: nothing about the
    // account moved, and the button works.
    case "MAIL_ALL_PROVIDERS_FAILED":
    case "PHONE_VERIFICATION_DELIVERY_FAILED":
      return `errors.${code}`;
    default:
      return "shop.common.somethingWentWrong";
  }
}

/** A numeric `details` field, or `undefined` when the error does not carry one. */
function numericDetail(err: unknown, key: string): number | undefined {
  const value = err instanceof ApiError ? err.details?.[key] : undefined;
  return typeof value === "number" ? value : undefined;
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

/**
 * Where a pending phone change stands, read once per change.
 *
 * `expired` is checked here because nothing else will: `GET /api/me/contact`
 * keeps reporting a change after its 24-hour window, and `verify/request`
 * would still send a WhatsApp code to it — one the confirm then refuses with
 * `CONTACT_CHANGE_EXPIRED`. `codeLive` is whether a code is already waiting to
 * be typed, so a reload does not make the person ask for a second one.
 */
type PhoneProof = { expired: true } | { expired: false; codeLive: boolean };

/**
 * A phone change is proved with a six-digit code sent to the NEW number on
 * WhatsApp, typed back here (api-doc/me/phone-verification.md).
 *
 * ⛔ Not by messaging the bot from the new number. That was this card's flow
 * until 2026-09-21; the backend keeps the connection proof for the bot surface
 * only, and asked every frontend to drop the "connect WhatsApp first" copy.
 * The same goes for a failed send: every route was already tried by the time
 * `PHONE_VERIFICATION_DELIVERY_FAILED` arrives, so the answer is Resend and a
 * way to reach support — never "message the bot first".
 */
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
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  // Set by a successful send, so the code field shows at once rather than
  // after the verification read comes back.
  const [justSent, setJustSent] = useState(false);
  // Inline rather than a toast: it is about the field beside it, and it has to
  // stay put while the person reads the code off their phone.
  const [notice, setNotice] = useState<{ text: string; error: boolean } | null>(null);
  const [deliveryFailed, setDeliveryFailed] = useState(false);

  const pending = contact.pendingPhone;
  const proof = useApiResource<PhoneProof | null>(
    async () => {
      if (!pending) return null;
      if (Date.parse(pending.expiresAt) <= Date.now()) return { expired: true };
      const state = await getPhoneVerification();
      return { expired: false, codeLive: state.pending && state.completesPendingChange };
    },
    [pending?.target, pending?.expiresAt],
  );
  const expired = proof.data?.expired === true;
  const codeLive = justSent || (proof.data?.expired === false && proof.data.codeLive);

  // Tick the resend cooldown down; nothing else re-renders this card.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const reset = () => {
    setCode("");
    setJustSent(false);
    setNotice(null);
    setDeliveryFailed(false);
  };

  /** Never throws: every outcome lands in `notice`, beside the code field. */
  const sendCode = async () => {
    setNotice(null);
    setDeliveryFailed(false);
    try {
      await requestPhoneCode();
      setCode("");
      setJustSent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setNotice({ text: t("phone.codeSent"), error: false });
    } catch (err) {
      const errCode = err instanceof ApiError ? err.code : undefined;
      if (errCode === "PHONE_VERIFICATION_RESEND_TOO_SOON") {
        // The code already sent keeps working: the cooldown is checked before
        // a new one is minted.
        setCooldown(
          numericDetail(err, "retryAfterSeconds") ??
            (err as ApiError).retryAfterSeconds ??
            RESEND_COOLDOWN_SECONDS,
        );
      }
      if (errCode === "PHONE_VERIFICATION_DELIVERY_FAILED") setDeliveryFailed(true);
      setNotice({ text: tKey(contactMessageKey(err)), error: true });
    }
  };

  const submit = async () => {
    setBusy(true);
    reset();
    try {
      await requestPhoneChange(value.trim());
      setValue("");
      // `PATCH /api/me/phone` does not send the code. Sent before the reload,
      // so the reload's verification read finds it already in flight.
      await sendCode();
      await onChanged();
    } catch (err) {
      flash(tKey(contactMessageKey(err)));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    await sendCode();
    setBusy(false);
  };

  const confirm = async () => {
    setBusy(true);
    setNotice(null);
    try {
      const { changed } = await confirmPhoneCode(code.trim());
      reset();
      await onChanged();
      flash(changed ? t("phone.confirmed") : t("phone.verified"));
    } catch (err) {
      const errCode = err instanceof ApiError ? err.code : undefined;
      const attemptsLeft = numericDetail(err, "attemptsLeft");
      if (errCode === "PHONE_VERIFICATION_CODE_INVALID" && attemptsLeft !== undefined) {
        setNotice({ text: t("phone.codeInvalid", { attemptsLeft }), error: true });
      } else {
        // Expired or spent: the code is gone server-side, so offer a new one
        // instead of leaving a field that can only fail again.
        if (
          errCode === "PHONE_VERIFICATION_CODE_EXPIRED" ||
          errCode === "PHONE_VERIFICATION_TOO_MANY_ATTEMPTS"
        ) {
          setCode("");
          setJustSent(false);
          proof.reload();
        }
        setNotice({ text: tKey(contactMessageKey(err)), error: true });
      }
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await cancelPhoneChange();
      reset();
      await onChanged();
    } catch (err) {
      flash(tKey(contactMessageKey(err)));
    } finally {
      setBusy(false);
    }
  };

  const cancelButton = (
    <Button variant="ghost" size="sm" disabled={busy} onClick={() => void cancel()}>
      {tCommon("cancel")}
    </Button>
  );

  return (
    <Card title={t("phone.title")}>
      <p style={{ margin: 0, fontSize: 14 }}>
        {contact.phone ?? <span className="muted">{t("phone.none")}</span>}
      </p>

      {pending ? (
        <>
          <Pending
            change={pending}
            note={t("phone.pendingNote", {
              date: format.dateTime(new Date(pending.expiresAt), {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          />

          {expired ? (
            <>
              <p style={{ fontSize: 13, margin: "8px 0 0", color: "var(--danger)" }}>
                {t("phone.expired")}
              </p>
              <div style={{ marginTop: 10 }}>{cancelButton}</div>
            </>
          ) : codeLive ? (
            <>
              <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                <input
                  className="field"
                  style={{ flex: "1 1 140px" }}
                  aria-label={t("phone.codeLabel")}
                  placeholder={t("phone.codePlaceholder")}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={12}
                  dir="ltr"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                />
                <Button size="sm" disabled={!code || busy} onClick={() => void confirm()}>
                  {busy ? t("phone.checking") : tCommon("confirm")}
                </Button>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={busy || cooldown > 0}
                  onClick={() => void resend()}
                >
                  {cooldown > 0
                    ? t("phone.resendIn", { seconds: cooldown })
                    : t("phone.resendCode")}
                </Button>
                {cancelButton}
              </div>
            </>
          ) : (
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <Button size="sm" disabled={busy || cooldown > 0} onClick={() => void resend()}>
                {cooldown > 0 ? t("phone.resendIn", { seconds: cooldown }) : t("phone.sendCode")}
              </Button>
              {cancelButton}
            </div>
          )}

          {notice && (
            <p
              role={notice.error ? "alert" : "status"}
              style={{
                fontSize: 13,
                margin: "8px 0 0",
                color: notice.error ? "var(--danger)" : "var(--text-muted)",
              }}
            >
              {notice.text}
            </p>
          )}

          {/* A refusal on every route is a platform or Meta-side fault, and
              support can read the reason in the server log. */}
          {deliveryFailed && (
            <div style={{ marginTop: 6 }}>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/shop/account/support/new")}
              >
                {t("phone.contactSupport")}
              </Button>
            </div>
          )}
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
      // `USER_INVALID_PASSWORD` (403) — not the sign-in's
      // `AUTH_INVALID_CREDENTIALS`, which this route never sends.
      flash(
        code === "USER_INVALID_PASSWORD"
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
