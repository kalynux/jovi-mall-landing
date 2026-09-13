"use client";

import { useCallback, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Button, ConfirmDialog, Icon } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { ApiError } from "@/lib/auth/auth.types";
import { translateError } from "@/lib/auth/error-translator";
import { shareLink } from "@/lib/native/share";
import { formatMoney } from "@/lib/shop/format";
import { mintPayLink, payLinkUrl } from "@/lib/shop/pay-link.api";
import { initiatePayment } from "@/lib/shop/payments.api";

/**
 * "Send this to whoever is paying" — the half of the pay-link feature that
 * makes the other half reachable.
 *
 * ── What was already built, and what was not ─────────────────────────────────
 *
 * The hosted page at `/pay/[token]` is complete and careful: it separates
 * payable / settled / closed / expired, shows both the XAF amount and the USD
 * Stripe actually charges, and names what the money is for so it does not read
 * like a phishing page. But **nothing in the product ever minted a token.**
 * `POST /api/payments/:transactionId/pay-link` had no caller and `payPath()` had
 * no call site, so that page could only be reached by a URL the storefront had
 * no way to produce. This is the button between them.
 *
 * ── Why it creates a STRIPE transaction ──────────────────────────────────────
 *
 * A pay link is inherently a card path. Mobile money debits the payer's own
 * number from a prompt on the payer's own handset, so there is nothing for a web
 * page to do — and the backend says so, refusing to mint for one with
 * `422 PAYMENT_LINK_NOT_APPLICABLE`. So the flow is: create a card transaction,
 * mint a handle against it, send the handle.
 *
 * 🔴 **This is also the storefront's only working card path, and that is not a
 * coincidence.** `PayGroupSheet` deliberately offers mobile money only, because
 * `initiate` returns a Stripe `clientSecret` that no screen in this app has ever
 * consumed. The pay-link page *does* consume it — Stripe's Payment Element, card
 * details going straight to Stripe. Sending yourself the link is therefore a
 * legitimate way to pay by card, not only a way to ask somebody else.
 *
 * ── The constraint that will bite, and where it comes from ───────────────────
 *
 * ⚠ `initiate` is idempotent on **`(orderId, userId, total)`** — the gateway is
 * NOT part of the key (`payment-orchestrator.service.ts`,
 * `generateIdempotencyKey`). So if a mobile-money attempt for this same group is
 * still `INITIATED` or `PENDING`, asking for a STRIPE transaction hands back
 * that mobile-money one instead, and the mint then answers
 * `PAYMENT_LINK_NOT_APPLICABLE`. That is not a bug here to work around — it is
 * the server correctly refusing to run two payments for one order. The message
 * below says so in those terms, because "try again later" would be useless: the
 * shopper has to finish or abandon the prompt already on their phone.
 *
 * A `FAILED` or `CANCELLED` attempt is released and a fresh transaction is
 * created, so the ordinary retry path is unaffected.
 */

/**
 * Minting **revokes the previous link for the same transaction** — that is the
 * only revocation the backend has. Re-sending is therefore safe (a lost message
 * cannot be exploited later) and destructive (the message you already sent stops
 * working), so the second tap asks first. The first tap does not: there is
 * nothing yet to destroy.
 */
