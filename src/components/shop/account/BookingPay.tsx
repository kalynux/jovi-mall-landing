"use client";

import { useFormatter, useTranslations } from "next-intl";

import { useCallback, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button, Skeleton } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { useApiResource } from "@/lib/shop/useApiResource";
import { formatMoney } from "@/lib/shop/format";
import { ApiError } from "@/lib/auth/auth.types";
import {
  chargeRequest,
  OnlinePaymentUnavailable,
  OptionsLoadFailed,
  PaymentMethodPicker,
  paymentReady,
} from "@/components/shop/PaymentMethodPicker";
import { usePaymentOptions } from "@/components/shop/usePaymentOptions";
import { useSavedPayment } from "@/components/shop/useSavedPayment";
import { useChargeRefusal } from "@/components/shop/useChargeRefusal";
import { cardPagePath } from "@/lib/shop/pay-link.api";
import { isSettledFailure, nextPaymentStep, verifyPayment } from "@/lib/shop/payments.api";
import { bookingPath } from "@/lib/shop/shop.routes";
import {
  getBooking,
  getBookingPaymentStatus,
  payBooking,
  type BookingPaymentStatus,
} from "@/lib/shop/bookings.api";
import { BookingPaymentCheck, type PaymentVerdict } from "./BookingPaymentCheck";

/** What the check screen needs about an attempt this screen knows of. */
interface Watch {
  /** `null` when the attempt was started elsewhere — a reload, the card page, another device. */
  transactionId: string | null;
  phone: string | null;
  ussd: string | null;
  note: string | null;
  redirectUrl: string | null;
  otp: boolean;
  initialPhase: "checking" | "failed";
  reason: string | null;
}

/** An attempt already in flight when the screen opened. */
const RESUMED: Watch = {
  transactionId: null,
  phone: null,
  ussd: null,
  note: null,
  redirectUrl: null,
  otp: false,
  initialPhase: "checking",
  reason: null,
};

/** The booking's own word on its money, as the check screen reads it. */
function verdictOf(status: BookingPaymentStatus): PaymentVerdict {
  if (status === "paid") return "paid";
  // `unpaid` after an attempt means the attempt is gone — nothing was taken.
  if (status === "failed" || status === "unpaid") return "failed";
  if (status === "pending") return "pending";
  // Refunded, disputed, waiting on a refund: the booking explains those.
  return "moved";
}

/**
 * Pay for a booking.
 *
 * ── Why the booking flow has its own payment page ────────────────────────────
 *
 * A booking is not an order. It is created `unpaid` by `POST .../book` and paid
 * through `POST /api/bookings/:id/pay`, which is a different endpoint from the
 * cart's `POST /api/payments/initiate` and takes a different body.
 *
 * The choices are `GET /api/payments/options`, as at checkout, and the same
 * `{ provider, channel }` body goes out. What happens next is read off the
 * answer's `instructions`: an SMS code step, a page to open, the hosted card
 * page, or — the usual case — "approve the prompt on your phone".
 *
 * ── The wait ─────────────────────────────────────────────────────────────────
 *
 * Everything after the charge is `BookingPaymentCheck`: the code step, the page
 * to open, the polling, and the three endings. Each check asks the gateway
 * (`POST /api/payments/verify`, which settles the booking when the money is
 * there) and then the booking (`GET /api/bookings/:id/payment-status`).
 *
 * 🔴 **The booking is read with `/payment-status`, not
 * `GET /api/payments/:transactionId`.** The generic payments read has been
 * owner-only since 2026-07-29 and answers `404` to anyone but the payer, so it
 * cannot serve both parties to a booking.
 *
 * ── A booking already `pending` opens on the wait ────────────────────────────
 *
 * Back from the card page, a reload mid-wait, a second tab: the attempt is still
 * live, and `POST .../pay` would refuse a new one with
 * `409 PAYMENT_BOOKING_IN_PROGRESS`. So the screen goes straight to checking
 * that attempt rather than offering a form that cannot work.
 */
