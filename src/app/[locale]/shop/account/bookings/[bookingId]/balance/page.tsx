"use client";

import { use, useCallback, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Button, Skeleton } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { useApiResource } from "@/lib/shop/useApiResource";
import { formatMoney } from "@/lib/shop/format";
import { ApiError } from "@/lib/auth/auth.types";
import {
  MOBILE_MONEY_OPTIONS,
  MTN,
  paymentChannel,
  PaymentMethodPicker,
  paymentReady,
  type PaymentOption,
} from "@/components/shop/PaymentMethodPicker";
import { getBookingBalance, payBookingBalance } from "@/lib/shop/bookings.api";

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
 * ── Cash and card are not offered ────────────────────────────────────────────
 *
 * `COD` has no meaning here: there is no courier and nothing to hand over, and
 * the alternative to paying online is settling with the provider directly, which
 * they record themselves. Card is left out for the same reason checkout treats
 * it as secondary — the two mobile-money rails are the ones proven end to end in
 * this market.
 */
export default function BookingBalancePage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = use(params);
  const router = useRouter();
  const { flash } = useToast();
  const { status } = useAuthGuard();

  const balance = useApiResource(() => getBookingBalance(bookingId), [bookingId, status]);

  const [option, setOption] = useState<PaymentOption>(MTN);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  const pay = useCallback(async () => {
    setBusy(true);
    try {
      await payBookingBalance(bookingId, option.gateway, paymentChannel(option, phone));
      flash("Check your phone to approve the payment.");
      router.push(`/shop/account/bookings/${bookingId}`);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      flash(
        code === "BOOKING_NO_BALANCE_DUE"
          ? "There is nothing left to pay on this booking."
          : code === "BOOKING_BALANCE_ALREADY_SETTLED"
            ? "This balance has already been settled."
            : code === "BOOKING_NOT_COMPLETED"
              ? "This appointment has not been settled by the seller yet."
              : "Could not start that payment. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }, [bookingId, option, phone, flash, router]);

  if (status === "loading" || balance.status === "loading") {
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
        <p style={{ fontSize: 14.5 }}>There is nothing left to pay on this booking.</p>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => router.push(`/shop/account/bookings/${bookingId}`)}
        >
          Back to the booking
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[560px] px-4 py-6 sm:px-6">
      <h1 className="sr-only">Pay the balance</h1>

      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 26, fontWeight: 800 }}>
          {formatMoney(bal.outstanding, bal.currency)}
        </div>
        <p className="muted" style={{ fontSize: 13, margin: "4px 0 0" }}>
          Quoted {formatMoney(bal.quotedPrice, bal.currency)} · settled at{" "}
          {formatMoney(bal.finalPrice, bal.currency)}
          {bal.balancePaid > 0 && ` · ${formatMoney(bal.balancePaid, bal.currency)} already paid`}
        </p>
      </div>

      <PaymentMethodPicker
        options={MOBILE_MONEY_OPTIONS}
        value={option}
        onChange={setOption}
        phone={phone}
        onPhoneChange={setPhone}
        disabled={busy}
      />

      <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
        <Button
          block
          size="lg"
          elevated
          disabled={busy || !paymentReady(option, phone)}
          onClick={() => void pay()}
        >
          {busy ? "Starting…" : `Pay ${formatMoney(bal.outstanding, bal.currency)}`}
        </Button>

        {/* The other way to settle, said plainly — the provider records it and
            the balance closes, so nobody has to pay online who would rather not. */}
        <p className="muted" style={{ fontSize: 12.5, margin: 0 }}>
          You can also pay the provider directly and they will record it.
        </p>
      </div>
    </div>
  );
}
