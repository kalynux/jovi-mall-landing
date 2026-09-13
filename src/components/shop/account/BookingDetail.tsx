"use client";

import { useFormatter, useTranslations } from "next-intl";

import { useCallback, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { Badge, Button, ConfirmDialog, Skeleton } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { useApiResource } from "@/lib/shop/useApiResource";
import { formatMoney } from "@/lib/shop/format";
import { ApiError } from "@/lib/auth/auth.types";
import {
  BOOKING_PAYMENT_LABEL,
  BOOKING_STATUS_LABEL,
  cancelBooking,
  getBooking,
  getBookingBalance,
  type BookingBalance,
} from "@/lib/shop/bookings.api";
import {
  BOOKING_LIST,
  bookingBalancePath,
  bookingPayPath,
  bookingReschedulePath,
} from "@/lib/shop/shop.routes";
import { ReviewDisclosure } from "./ReviewForm";

/**
 * One appointment.
 *
 * ── The balance is the part worth getting right ──────────────────────────────
 *
 * A service can run longer, or cost more, than the slot booked, and when the
 * provider settles above what was paid the difference becomes a balance that is
 * **never charged automatically** — the customer agreed to the quoted price, not
 * to whatever is settled afterwards. So it is shown as something to act on, not
 * as a debt already taken.
 *
 * The mirror case is `creditDue`: the provider settled *below* what was paid.
 * That is **recorded, not refunded** — usually a goodwill discount they intend
 * to hand back themselves — so it says so rather than implying money is coming.
 */
export function BookingDetail({ bookingId }: { bookingId: string }) {
  // ⚠ BOTH TRANSLATORS ARE BOUND HERE, ABOVE THE GUARDS BELOW, AND THAT
  //   POSITION IS THE POINT.
  //   `tKey` used to sit after the early returns, which is a real rules-of-hooks
  //   violation rather than a style one: this component renders a skeleton while
  //   loading, then a "not found" branch, then the full view — so the number of
  //   hooks React saw CHANGED between renders as the data arrived. React matches
  //   hooks by call order, so the first render after loading finishes can read
  //   another hook's state, and the symptom is a crash or wrong state on a
  //   screen that worked a moment earlier.
  //
  //   `tKey` is root-scoped, for the absolute keys the lib modules emit
  //   (`shop.status.booking.…`) and the screen title in `shop.nav`.
  const t = useTranslations("shop.bookings");
  const tKey = useTranslations();
  // Dates are formatted against the app's locale, never the browser's. §6.
  const format = useFormatter();
  const router = useRouter();
  const { flash } = useToast();
  const { status: authStatus } = useAuthGuard();

  const booking = useApiResource(() => getBooking(bookingId), [bookingId, authStatus]);

  // `409 BOOKING_NOT_COMPLETED` until the appointment is settled, which is the
  // normal case — so a failure here is silence, not an error.
  const balance = useApiResource<BookingBalance | null>(
    () => getBookingBalance(bookingId).catch(() => null),
    [bookingId, authStatus],
  );

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [busy, setBusy] = useState(false);

  const cancel = useCallback(async () => {
    setConfirmCancel(false);
    setBusy(true);
    try {
      await cancelBooking(bookingId);
      booking.reload();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      flash(
        code === "CANCELLATION_NOT_ALLOWED"
          ? t("cancelWindowPassed")
          : code === "BOOKING_NOT_CANCELLABLE"
            ? t("notCancellable")
            : code === "BOOKING_ALREADY_CANCELLED"
              ? t("alreadyCancelled")
              : t("cancelFailed"),
      );
    } finally {
      setBusy(false);
    }
  }, [bookingId, booking, flash, t]);

  if (authStatus === "loading" || booking.status === "loading") {
    return (
      <div className="mx-auto max-w-[680px] px-4 py-6 sm:px-6">
        <Skeleton height={200} />
      </div>
    );
  }

  const b = booking.data;
  if (!b) {
    return (
      <div className="mx-auto max-w-[680px] px-4 py-6 sm:px-6">
        <p className="muted">{t("notFound")}</p>
        <Button variant="secondary" size="sm" onClick={() => router.push(BOOKING_LIST)}>
          {t("backToList")}
        </Button>
      </div>
    );
  }

  const state = BOOKING_STATUS_LABEL[b.status];
  const pay = BOOKING_PAYMENT_LABEL[b.paymentStatus];
  const cancellable = b.status === "pending" || b.status === "confirmed";
  const bal = balance.data;

  return (
    <div className="mx-auto max-w-[680px] px-4 py-6 sm:px-6">
      <h1 className="sr-only">{tKey("shop.nav.titles.booking")}</h1>

      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {state && (
          <Badge size="sm" tone={state.tone}>
            {tKey(state.labelKey)}
          </Badge>
        )}
        {pay && (
          <Badge size="sm" tone={pay.tone}>
            {tKey(pay.labelKey)}
          </Badge>
        )}
      </div>

      <div style={{ fontSize: 19, fontWeight: 800 }}>
        {b.product?.title ?? t("serviceFallback")}
      </div>
      {b.vendor?.name && (
        <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
          {t("withVendor", { vendor: b.vendor.name })}
        </div>
      )}
      {/*
          The reference to quote. It is the vendor's handle for this booking too,
          which is the whole reason it is on the detail screen rather than only
          in a confirmation email. Omitted when null — bookings predate the
          field, and "#" on its own tells nobody anything. */}
      {b.bookingNumber && (
        <div
          className="muted"
          style={{ fontSize: 12.5, marginTop: 4, fontVariantNumeric: "tabular-nums" }}
        >
          {b.bookingNumber}
        </div>
      )}

      <dl style={{ margin: "14px 0", display: "grid", gap: 8 }}>
        {/* `dateTimeRange` rather than two formatted dates glued with a dash:
            it collapses a same-day appointment the way each locale does it, and
            the separator is not ours to hard-code. */}
        <Row
          label={t("when")}
          value={format.dateTimeRange(new Date(b.startAt), new Date(b.endAt), {
            weekday: "long",
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          })}
        />
        <Row label={t("price")} value={formatMoney(b.priceSnapshot, b.currency)} />
        {typeof b.metadata?.notes === "string" && b.metadata.notes && (
          <Row label={t("yourNote")} value={b.metadata.notes} />
        )}
      </dl>

      {/* `refund_pending` is not `refunded` — the gateway could not return the
          money automatically and a person is completing the payout. Saying
          "refunded" here would tell a customer they have been repaid when they
          have not. */}
      {b.paymentStatus === "refund_pending" && (
        <p style={{ fontSize: 13.5, margin: "0 0 12px" }}>{t("refundByHand")}</p>
      )}

      {bal && bal.outstanding > 0 && (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: 14,
            marginBottom: 12,
          }}
        >
          {/* The amounts go through `formatMoney` and into the message as
              VALUES. They carry bidi isolate marks, so they survive an Arabic
              paragraph — which rebuilding the sentence from fragments would
              not. */}
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>
            {t("stillToPay", { amount: formatMoney(bal.outstanding, bal.currency) })}
          </div>
          <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
            {t("settledAbove", {
              final: formatMoney(bal.finalPrice, bal.currency),
              quoted: formatMoney(bal.quotedPrice, bal.currency),
            })}
          </p>
          <Button
            size="sm"
            onClick={() => router.push(bookingBalancePath(bookingId))}
          >
            {t("payBalance")}
          </Button>
        </div>
      )}

      {/* Recorded, not refunded — no automatic payout is issued, so this must
          not read as money on its way back. */}
      {bal && bal.creditDue > 0 && (
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          {t("creditRecorded", { amount: formatMoney(bal.creditDue, bal.currency) })}
        </p>
      )}

      {/* A booking is created `unpaid` — paying is a separate step, and until it
          happens a `confirmed` booking is swept and auto-cancelled after a
          grace period. A `pending` one is never swept, because waiting on the
          vendor is not the customer's fault. */}
      {b.requiresPayment && (b.paymentStatus === "unpaid" || b.paymentStatus === "failed") && (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: 14,
            marginBottom: 12,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>
            {t("toPay", { amount: formatMoney(b.priceSnapshot, b.currency) })}
          </div>
          <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
            {b.status === "confirmed" ? t("heldPayToKeep") : t("payAfterAccepted")}
          </p>
          <Button
            size="sm"
            disabled={b.status !== "confirmed"}
            onClick={() => router.push(bookingPayPath(bookingId))}
          >
            {t("payNow")}
          </Button>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {cancellable && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push(bookingReschedulePath(bookingId))}
          >
            {t("moveToAnotherTime")}
          </Button>
        )}
        {cancellable && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmCancel(true)}>
            {t("cancelBooking")}
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => router.push(BOOKING_LIST)}>
          {t("allBookings")}
        </Button>
      </div>

      {/* A completed appointment is a product the customer received. The
          eligibility read inside decides whether the form actually draws. */}
      {b.status === "completed" && b.product?.id && (
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border-subtle)" }}>
          <ReviewDisclosure
            subjectType="product"
            subjectId={b.product.id}
            label={b.product.title}
          />
        </div>
      )}

      <ConfirmDialog
        open={confirmCancel}
        title={t("confirmCancelTitle")}
        tone="danger"
        icon="calendar-clock"
        confirmLabel={t("confirmCancelAction")}
        cancelLabel={t("keepIt")}
        onConfirm={() => void cancel()}
        onCancel={() => setConfirmCancel(false)}
      >
        {b.paymentStatus === "paid" ? t("confirmCancelPaid") : t("confirmCancelUnpaid")}
      </ConfirmDialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", gap: 12, fontSize: 14 }}>
      <dt className="muted" style={{ minWidth: 90 }}>
        {label}
      </dt>
      <dd style={{ margin: 0 }}>{value}</dd>
    </div>
  );
}
