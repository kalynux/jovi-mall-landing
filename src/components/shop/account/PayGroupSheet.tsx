"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { BottomSheet, Button, Icon, Skeleton } from "@/components/shop/ds";
import {
  OnlinePaymentUnavailable,
  OptionsLoadFailed,
  PaymentMethodPicker,
  chargeRequest,
  paymentReady,
} from "@/components/shop/PaymentMethodPicker";
import { usePaymentOptions } from "@/components/shop/usePaymentOptions";
import { useSavedPayment } from "@/components/shop/useSavedPayment";
import { useChargeRefusal } from "@/components/shop/useChargeRefusal";
import { PayLinkShare } from "./PayLinkShare";
import { translateError } from "@/lib/auth/error-translator";
import { formatMoney } from "@/lib/shop/format";
import { cardPagePath } from "@/lib/shop/pay-link.api";
import { initiatePayment, isSettledFailure, nextPaymentStep } from "@/lib/shop/payments.api";
import { rememberPaymentAttempt } from "@/lib/shop/payment-attempts";
import { payableOrders, payableTotal } from "@/lib/shop/order-status";
import type { OrderGroup } from "@/lib/shop/customer.types";

/**
 * Paying for an order that was placed but never paid for.
 *
 * ── Why this screen had to exist ─────────────────────────────────────────────
 *
 * `checkout` creates the orders *before* any payment call, in
 * `AWAITING_PAYMENT`, so a declined mobile-money prompt leaves a real order
 * behind rather than an evaporated basket. That is the right design, and it was
 * only half-built: the order sat there unpayable, and the success screen's own
 * "Pay for this order" button led to a detail page with no way to pay. Found on
 * a device, on a live order (`ORD-2026-000046`).
 *
 * ── Retrying is a first-class path, not a hack ───────────────────────────────
 *
 * `POST /api/payments/initiate` is idempotent on `(cartId, user, total)`, and
 * what it does with an existing transaction is exactly what this screen needs:
 *
 *   - `SUCCEEDED` → returns it. The poll on the success screen confirms and the
 *     shopper is told they have already paid, rather than paying twice.
 *   - `INITIATED` / `PENDING` → returns it **with its original instructions**,
 *     so tapping pay again re-shows the USSD code for the prompt already on the
 *     handset instead of sending a second one.
 *   - `FAILED` / `CANCELLED` → falls through and creates a fresh transaction.
 *
 * So there is no "has a payment already started?" check here, deliberately. The
 * server answers that question better than the client could.
 *
 * ── What the picker offers is the server's answer ────────────────────────────
 *
 * `GET /api/payments/options` is re-read every time the sheet opens, and the
 * rows are exactly what it lists — none when online payment is switched off.
 * What happens after the tap is read off the charge's own `instructions`: a
 * code step, a page to open, a card form, or the prompt on the phone.
 *
 * A card charge goes to the hosted page at `/pay/[token]`, the one screen that
 * confirms a Stripe `clientSecret`. The same page is behind `PayLinkShare` at
 * the foot of this sheet, which is "somebody else pays by card" — shown only
 * while `/options` lists `CARD`, because every pay link is a card charge.
 *
 * ⚠ The two cannot both be live at once. `initiate` keys idempotency on the
 * order, not on how it is paid, so a mobile-money attempt left `PENDING` here
 * makes the mint refuse with `PAYMENT_LINK_NOT_APPLICABLE`. `PayLinkShare`
 * says so in the shopper's own terms rather than retrying.
 */
