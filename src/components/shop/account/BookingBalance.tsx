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
import { settledBalanceOwed } from "@/lib/shop/booking-pricing";
import { getBooking, getBookingBalance, payBookingBalance } from "@/lib/shop/bookings.api";
import { cardPagePath } from "@/lib/shop/pay-link.api";
import { amountOutsideLimits, handsetStepOf, type HandsetStep } from "@/lib/shop/mobile-money";
import { PaymentLimitNote } from "@/components/shop/PaymentSteps";
import { isSettledFailure, nextPaymentStep, verifyPayment } from "@/lib/shop/payments.api";
import { bookingPath } from "@/lib/shop/shop.routes";
import { BookingPaymentCheck, type PaymentVerdict } from "./BookingPaymentCheck";

/** One balance attempt this screen started. */
interface Watch {
  transactionId: string;
  amount: string;
  /** This attempt pays a price difference, not a settled balance. */
  topup: boolean;
  phone: string | null;
  ussd: string | null;
  note: string | null;
  handset: HandsetStep | null;
  redirectUrl: string | null;
  otp: boolean;
  initialPhase: "checking" | "failed";
  reason: string | null;
}

/**
 * Pay what is still owed on a completed booking.
 *
 * ── Why this is a page and not an automatic charge ───────────────────────────
 *
 * The customer agreed to the **quoted** price. When the provider settles the
 * appointment above it — the service ran long, or cost more — the difference is
 * a balance, and the platform deliberately never charges it on its own. Paying
 * it is the customer's action, which is what this page is.
 *
 * ── What is offered ──────────────────────────────────────────────────────────
 *
 * What `GET /api/payments/options` lists now — re-read here rather than reusing
 * the first payment's choice, which may have been switched off since. `COD` has
 * no meaning here: there is no courier and nothing to hand over, and the
 * alternative to paying online is settling with the provider directly, which
 * they record themselves.
 *
 * ── The wait ─────────────────────────────────────────────────────────────────
 *
 * The same `BookingPaymentCheck` as the first payment. It used to hand straight
 * back to the booking with a toast, so a customer never learned whether the
 * balance went through. Each check asks the gateway, then the balance: once
 * `outstanding` reaches zero, it is paid.
 *
 * ── The same route pays a price difference ───────────────────────────────────
 *
 * When `pricing.topup` is set the agreed price went up on a booking already paid,
 * and this page charges that, for `pricing.topup.amount`, usually before the
 * appointment has happened. Nothing has been settled then and `finalPrice` is
 * `null`, so it says what is owed and by when instead. A difference is charged
 * ahead of any settled balance, so it is what the page offers while both exist.
 */
