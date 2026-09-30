"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button, Icon } from "@/components/shop/ds";
import { ApiError } from "@/lib/auth/auth.types";
import { translateError } from "@/lib/auth/error-translator";
import { openExternal } from "@/lib/native/links";
import { authorizePayment, type PaymentInstructions } from "@/lib/shop/payments.api";

/**
 * The screens a charge can ask for after `initiate`, other than "approve the
 * prompt on your phone". Which one is shown is decided by `nextPaymentStep`
 * reading the answer's `instructions` — never by which company carries the
 * money, which this app does not know.
 */

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
 */
export function PaymentRedirectPrompt({ url }: { url: string }) {
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
      </p>
      <Button block leadingIcon="external-link" onClick={() => void openExternal(url)}>
        {t("redirectOpen")}
      </Button>
    </div>
  );
}
