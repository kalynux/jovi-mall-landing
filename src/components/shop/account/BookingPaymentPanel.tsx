"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button, Icon } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { translateError } from "@/lib/auth/error-translator";
import { formatMoney } from "@/lib/shop/format";
import { isSettledFailure, verifyPayment } from "@/lib/shop/payments.api";
import { bookingPayPath } from "@/lib/shop/shop.routes";
import { getBooking, getBookingPaymentStatus, type Booking } from "@/lib/shop/bookings.api";

/**
 * The money part of a booking: pay it, or find out whether a payment landed.
 *
 * ── Why there is a "check" beside the "pay" ──────────────────────────────────
 *
 * The same reason the order screen has one (`OrderGroupDetail`'s
 * `GroupSummary`). Mobile money settles asynchronously, so between the prompt
 * being approved and the callback arriving this booking still reads `unpaid` or
 * `pending` — and a Pay button is then an invitation to pay twice. The check
 * answers the question that shopper actually has.
 *
 * ── How the check works ──────────────────────────────────────────────────────
 *
 * 1. `GET /api/bookings/:id/payment-status` names the transaction, which the
 *    order screen has to remember on the device. When one is open, `verify`
 *    re-asks the gateway rather than waiting for its callback.
 * 2. The booking is re-read either way. It is the authority: `verify` reports
 *    the transaction, the booking reports whether the money landed against it.
 *
 * The answer stays inline rather than flashing. "Not through yet" is a
 * sentence the shopper deliberately asked for and must still be reading when
 * their thumb is over the Pay button. Only success is a toast, because the
 * block this note lives in unmounts the moment the booking is paid.
 */
export function BookingPaymentPanel({
  booking,
  onRefreshed,
}: {
  booking: Booking;
  onRefreshed: (next: Booking) => void;
}) {
  const t = useTranslations("shop.bookings");
  const tErrors = useTranslations("errors");
  const router = useRouter();
  const { flash } = useToast();
  const [checking, setChecking] = useState(false);
  const [checked, setChecked] = useState<{ tone: "info" | "danger"; message: string } | null>(null);

  const b = booking;
  const amount = formatMoney(b.priceSnapshot, b.currency);
  const inFlight = b.paymentStatus === "pending";
  const payable =
    b.requiresPayment && (b.paymentStatus === "unpaid" || b.paymentStatus === "failed");

  const check = useCallback(async () => {
    setChecking(true);
    setChecked(null);
    try {
      let refused = false;
      try {
        const state = await getBookingPaymentStatus(b.id);
        const tx = state.transaction;
        if (tx && !isSettledFailure(tx.status) && state.paymentStatus !== "paid") {
          refused = isSettledFailure((await verifyPayment(tx.id)).status);
        } else if (tx) {
          refused = isSettledFailure(tx.status);
        }
      } catch {
        // A verify that errors is not a failed payment — it may still be
        // settling, and the callback settles it without us. The re-read below
        // is what the shopper is shown.
      }

      const fresh = await getBooking(b.id);
      // Keep the parties if this read lacks them (an API older than the
      // 2026-10-26 read projection populates neither).
      const next: Booking = {
        ...b,
        ...fresh,
        product: fresh.product ?? b.product,
        vendor: fresh.vendor ?? b.vendor,
        store: fresh.store ?? b.store,
      };
      onRefreshed(next);

      if (next.paymentStatus === "paid") {
        flash(t("paymentReceived"));
      } else if (next.paymentStatus === "pending") {
        setChecked({ tone: "info", message: t("detail.checkStillPending") });
      } else if (refused || next.paymentStatus === "failed") {
        setChecked({ tone: "danger", message: t("detail.checkRefused") });
      } else if (next.requiresPayment && next.paymentStatus === "unpaid") {
        setChecked({ tone: "info", message: t("detail.checkNotArrived") });
      }
    } catch (err) {
      setChecked({ tone: "danger", message: translateError(tErrors, err, t("detail.checkFailed")) });
    } finally {
      setChecking(false);
    }
  }, [b, onRefreshed, flash, t, tErrors]);

  if (!inFlight && !payable) return null;

  return (
    <div
      style={{
        marginTop: 14,
        paddingTop: 14,
        borderTop: "1px solid var(--border-subtle)",
      }}
    >
      {inFlight ? (
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
          <Icon name="hourglass" size={18} style={{ color: "var(--info)", flexShrink: 0, marginTop: 1 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14.5, color: "var(--text-strong)" }}>
              {t("detail.pendingTitle")}
            </div>
            <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-body)", margin: "4px 0 0" }}>
              {t("detail.pendingBody", { amount })}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text-strong)" }}>
            {t("toPay", { amount })}
          </div>
          <p style={{ fontSize: 13, lineHeight: 1.55, color: "var(--text-body)", margin: "4px 0 12px" }}>
            {b.paymentStatus === "failed"
              ? t("detail.lastPaymentFailed")
              : b.status === "confirmed"
                ? t("heldPayToKeep")
                : t("payAfterAccepted")}
          </p>
        </>
      )}

      <div className="grid gap-2">
        {/* A booking is created `unpaid`, and a `pending` one waits for the
            seller — paying it then is refused, so the button says so by
            being disabled under `payAfterAccepted`. */}
        {payable && (
          <Button
            block
            elevated
            leadingIcon="wallet"
            disabled={checking || b.status !== "confirmed"}
            onClick={() => router.push(bookingPayPath(b.id))}
          >
            {t("payAmount", { amount })}
          </Button>
        )}

        {/* Secondary on an unpaid booking — noise to someone who has not paid,
            and what the one who has is looking for. Primary-weight content
            while a payment is in flight, because then it is the only action. */}
        {(inFlight || (payable && b.status === "confirmed")) && (
          <Button
            block
            variant="secondary"
            leadingIcon="refresh-cw"
            disabled={checking}
            onClick={() => void check()}
          >
            {checking ? t("detail.checking") : inFlight ? t("detail.checkAgain") : t("detail.alreadyPaidCheck")}
          </Button>
        )}
      </div>

      {checked && (
        <div
          role="status"
          style={{
            display: "flex",
            gap: 9,
            alignItems: "flex-start",
            marginTop: 10,
            border: `1px solid var(--${checked.tone === "danger" ? "danger-border" : "border"})`,
            background: checked.tone === "danger" ? "var(--danger-bg)" : "var(--surface-sunken)",
            borderRadius: "var(--radius-md)",
            padding: "11px 13px",
          }}
        >
          <Icon
            name={checked.tone === "danger" ? "triangle-alert" : "hourglass"}
            size={16}
            style={{
              color: checked.tone === "danger" ? "var(--danger)" : "var(--text-muted)",
              flexShrink: 0,
              marginTop: 1,
            }}
          />
          <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-body)", margin: 0 }}>
            {checked.message}
          </p>
        </div>
      )}
    </div>
  );
}