export function BookingBalance({ bookingId }: { bookingId: string }) {
  // Bound above the guards below — this screen has several render branches, so
  // a hook after an early return would change the hook order between renders.
  const t = useTranslations("shop.bookings");
  // Root-scoped, for the screen title Phase 1 put in `shop.nav`.
  const tKey = useTranslations();
  const format = useFormatter();
  const router = useRouter();
  const { flash } = useToast();
  const { status } = useAuthGuard();

  const balance = useApiResource(() => getBookingBalance(bookingId), [bookingId, status]);
  // Only for what the check screen names — the service and its time. A failed
  // read costs the summary its title, never the payment.
  const booking = useApiResource(
    () => getBooking(bookingId).catch(() => null),
    [bookingId, status],
  );

  const payOptions = usePaymentOptions(status === "authenticated");
  const payForm = useSavedPayment(payOptions.options, status === "authenticated");
  const { option, phone } = payForm;
  const refusal = useChargeRefusal(payOptions.applyOffered);
  const [busy, setBusy] = useState(false);
  const [watch, setWatch] = useState<Watch | null>(null);
  /** Remounts the check screen for each new attempt, so its state starts clean. */
  const [attempt, setAttempt] = useState(0);

  // `pricing.topup` decides, and `topupDue` only stands in when the booking read
  // failed. The balance read keeps counting a difference on a cancelled booking,
  // where `pricing.topup` is rightly null.
  const read = booking.data;
  const owedTopup = read?.pricing
    ? (read.pricing.topup?.amount ?? 0)
    : read
      ? 0
      : (balance.data?.topupDue ?? 0);
  const owed = owedTopup > 0 ? owedTopup : balance.data ? settledBalanceOwed(balance.data) : 0;

  const pay = useCallback(async () => {
    const charge = option ? chargeRequest(option, phone) : null;
    const bal = balance.data;
    if (!charge || !bal) return;
    setBusy(true);
    try {
      const payment = await payBookingBalance(bookingId, charge);
      const base = {
        transactionId: payment.transactionId,
        amount: formatMoney(owed, bal.currency),
        topup: owedTopup > 0,
        phone: phone || null,
        reason: null,
      };
      if (isSettledFailure(payment.status)) {
        setAttempt((n) => n + 1);
        setWatch({
          ...base,
          ussd: null,
          note: null,
          handset: null,
          redirectUrl: null,
          otp: false,
          initialPhase: "failed",
          reason: payment.message ?? null,
        });
        return;
      }
      const step = nextPaymentStep(payment.instructions);
      if (step.kind === "card") {
        router.push(await cardPagePath(payment.transactionId));
        return;
      }
      setAttempt((n) => n + 1);
      setWatch({
        ...base,
        ussd: payment.instructions?.ussdCode ?? null,
        note: payment.instructions?.message ?? null,
        handset: handsetStepOf(payment.instructions, payment.provider ?? charge.provider),
        redirectUrl: step.kind === "redirect" ? step.url : null,
        otp: step.kind === "otp",
        initialPhase: "checking",
      });
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      flash(
        // A provider refusal wrote nothing; the form stays, and says what to fix.
        refusal(err) ??
          (code === "BOOKING_NO_BALANCE_DUE"
            ? t("nothingLeftToPay")
            : code === "BOOKING_BALANCE_ALREADY_SETTLED"
              ? t("balanceSettled")
              : code === "BOOKING_NOT_COMPLETED"
                ? t("notCompleted")
                : code === "PAYMENT_BOOKING_IN_PROGRESS"
                  ? t("proposal.paymentInFlight")
                  : t("payStartFailed")),
      );
    } finally {
      setBusy(false);
    }
  }, [bookingId, option, phone, flash, router, t, refusal, balance.data, owed, owedTopup]);

  const transactionId = watch?.transactionId ?? null;
  const watchingTopup = watch?.topup ?? false;
  const check = useCallback(async (): Promise<PaymentVerdict> => {
    if (transactionId) {
      try {
        // Asks the gateway, and settles the balance when the money is there.
        const result = await verifyPayment(transactionId);
        if (result.status === "SUCCEEDED") return "paid";
        if (result.status === "FAILED" || result.status === "CANCELLED") return "failed";
      } catch {
        /* the balance read below still answers */
      }
    }
    try {
      const now = await getBookingBalance(bookingId);
      // A difference is paid when it is gone, even with a settled balance still open.
      return (watchingTopup ? (now.topupDue ?? 0) : now.outstanding) <= 0 ? "paid" : "pending";
    } catch (err) {
      // Once settled, the balance read can refuse rather than answer zero.
      const code = err instanceof ApiError ? err.code : undefined;
      if (code === "BOOKING_NO_BALANCE_DUE" || code === "BOOKING_BALANCE_ALREADY_SETTLED") return "paid";
      throw err;
    }
  }, [bookingId, transactionId, watchingTopup]);

  if (
    !watch &&
    (status === "loading" ||
      balance.status === "loading" ||
      // The page's copy and its amount both turn on `pricing.topup`.
      booking.status === "loading" ||
      (status === "authenticated" && !payForm.ready && !payOptions.failed))
  ) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-6 sm:px-6">
        <Skeleton height={220} />
      </div>
    );
  }

  const b = booking.data;

  if (watch) {
    return (
      <BookingPaymentCheck
        key={attempt}
        kind={watch.topup ? "topup" : "balance"}
        bookingId={bookingId}
        amount={watch.amount}
        title={b?.product?.title ?? t("serviceFallback")}
        when={
          b
            ? format.dateTimeRange(new Date(b.startAt), new Date(b.endAt), {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : null
        }
        reference={b?.bookingNumber ?? null}
        phone={watch.phone}
        ussd={watch.ussd}
        note={watch.note}
        handset={watch.handset}
        redirectUrl={watch.redirectUrl}
        otpFor={watch.otp ? watch.transactionId : null}
        initialPhase={watch.initialPhase}
        initialReason={watch.reason}
        check={check}
        onRetry={() => {
          setWatch(null);
          balance.reload();
        }}
      />
    );
  }

  const bal = balance.data;

  // `409 BOOKING_NOT_COMPLETED` and `400 BOOKING_NO_BALANCE_DUE` both land here.
  if (!bal || owed <= 0) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-6 sm:px-6">
        <p style={{ fontSize: 14.5 }}>{t("nothingLeftToPay")}</p>
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

  const topup = b?.pricing?.topup ?? null;
  const outsideLimits = amountOutsideLimits(owed, bal.currency, option?.limits);

  return (
    <div className="mx-auto max-w-[560px] px-4 py-6 sm:px-6">
      <h1 className="sr-only">{tKey("shop.nav.titles.bookingBalance")}</h1>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 26, fontWeight: 800 }}>{formatMoney(owed, bal.currency)}</div>
        {owedTopup > 0 ? (
          <>
            {b?.pricing && (
              <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
                {t("topup.agreedAndPaid", {
                  price: formatMoney(b.pricing.currentPrice, bal.currency),
                  paid: formatMoney(b.pricing.amountPaid, bal.currency),
                })}
              </p>
            )}
            {topup && (
              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--text-strong)", margin: "4px 0 0" }}>
                {t("topup.dueBy", {
                  time: format.dateTime(new Date(topup.dueAt), {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  }),
                })}
              </p>
            )}
          </>
        ) : (
          bal.finalPrice !== null && (
            // Two whole phrases joined by a bullet, not one sentence split across
            // three fragments: the amounts go in as values, and the optional
            // "already paid" clause is a complete phrase of its own.
            <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
              {t("quotedSettled", {
                quoted: formatMoney(bal.quotedPrice, bal.currency),
                final: formatMoney(bal.finalPrice, bal.currency),
              })}
              {bal.balancePaid > 0 &&
                ` · ${t("alreadyPaid", { amount: formatMoney(bal.balancePaid, bal.currency) })}`}
            </p>
          )
        )}
      </div>

      {payOptions.failed ? (
        <OptionsLoadFailed onRetry={payOptions.reload} />
      ) : option && payOptions.options ? (
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
        <OnlinePaymentUnavailable />
      )}

      {outsideLimits && <PaymentLimitNote amount={owed} currency={bal.currency} limits={option?.limits} />}

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {option && (
          <Button
            block
            size="lg"
            elevated
            disabled={busy || outsideLimits || !paymentReady(option, phone)}
            onClick={() => void pay()}
          >
            {busy ? t("starting") : t("payAmount", { amount: formatMoney(owed, bal.currency) })}
          </Button>
        )}

        {/* The other way to settle, said plainly — the provider records it and
            the balance closes, so nobody has to pay online who would rather not. */}
        <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
          {t("payProviderDirectly")}
        </p>
      </div>
    </div>
  );
}
