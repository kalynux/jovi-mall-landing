"use client";

import { useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Button, Icon } from "@/components/shop/ds";
import { ApiError } from "@/lib/auth/auth.types";
import { translateError } from "@/lib/auth/error-translator";
import { openExternal } from "@/lib/native/links";
import { isolateLtr } from "@/lib/bidi";
import { formatMoney } from "@/lib/shop/format";
import { dialHref, limitBreach, type HandsetStep } from "@/lib/shop/mobile-money";
import { authorizePayment, type PaymentInstructions, type PaymentLimits } from "@/lib/shop/payments.api";

/**
 * The screens a charge can ask for after `initiate`, other than "approve the
 * prompt on your phone". Which one is shown is decided by `nextPaymentStep`
 * reading the answer's `instructions` — never by which company carries the
 * money, which this app does not know.
 */

/**
 * The first thing on the waiting screen when the answer names a payee.
 *
 * Without it a customer refuses a request from a name they do not recognise, or
 * on a network with no prompt, waits for one that never comes. Our own wording
 * rather than `message`, which is French then English on one line in a shop with
 * five languages; `message` is only the fallback when the mode is not known.
 *
 * A code has no strong characters, so an Arabic sentence would pull its `#` to
 * the wrong end. In a sentence it goes inside a left-to-right isolate (LRI…PDI;
 * FSI would resolve to the paragraph's direction), and elsewhere `dir="ltr"`.
 */
export function PaymentHandsetStep({ step }: { step: HandsetStep }) {
  const t = useTranslations("shop.payProvider");
  const payee = isolateLtr(step.payeeName);
  const code = step.ussdCode;
  const href = code ? dialHref(code) : null;
  const isolatedCode = code ? `⁦${code}⁩` : "";

  const codeText = code && (
    <p
      dir="ltr"
      style={{
        fontSize: 26,
        fontWeight: 800,
        letterSpacing: "0.02em",
        lineHeight: 1.2,
        color: "var(--text-strong)",
        textAlign: "center",
        overflowWrap: "anywhere",
        userSelect: "all",
        margin: "0 0 12px",
      }}
    >
      {code}
    </p>
  );

  const dialButton = href && (
    <a
      href={href}
      className="ds-btn"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: 52,
        padding: "0 20px",
        fontFamily: "var(--font-sans)",
        fontSize: 15.5,
        fontWeight: 700,
        borderRadius: "var(--radius-button)",
        background: "var(--brand)",
        color: "var(--brand-on)",
        boxShadow: "var(--shadow-brand)",
        textDecoration: "none",
      }}
    >
      <Icon name="phone" size={19} />
      {t("handsetDialAction", { code: isolatedCode })}
    </a>
  );

  const bodyStyle = { fontSize: 13, lineHeight: 1.55, color: "var(--text-body)" } as const;

  return (
    <div
      style={{
        width: "100%",
        border: "1px solid var(--brand)",
        background: "var(--brand-subtle)",
        borderRadius: "var(--radius-md)",
        padding: "14px 15px",
        textAlign: "start",
      }}
    >
      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)", margin: "0 0 8px" }}>
        {step.mode === "dial" ? t("handsetDialTitle") : t("handsetPromptTitle", { payee })}
      </p>

      {step.mode === "dial" && (
        <>
          {codeText}
          <p style={{ ...bodyStyle, margin: href ? "0 0 12px" : 0 }}>{t("handsetDialBody", { payee })}</p>
          {dialButton}
        </>
      )}

      {step.mode === "prompt" && (
        <>
          <p style={{ ...bodyStyle, margin: 0 }}>{t("handsetPromptBody")}</p>
          {code && (
            <p style={{ ...bodyStyle, margin: "8px 0 0" }}>
              {t.rich("handsetPromptFallback", {
                code,
                dial: (chunks) =>
                  href ? (
                    <a
                      href={href}
                      dir="ltr"
                      style={{ fontWeight: 700, color: "var(--brand-hover)", textDecoration: "underline" }}
                    >
                      {chunks}
                    </a>
                  ) : (
                    <strong dir="ltr">{chunks}</strong>
                  ),
              })}
            </p>
          )}
        </>
      )}

      {step.mode === "unknown" && (
        <>
          {step.message && <p style={{ ...bodyStyle, margin: code ? "0 0 12px" : 0 }}>{step.message}</p>}
          {codeText}
          {dialButton}
        </>
      )}
    </div>
  );
}

/**
 * Why the pay button is off: `/options` already says this amount will be refused.
 *
 * Names only the side the amount breaks, the minimum OR the maximum, and
 * renders nothing while the amount is chargeable, so callers can mount it
 * unconditionally.
 */
export function PaymentLimitNote({
  amount,
  currency,
  limits,
  style,
}: {
  amount: number;
  currency: string;
  limits: PaymentLimits | undefined;
  style?: CSSProperties;
}) {
  const t = useTranslations("shop.payProvider");
  const breach = limitBreach(amount, currency, limits);
  if (!breach) return null;
  const figure = formatMoney(breach.value, "XAF");
  return (
    <p
      role="status"
      style={{
        display: "flex",
        gap: 7,
        alignItems: "flex-start",
        fontSize: 12.5,
        lineHeight: 1.5,
        color: "var(--text-body)",
        margin: "10px 0 0",
        ...style,
      }}
    >
      <Icon name="triangle-alert" size={14} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 2 }} />
      <span>{breach.bound === "min" ? t("amountBelowMin", { min: figure }) : t("amountAboveMax", { max: figure })}</span>
    </p>
  );
}

