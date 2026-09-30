"use client";

import { useTranslations } from "next-intl";

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
import { PaymentOtpStep, PaymentRedirectPrompt } from "@/components/shop/PaymentSteps";
import { usePaymentOptions } from "@/components/shop/usePaymentOptions";
import { useSavedPayment } from "@/components/shop/useSavedPayment";
import { useChargeRefusal } from "@/components/shop/useChargeRefusal";
import { getBookingBalance, payBookingBalance } from "@/lib/shop/bookings.api";
import { cardPagePath } from "@/lib/shop/pay-link.api";
import { isSettledFailure, nextPaymentStep } from "@/lib/shop/payments.api";
import { bookingPath } from "@/lib/shop/shop.routes";

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
 */
export function BookingBalance({ bookingId }: { bookingId: string }) {
  // Bound above the guards below — this screen has three render branches, so a
  // hook after an early return would change the hook order between renders.
  const t = useTranslations("shop.bookings");
  // Root-scoped, for the screen title Phase 1 put in `shop.nav`.
  const tKey = useTranslations();
  const router = useRouter();
  const { flash } = useToast();
  const { status } = useAuthGuard();

  const balance = useApiResource(() => getBookingBalance(bookingId), [bookingId, status]);

  const payOptions = usePaymentOptions(status === "authenticated");
  const payForm = useSavedPayment(payOptions.options, status === "authenticated");
  const { option, phone } = payForm;
  const refusal = useChargeRefusal(payOptions.applyOffered);
  const [busy, setBusy] = useState(false);
  /** A code step is open for this transaction. */
  const [otpFor, setOtpFor] = useState<string | null>(null);
  /** The payment continues on this page. */
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  const handBack = useCallback(() => {
    flash(t("checkYourPhone"));
    router.push(bookingPath(bookingId));
  }, [bookingId, flash, router, t]);

  const pay = useCallback(async () => {
    const charge = option ? chargeRequest(option, phone) : null;
    if (!charge) return;
    setBusy(true);
    try {
      const payment = await payBookingBalance(bookingId, charge);
      if (isSettledFailure(payment.status)) {
        flash(t("payStartFailed"));
        return;
      }
      const step = nextPaymentStep(payment.instructions);
      if (step.kind === "card") router.push(await cardPagePath(payment.transactionId));
      else if (step.kind === "otp") setOtpFor(payment.transactionId);
      else if (step.kind === "redirect") setRedirectUrl(step.url);
      else handBack();
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
                : t("payStartFailed")),
      );
    } finally {
      setBusy(false);
    }
  }, [bookingId, option, phone, flash, router, t, refusal, handBack]);

  if (
    status === "loading" ||
    balance.status === "loading" ||
    (status === "authenticated" && !payForm.ready && !payOptions.failed)
  ) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-6 sm:px-6">
        <Skeleton height={220} />
      </div>
    );
  }

  const bal = balance.data;

  // `409 BOOKING_NOT_COMPLETED` and `400 BOOKING_NO_BALANCE_DUE` both land here.
  if (!bal || bal.outstanding <= 0) {
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

  if (otpFor || redirectUrl) {
    return (
      <div className="mx-auto max-w-[560px] px-4 py-6 sm:px-6">
        <h1 className="sr-only">{tKey("shop.nav.titles.bookingBalance")}</h1>
        {otpFor ? (
          <PaymentOtpStep
            transactionId={otpFor}
            onAuthorized={handBack}
            onRestart={(reason) => {
              setOtpFor(null);
              flash(reason);
            }}
          />
        ) : (
          redirectUrl && <PaymentRedirectPrompt url={redirectUrl} />
        )}
        {redirectUrl && (
          <div style={{ marginTop: 12 }}>
            <Button block variant="secondary" onClick={() => router.push(bookingPath(bookingId))}>
              {t("backToBooking")}
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px] px-4 py-6 sm:px-6">
      <h1 className="sr-only">{tKey("shop.nav.titles.bookingBalance")}</h1>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 26, fontWeight: 800 }}>
          {formatMoney(bal.outstanding, bal.currency)}
        </div>
        {/* Two whole phrases joined by a bullet, not one sentence split across
            three fragments: the amounts go in as values, and the optional
            "already paid" clause is a complete phrase of its own. */}
        <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
          {t("quotedSettled", {
            quoted: formatMoney(bal.quotedPrice, bal.currency),
            final: formatMoney(bal.finalPrice, bal.currency),
          })}
          {bal.balancePaid > 0 &&
            ` · ${t("alreadyPaid", { amount: formatMoney(bal.balancePaid, bal.currency) })}`}
        </p>
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

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        {option && (
          <Button
            block
            size="lg"
            elevated
            disabled={busy || !paymentReady(option, phone)}
            onClick={() => void pay()}
          >
            {busy
              ? t("starting")
              : t("payAmount", { amount: formatMoney(bal.outstanding, bal.currency) })}
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