export function PayLinkShare({
  cartId,
  amount,
  currency,
  reference,
}: {
  cartId: string;
  amount: number;
  currency: string;
  /** The order reference, so the shared message is recognisable. */
  reference?: string | null;
}) {
  const t = useTranslations("shop.pay.share");
  const tErrors = useTranslations("errors");
  /* The expiry is a wall-clock time, formatted in the app's locale rather than
     the browser's — `toLocaleTimeString(undefined, …)` reads the latter. */
  const format = useFormatter();
  const { flash } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /**
   * When the link just sent runs out.
   *
   * Also the "have we sent one?" flag — see the note above. Taken from the
   * mint's own `expiresAt` rather than stated up front as "30 minutes": that is
   * only the default, and `PAYMENT_LINK_TTL_MINUTES` can move it, so the
   * shopper is told the real figure once there is one to tell.
   */
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [confirming, setConfirming] = useState(false);

  const send = useCallback(async () => {
    setError(null);
    setBusy(true);

    try {
      // Card, for the reason in the header note. No `channel` fields are
      // required for STRIPE — `phoneNumber` is mandatory only for the mobile
      // gateways — so nothing is invented here to satisfy the shape.
      const payment = await initiatePayment({
        cartId,
        gateway: "STRIPE",
        channel: {},
      });

      const minted = await mintPayLink(payment.transactionId);
      const url = payLinkUrl(minted);

      const outcome = await shareLink({
        title: t("shareTitle"),
        // Named and priced, because the recipient is frequently not the person
        // who ordered and a bare link asking for card details is exactly the
        // shape of a scam. The reference is what lets them match it to the
        // message that asked them to pay.
        text: reference
          ? t("shareTextWithReference", { amount: formatMoney(amount, currency), reference })
          : t("shareText", { amount: formatMoney(amount, currency) }),
        url,
        dialogTitle: t("shareDialogTitle"),
      });

      // `shareLink` reports which of four things happened rather than assuming;
      // "dismissed" is a change of mind and gets silence, not an error. The
      // expiry is recorded on every outcome including a dismissal, because the
      // token is live the moment it is minted whether or not the sheet was
      // used — so the next tap must still warn that it is about to revoke one.
      if (outcome === "copied") flash(t("copied"));
      else if (outcome === "shared") flash(t("sent"));
      else if (outcome === "failed") setError(t("shareFailed"));
      setExpiresAt(new Date(minted.expiresAt));
    } catch (err) {
      if (err instanceof ApiError && err.code === "PAYMENT_LINK_NOT_APPLICABLE") {
        setError(t("notApplicable"));
      } else if (err instanceof ApiError && err.code === "PAYMENT_LINK_NOT_PAYABLE") {
        setError(t("notPayable"));
      } else {
        setError(translateError(tErrors, err, t("createFailed")));
      }
    } finally {
      setBusy(false);
    }
  }, [cartId, amount, currency, reference, flash, t, tErrors]);

  return (
    <div
      style={{
        borderTop: "1px solid var(--border-subtle)",
        marginTop: 18,
        paddingTop: 16,
      }}
    >
      <p
        style={{
          fontSize: 13,
          lineHeight: 1.55,
          margin: "0 0 10px",
          color: "var(--text-body)",
          fontWeight: 600,
        }}
      >
        {t("heading")}
      </p>
      <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.55, margin: "0 0 12px" }}>
        {expiresAt
          ? t("sentUntil", {
              time: format.dateTime(expiresAt, { hour: "2-digit", minute: "2-digit" }),
            })
          : t("intro")}
      </p>

      {error && (
        <div
          role="alert"
          style={{
            display: "flex",
            gap: 9,
            alignItems: "flex-start",
            border: "1px solid var(--danger-border)",
            background: "var(--danger-bg)",
            borderRadius: "var(--radius-md)",
            padding: "11px 13px",
            marginBottom: 12,
          }}
        >
          <Icon
            name="triangle-alert"
            size={17}
            style={{ color: "var(--danger)", flexShrink: 0, marginTop: 1 }}
          />
          <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-body)", margin: 0 }}>
            {error}
          </p>
        </div>
      )}

      <Button
        block
        variant="secondary"
        leadingIcon="share-2"
        disabled={busy}
        onClick={() => (expiresAt ? setConfirming(true) : void send())}
      >
        {busy ? t("creating") : expiresAt ? t("sendNew") : t("send")}
      </Button>

      <ConfirmDialog
        open={confirming}
        tone="warning"
        icon="link-2-off"
        title={t("replaceTitle")}
        confirmLabel={t("sendNew")}
        cancelLabel={t("keepOld")}
        onConfirm={() => {
          setConfirming(false);
          void send();
        }}
        onCancel={() => setConfirming(false)}
      >
        {/* The exact consequence, in the shopper's terms. "Are you sure?" would
            not tell them the thing that matters: the message already sitting in
            someone's chat stops working the moment this is confirmed. */}
        {t("replaceBody")}
      </ConfirmDialog>
    </div>
  );
}