/**
 * The SMS code step (`instructions.requiresOtp`).
 *
 * Some networks, on some aggregators, send the shopper a code before any prompt
 * reaches the handset, and nothing is charged until it is relayed to
 * `POST /payments/:transactionId/authorize`. Showing "dial the code" or "check
 * your phone" here would describe a prompt that is never coming.
 *
 * `onAuthorized` gets the instructions for the step after — the code accepted,
 * the shopper now confirms on the handset — or `undefined` when the server says
 * no code was needed after all, in which case the caller's own "check your
 * phone" view is the right one anyway. `onRestart` is for the one dead end:
 * too many wrong codes fail the transaction, and only a new payment helps.
 */
export function PaymentOtpStep({
  transactionId,
  onAuthorized,
  onRestart,
}: {
  transactionId: string;
  onAuthorized: (instructions: PaymentInstructions | undefined, message?: string) => void;
  onRestart: (reason: string) => void;
}) {
  const t = useTranslations("shop.payProvider");
  const tErrors = useTranslations("errors");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const digits = code.replace(/\D/g, "");
  // 4–8 digits is the route's own validation, so a shorter code is not sent.
  const valid = digits.length >= 4 && digits.length <= 8;

  const submit = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await authorizePayment(transactionId, digits);
      onAuthorized(result.instructions, result.message);
    } catch (err) {
      setBusy(false);
      if (!(err instanceof ApiError)) {
        setError(translateError(tErrors, err, t("otpFailed")));
        return;
      }
      if (err.code === "PAYMENT_OTP_INVALID") {
        const left = (err.details as { attemptsRemaining?: unknown } | undefined)?.attemptsRemaining;
        setCode("");
        setError(typeof left === "number" ? t("otpInvalid", { n: left }) : t("otpInvalidNoCount"));
      } else if (err.code === "PAYMENT_OTP_ATTEMPTS_EXCEEDED") {
        onRestart(t("otpExhausted"));
      } else if (err.code === "PAYMENT_OTP_NOT_REQUIRED") {
        onAuthorized(undefined);
      } else {
        setError(translateError(tErrors, err, t("otpFailed")));
      }
    }
  };

  return (
    <div
      style={{
        width: "100%",
        border: "1px solid var(--brand)",
        background: "var(--brand-subtle)",
        borderRadius: "var(--radius-md)",
        padding: "14px 15px",
        textAlign: "start",
      }}
    >
      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)", margin: "0 0 4px" }}>
        {t("otpTitle")}
      </p>
      <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-body)", margin: "0 0 12px" }}>
        {t("otpBody")}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        style={{ display: "flex", gap: 8 }}
      >
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={8}
          dir="ltr"
          aria-label={t("otpLabel")}
          className="field"
          disabled={busy}
          style={{ flex: 1, minWidth: 0, fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.2em" }}
        />
        <Button type="submit" size="md" disabled={busy || !valid}>
          {busy ? t("otpSubmitting") : t("otpSubmit")}
        </Button>
      </form>

      {error && (
        <p
          role="alert"
          style={{
            display: "flex",
            gap: 7,
            alignItems: "flex-start",
            fontSize: 12.5,
            lineHeight: 1.5,
            color: "var(--text-body)",
            margin: "10px 0 0",
          }}
        >
          <Icon name="triangle-alert" size={14} style={{ color: "var(--danger)", flexShrink: 0, marginTop: 2 }} />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

/**
 * The payment continues on another page (`instructions.redirectUrl`).
 *
 * A button rather than an automatic jump: the answer arrives after an `await`,
 * where a browser treats `window.open` as a popup and blocks it, and inside the
 * app the page must open in the in-app browser, whose Done button comes back
 * here — where the caller is already polling for the result.
 *
 * `payeeName` is said here too: a charge can name a payee and still continue on
 * a page, and whoever finishes it there must not refuse a name they do not know.
 */
export function PaymentRedirectPrompt({ url, payeeName }: { url: string; payeeName?: string | null }) {
  const t = useTranslations("shop.payProvider");
  return (
    <div
      style={{
        width: "100%",
        border: "1px solid var(--brand)",
        background: "var(--brand-subtle)",
        borderRadius: "var(--radius-md)",
        padding: "14px 15px",
        textAlign: "start",
      }}
    >
      <p style={{ fontSize: 15, fontWeight: 700, color: "var(--text-strong)", margin: "0 0 4px" }}>
        {t("redirectTitle")}
      </p>
      <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-body)", margin: "0 0 12px" }}>
        {t("redirectBody")}
        {payeeName && ` ${t("redirectPayee", { payee: isolateLtr(payeeName) })}`}
      </p>
      <Button block leadingIcon="external-link" onClick={() => void openExternal(url)}>
        {t("redirectOpen")}
      </Button>
    </div>
  );
}
