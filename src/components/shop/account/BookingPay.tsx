"use client";

import { useFormatter, useTranslations } from "next-intl";

import { useCallback, useEffect, useState } from "react";
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
import { PaymentOtpStep, PaymentRedirectPrompt } from "@/components/shop/PaymentSteps";
import { usePaymentOptions } from "@/components/shop/usePaymentOptions";
import { useSavedPayment } from "@/components/shop/useSavedPayment";
import { useChargeRefusal } from "@/components/shop/useChargeRefusal";
import { cardPagePath } from "@/lib/shop/pay-link.api";
import { isSettledFailure, nextPaymentStep } from "@/lib/shop/payments.api";
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
 * The choices are `GET /api/payments/options`, as at checkout, and the same
 * `{ provider, channel }` body goes out. What happens next is read off the
 * answer's `instructions`: an SMS code step, a page to open, the hosted card
 * page, or — the usual case — "approve the prompt on your phone".
 */
export function BookingPay({ bookingId }: { bookingId: string }) {
  // Bound above the guards below — this screen has four render branches, so a
  // hook after an early return would change the hook order between renders.
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
  const [waiting, setWaiting] = useState(false);
  /** A code step is open for this transaction. */
  const [otpFor, setOtpFor] = useState<string | null>(null);
  /** The payment continues on this page; the poll below still runs. */
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  const start = useCallback(async () => {
    const charge = option ? chargeRequest(option, phone) : null;
    if (!charge) return;
    setBusy(true);
    try {
      const payment = await payBooking(bookingId, charge);
      if (isSettledFailure(payment.status)) {
        flash(t("paymentFailed"));
        return;
      }
      const step = nextPaymentStep(payment.instructions);
      if (step.kind === "card") {
        router.push(await cardPagePath(payment.transactionId));
        return;
      }
      if (step.kind === "otp") {
        setOtpFor(payment.transactionId);
        return;
      }
      if (step.kind === "redirect") setRedirectUrl(step.url);
      setWaiting(true);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      // A provider refusal wrote nothing; the form stays, and says what to fix.
      flash(
        refusal(err) ??
          (code === "BOOKING_UNAUTHORIZED" ? t("ownBookingsOnly") : t("payStartFailed")),
      );
    } finally {
      setBusy(false);
    }
  }, [bookingId, option, phone, flash, t, router, refusal]);

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
          flash(state.paymentStatus === "paid" ? t("paymentReceived") : t("paymentFailed"));
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
  }, [waiting, bookingId, router, flash, t]);

  // `payForm.ready` joins the gate: a saved wallet number that lands after the
  // picker mounts arrives as an edit, and the operator detection overrides the
  // rail it came from. See `useSavedPayment`. It never turns true when
  // `/options` failed, so that case is let through to its retry.
  if (
    status === "loading" ||
    booking.status === "loading" ||
    (!payForm.ready && !payOptions.failed)
  ) {
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

  if (otpFor) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-6 sm:px-6">
        <h1 className="sr-only">{t("payTitle")}</h1>
        <PaymentOtpStep
          transactionId={otpFor}
          onAuthorized={() => {
            setOtpFor(null);
            setWaiting(true);
          }}
          onRestart={(reason) => {
            // The transaction failed on too many wrong codes. Back to the
            // form, which starts a fresh one.
            setOtpFor(null);
            flash(reason);
          }}
        />
      </div>
    );
  }

  if (waiting) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-6 sm:px-6">
        <h1 className="sr-only">{t("waitingTitle")}</h1>
        {redirectUrl ? (
          <PaymentRedirectPrompt url={redirectUrl} />
        ) : (
          <>
            <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>{t("checkPhoneTitle")}</p>
            <p className="muted" style={{ fontSize: 13.5 }}>
              {t("approvePrompt", { phone: phone || t("yourHandset") })}
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px] px-4 py-6 sm:px-6">
      <h1 className="sr-only">{t("payTitle")}</h1>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 26, fontWeight: 800 }}>
          {formatMoney(b.priceSnapshot, b.currency)}
        </div>
        <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
          {b.product?.title ?? t("serviceFallback")} ·{" "}
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
              {busy
                ? t("starting")
                : t("payAmount", { amount: formatMoney(b.priceSnapshot, b.currency) })}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
