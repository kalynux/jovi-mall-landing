"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button, Skeleton } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { useApiResource } from "@/lib/shop/useApiResource";
import { formatMoney } from "@/lib/shop/format";
import { ApiError } from "@/lib/auth/auth.types";
import {
  MOBILE_MONEY_OPTIONS,
  paymentChannel,
  PaymentMethodPicker,
  paymentReady,
} from "@/components/shop/PaymentMethodPicker";
import { useSavedPayment } from "@/components/shop/useSavedPayment";
import { bookingPath } from "@/lib/shop/shop.routes";
import {
  getBooking,
  getBookingPaymentStatus,
  payBooking,
  type BookingPaymentStatus,
} from "@/lib/shop/bookings.api";

/** How long to watch for the gateway to settle before handing back. */
const POLL_MS = 4_000;
const POLL_LIMIT = 15;

/** Nothing after these will change on its own. */
const SETTLED: BookingPaymentStatus[] = ["paid", "failed", "refunded", "disputed"];

/**
 * Pay for a booking.
 *
 * ── Why the booking flow has its own payment page ────────────────────────────
 *
 * A booking is not an order. It is created `unpaid` by `POST .../book` and paid
 * through `POST /api/bookings/:id/pay`, which is a different endpoint from the
 * cart's `POST /api/payments/initiate` and takes a different body.
 *
 * 🔴 **Polling uses `GET /api/bookings/:id/payment-status`, not
 * `GET /api/payments/:transactionId`.** The generic payments read has been
 * owner-only since 2026-07-29 and answers `404` to anyone but the payer, so it
 * cannot serve both parties to a booking. This endpoint is scoped to the
 * customer who booked *and* the vendor who owns it, and returns the booking's
 * own `paymentStatus` beside the transaction.
 *
 * Mobile money only, as at checkout: those are the rails proven end to end in
 * this market.
 */
export function BookingPay({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const { flash } = useToast();
  const { status } = useAuthGuard();

  const booking = useApiResource(() => getBooking(bookingId), [bookingId, status]);

  const payForm = useSavedPayment(MOBILE_MONEY_OPTIONS, status === "authenticated");
  const { option, phone } = payForm;
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);

  const start = useCallback(async () => {
    setBusy(true);
    try {
      await payBooking(bookingId, option.gateway, paymentChannel(option, phone));
      setWaiting(true);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      flash(
        code === "BOOKING_UNAUTHORIZED"
          ? "You can only pay for your own bookings."
          : "Could not start that payment. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }, [bookingId, option, phone, flash]);

  // Watch for the gateway to settle. The prompt is answered on the shopper's
  // handset, so nothing here can hurry it — this only decides when to stop
  // watching and hand back to the booking.
  useEffect(() => {
    if (!waiting) return;

    let cancelled = false;
    let attempts = 0;

    const id = setInterval(async () => {
      attempts += 1;
      try {
        const state = await getBookingPaymentStatus(bookingId);
        if (cancelled) return;

        if (SETTLED.includes(state.paymentStatus)) {
          clearInterval(id);
          flash(
            state.paymentStatus === "paid"
              ? "Payment received."
              : "That payment did not go through.",
          );
          router.push(bookingPath(bookingId));
          return;
        }
      } catch {
        /* a lost poll is not a failed payment */
      }

      if (attempts >= POLL_LIMIT) {
        clearInterval(id);
        if (!cancelled) router.push(bookingPath(bookingId));
      }
    }, POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [waiting, bookingId, router, flash]);

  // `payForm.ready` joins the gate: a saved wallet number that lands after the
  // picker mounts arrives as an edit, and the operator detection overrides the
  // rail it came from. See `useSavedPayment`.
  if (status === "loading" || booking.status === "loading" || !payForm.ready) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-6 sm:px-6">
        <Skeleton height={220} />
      </div>
    );
  }

  const b = booking.data;
  if (!b || !b.requiresPayment || b.paymentStatus === "paid") {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-6 sm:px-6">
        <p style={{ fontSize: 14.5 }}>There is nothing to pay on this booking.</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.push(bookingPath(bookingId))}
        >
          Back to the booking
        </Button>
      </div>
    );
  }

  if (waiting) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-6 sm:px-6">
        <h1 className="sr-only">Waiting for payment</h1>
        <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>
          Check your phone
        </p>
        <p className="muted" style={{ fontSize: 13.5 }}>
          Approve the payment prompt on {phone || "your handset"}. This page updates on its own.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px] px-4 py-6 sm:px-6">
      <h1 className="sr-only">Pay for your booking</h1>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 26, fontWeight: 800 }}>
          {formatMoney(b.priceSnapshot, b.currency)}
        </div>
        <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
          {b.product?.title ?? "Service"} ·{" "}
          {new Date(b.startAt).toLocaleString(undefined, {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      <PaymentMethodPicker
        key={payForm.formKey}
        options={MOBILE_MONEY_OPTIONS}
        value={option}
        onChange={payForm.setOption}
        phone={phone}
        onPhoneChange={payForm.setPhone}
        disabled={busy}
        saved={payForm}
      />

      <div style={{ marginTop: 16 }}>
        <Button
          block
          size="lg"
          elevated
          disabled={busy || !paymentReady(option, phone)}
          onClick={() => void start()}
        >
          {busy ? "Starting…" : `Pay ${formatMoney(b.priceSnapshot, b.currency)}`}
        </Button>
      </div>
    </div>
  );
}