export function BookingPay({ bookingId }: { bookingId: string }) {
  // Bound above the guards below — this screen has several render branches, so
  // a hook after an early return would change the hook order between renders.
  const t = useTranslations("shop.bookings");
  const format = useFormatter();
  const router = useRouter();
  const { flash } = useToast();
  const { status } = useAuthGuard();

  const booking = useApiResource(() => getBooking(bookingId), [bookingId, status]);

  const payOptions = usePaymentOptions(status === "authenticated");
  const payForm = useSavedPayment(payOptions.options, status === "authenticated");
  const { option, phone } = payForm;
  const refusal = useChargeRefusal(payOptions.applyOffered);
  const [busy, setBusy] = useState(false);
  /**
   * `null` follows the booking (a `pending` one resumes the wait); `"form"` is
   * the customer asking to try again, which shows the form whatever it says.
   */
  const [watch, setWatch] = useState<Watch | "form" | null>(null);
  /** Remounts the check screen for each new attempt, so its state starts clean. */
  const [attempt, setAttempt] = useState(0);

  const begin = useCallback((next: Watch) => {
    setAttempt((n) => n + 1);
    setWatch(next);
  }, []);

  const start = useCallback(async () => {
    const charge = option ? chargeRequest(option, phone) : null;
    if (!charge) return;
    setBusy(true);
    try {
      const payment = await payBooking(bookingId, charge);
      const base = { transactionId: payment.transactionId, phone: phone || null, otp: false, reason: null };
      if (isSettledFailure(payment.status)) {
        // Refused on the spot — nothing to wait for, and the provider's own
        // reason is worth more than a generic apology.
        begin({ ...base, ussd: null, note: null, redirectUrl: null, initialPhase: "failed", reason: payment.message ?? null });
        return;
      }
      const step = nextPaymentStep(payment.instructions);
      if (step.kind === "card") {
        router.push(await cardPagePath(payment.transactionId));
        return;
      }
      begin({
        ...base,
        ussd: payment.instructions?.ussdCode ?? null,
        note: payment.instructions?.message ?? null,
        redirectUrl: step.kind === "redirect" ? step.url : null,
        otp: step.kind === "otp",
        initialPhase: "checking",
      });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === "PAYMENT_BOOKING_IN_PROGRESS") {
        // An attempt is already live — check it rather than refuse.
        begin(RESUMED);
        return;
      }
      if (code === "PAYMENT_BOOKING_ALREADY_PAID") {
        booking.reload();
        return;
      }
      // A provider refusal wrote nothing; the form stays, and says what to fix.
      flash(
        refusal(err) ??
          (code === "BOOKING_UNAUTHORIZED" ? t("ownBookingsOnly") : t("payStartFailed")),
      );
    } finally {
      setBusy(false);
    }
  }, [bookingId, option, phone, flash, t, router, refusal, begin, booking]);

  const b = booking.data;
  const active: Watch | null =
    watch && watch !== "form" ? watch : watch === null && b?.paymentStatus === "pending" ? RESUMED : null;

  const transactionId = active?.transactionId ?? null;
  const check = useCallback(async (): Promise<PaymentVerdict> => {
    let tx = transactionId;
    if (!tx) {
      // Started elsewhere: the booking knows which transaction is live.
      const state = await getBookingPaymentStatus(bookingId);
      const verdict = verdictOf(state.paymentStatus);
      if (verdict !== "pending") return verdict;
      tx = state.transaction?.id ?? null;
    }
    if (tx) {
      try {
        // Asks the gateway, and settles the booking when the money is there.
        const result = await verifyPayment(tx);
        if (result.status === "SUCCEEDED") return "paid";
        if (result.status === "FAILED" || result.status === "CANCELLED") return "failed";
      } catch {
        /* the booking read below still answers */
      }
    }
    return verdictOf((await getBookingPaymentStatus(bookingId)).paymentStatus);
  }, [bookingId, transactionId]);

  if (status === "loading" || booking.status === "loading") {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-6 sm:px-6">
        <Skeleton height={220} />
      </div>
    );
  }

  if (!b || !b.requiresPayment) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-6 sm:px-6">
        <p style={{ fontSize: 14.5 }}>{t("nothingToPay")}</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.push(bookingPath(bookingId))}
        >
          {t("backToBooking")}
        </Button>
      </div>
    );
  }

  const amount = formatMoney(b.priceSnapshot, b.currency);
  const title = b.product?.title ?? t("serviceFallback");
  const when = format.dateTimeRange(new Date(b.startAt), new Date(b.endAt), {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const summary = { kind: "booking" as const, bookingId, amount, title, when, reference: b.bookingNumber };

  // Already paid — back from the card page, or an old link. Say so plainly.
  if (b.paymentStatus === "paid" && !active) {
    return (
      <BookingPaymentCheck
        {...summary}
        initialPhase="paid"
        check={check}
        onRetry={() => router.push(bookingPath(bookingId))}
      />
    );
  }

  if (active) {
    return (
      <BookingPaymentCheck
        key={attempt}
        {...summary}
        phone={active.phone}
        ussd={active.ussd}
        note={active.note}
        redirectUrl={active.redirectUrl}
        otpFor={active.otp ? active.transactionId : null}
        initialPhase={active.initialPhase}
        initialReason={active.reason}
        check={check}
        onRetry={() => {
          setWatch("form");
          booking.reload();
        }}
      />
    );
  }

  // `payForm.ready` joins the gate: a saved wallet number that lands after the
  // picker mounts arrives as an edit, and the operator detection overrides the
  // rail it came from. See `useSavedPayment`. It never turns true when
  // `/options` failed, so that case is let through to its retry.
  if (!payForm.ready && !payOptions.failed) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-6 sm:px-6">
        <Skeleton height={220} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px] px-4 py-6 sm:px-6">
      <h1 className="sr-only">{t("payTitle")}</h1>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 26, fontWeight: 800 }}>{amount}</div>
        <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
          {title} ·{" "}
          {format.dateTime(new Date(b.startAt), {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>

      {payOptions.failed ? (
        <OptionsLoadFailed onRetry={payOptions.reload} />
      ) : !option || !payOptions.options ? (
        <OnlinePaymentUnavailable />
      ) : (
        <>
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

          <div style={{ marginTop: 16 }}>
            <Button
              block
              size="lg"
              elevated
              disabled={busy || !paymentReady(option, phone)}
              onClick={() => void start()}
            >
              {busy ? t("starting") : t("payAmount", { amount })}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