export function PayGroupSheet({
  group,
  open,
  onClose,
}: {
  group: OrderGroup;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const t = useTranslations("shop.pay.sheet");
  const tErrors = useTranslations("errors");
  /**
   * Loaded only once the sheet opens.
   *
   * It is mounted on every payable order — see the note at its call site — so
   * fetching on mount would put a saved-methods request behind every order card
   * the shopper so much as looks at.
   */
  const payOptions = usePaymentOptions(open);
  const payForm = useSavedPayment(payOptions.options, open);
  const { option, phone } = payForm;
  const refusal = useChargeRefusal(payOptions.applyOffered);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const orders = payableOrders(group);
  const amount = payableTotal(group);
  // The payable orders' own currency, not the group's: they are the ones being
  // charged. A group cannot legitimately mix currencies — checkout guarantees
  // it and the server re-checks — so the first is the group's.
  const currency = orders[0]?.currency ?? group.currency;

  const pay = useCallback(async () => {
    const charge = option ? chargeRequest(option, phone) : null;
    if (!charge) return;
    setError(null);
    setBusy(true);

    try {
      const payment = await initiatePayment({ cartId: group.cartId, ...charge });

      // Write the transaction id down before leaving. It is returned exactly
      // once, and the order screen's "Check payment" needs it to force a
      // gateway re-check — see `payment-attempts`. Awaited rather than fired
      // and forgotten because the push below unmounts this sheet; it never
      // rejects, so it cannot cost the shopper their payment.
      await rememberPaymentAttempt(group.cartId, payment.transactionId);

      const params = new URLSearchParams({
        group: group.cartId,
        transaction: payment.transactionId,
      });
      const step = nextPaymentStep(payment.instructions);
      // A card is confirmed on the hosted page, not waited for here.
      if (!isSettledFailure(payment.status) && step.kind === "card") {
        router.push(await cardPagePath(payment.transactionId));
        return;
      }
      // A code step, or a page to open, is shown by the success screen, which
      // is also where the result is polled for.
      if (step.kind === "otp") params.set("otp", "1");
      if (step.kind === "redirect") params.set("redirect", step.url);
      if (payment.instructions?.ussdCode) params.set("ussd", payment.instructions.ussdCode);
      // The gateway's own per-action instruction — see the note at the same
      // line in the checkout page.
      if (payment.instructions?.message) params.set("note", payment.instructions.message);
      // The gateway refused on this very response. Say so now instead of
      // polling for a minute first — see `isSettledFailure` — and carry the
      // provider's own reason, which on a refusal is the top-level `message`
      // and not `instructions.message` (there are no instructions to give).
      if (isSettledFailure(payment.status)) {
        params.set("failed", "1");
        if (payment.message) params.set("reason", payment.message);
      }

      // `busy` is left set: the push is in flight and the sheet is still
      // mounted behind it, so clearing it would re-arm the button for a second
      // tap during navigation.
      router.push(`/shop/checkout/success?${params}`);
    } catch (err) {
      setBusy(false);
      // Nothing was charged on a provider refusal; the form is left as it is.
      setError(refusal(err) ?? translateError(tErrors, err, t("startFailed")));
    }
  }, [group.cartId, option, phone, router, t, tErrors, refusal]);

  const phoneOk = option !== null && paymentReady(option, phone);
  const canPay = payForm.ready && phoneOk && !busy;
  const cardListed = payOptions.options?.some((o) => o.provider === "CARD") ?? false;

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={t("title")}
      // The amount and the button live in the footer so they stay put: the
      // phone field carries a country list, and on a small handset an inline
      // button would sit below the fold exactly when it is needed.
      footer={
        <>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 12,
              fontWeight: 800,
              color: "var(--text-strong)",
            }}
          >
            <span style={{ fontSize: 14 }}>{t("toPay")}</span>
            <span style={{ fontSize: 18, fontVariantNumeric: "tabular-nums" }}>
              {formatMoney(amount, currency)}
            </span>
          </div>
          <Button
            block
            size="lg"
            elevated
            leadingIcon="lock"
            disabled={!canPay}
            title={option && !phoneOk ? t("enterValidNumber") : undefined}
            onClick={() => void pay()}
          >
            {busy ? t("starting") : t("payAmount", { amount: formatMoney(amount, currency) })}
          </Button>
        </>
      }
    >
      <p className="muted" style={{ fontSize: 13, lineHeight: 1.55, margin: "0 0 16px" }}>
        {orders.length === group.orderCount ? t("intro") : t("partialIntro", { n: orders.length })}
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
            marginBottom: 16,
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

      {/* Held back until the saved methods have answered: a wallet number that
          lands after the picker mounts arrives as an edit, and the operator
          detection overrides the rail it came from. See `useSavedPayment`. */}
      {payOptions.failed ? (
        <OptionsLoadFailed onRetry={payOptions.reload} />
      ) : payOptions.options?.length === 0 ? (
        <OnlinePaymentUnavailable />
      ) : payForm.ready && option && payOptions.options ? (
        <PaymentMethodPicker
          key={payForm.formKey}
          options={payOptions.options}
          value={option}
          onChange={payForm.setOption}
          phone={phone}
          onPhoneChange={payForm.setPhone}
          disabled={busy}
          saved={payForm}
        />
      ) : (
        <Skeleton height={180} />
      )}

      {/* The other way this order can be paid for, and it belongs here rather
          than on the order card: the shopper is already answering "how do I pay
          for this", and "somebody else will" is one of the answers. It is also
          the only card path the storefront has — see the note in
          `PayLinkShare`.

          ⚠ SHOWN ONLY WHILE /options LISTS CARD. This is a card path, not
            merely a sharing one: it mints the link against a `CARD` charge,
            which the server refuses while cards are off — so offering it then
            would be a button that can only fail. */}
      {cardListed && (
        <PayLinkShare
          cartId={group.cartId}
          amount={amount}
          currency={currency}
          reference={orders[0]?.orderNumber}
          onUnavailable={payOptions.applyOffered}
        />
      )}
    </BottomSheet>
  );
}
