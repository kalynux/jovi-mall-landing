"use client";

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
          ? "The seller's cancellation window for this booking has passed."
          : code === "BOOKING_NOT_CANCELLABLE"
            ? "This booking can no longer be cancelled."
            : code === "BOOKING_ALREADY_CANCELLED"
              ? "This booking is already cancelled."
              : "Could not cancel that booking.",
      );
    } finally {
      setBusy(false);
    }
  }, [bookingId, booking, flash]);

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
        <p className="muted">That booking could not be found.</p>
        <Button variant="secondary" size="sm" onClick={() => router.push(BOOKING_LIST)}>
          Back to bookings
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
      <h1 className="sr-only">Booking</h1>

      <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
        {state && (
          <Badge size="sm" tone={state.tone}>
            {state.label}
          </Badge>
        )}
        {pay && (
          <Badge size="sm" tone={pay.tone}>
            {pay.label}
          </Badge>
        )}
      </div>

      <div style={{ fontSize: 19, fontWeight: 800 }}>{b.product?.title ?? "Service"}</div>
      {b.vendor?.name && (
        <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
          with {b.vendor.name}
        </div>
      )}

      <dl style={{ margin: "14px 0", display: "grid", gap: 8 }}>
        <Row
          label="When"
          value={`${new Date(b.startAt).toLocaleString(undefined, {
            weekday: "long",
            day: "numeric",
            month: "long",
            hour: "2-digit",
            minute: "2-digit",
          })} – ${new Date(b.endAt).toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          })}`}
        />
        <Row label="Price" value={formatMoney(b.priceSnapshot, b.currency)} />
        {typeof b.metadata?.notes === "string" && b.metadata.notes && (
          <Row label="Your note" value={b.metadata.notes} />
        )}
      </dl>

      {/* `refund_pending` is not `refunded` — the gateway could not return the
          money automatically and a person is completing the payout. Saying
          "refunded" here would tell a customer they have been repaid when they
          have not. */}
      {b.paymentStatus === "refund_pending" && (
        <p style={{ fontSize: 13.5, margin: "0 0 12px" }}>
          Your refund is being processed by hand and has not arrived yet. We have opened a
          support ticket to track it.
        </p>
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
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>
            {formatMoney(bal.outstanding, bal.currency)} still to pay
          </div>
          <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
            The appointment settled at {formatMoney(bal.finalPrice, bal.currency)}, above the{" "}
            {formatMoney(bal.quotedPrice, bal.currency)} quoted. You can pay it here, or settle
            with the seller directly.
          </p>
          <Button
            size="sm"
            onClick={() => router.push(bookingBalancePath(bookingId))}
          >
            Pay the balance
          </Button>
        </div>
      )}

      {/* Recorded, not refunded — no automatic payout is issued, so this must
          not read as money on its way back. */}
      {bal && bal.creditDue > 0 && (
        <p className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
          The seller settled {formatMoney(bal.creditDue, bal.currency)} below what you paid. This
          is recorded on your booking but is not refunded automatically — contact the seller, or
          open a support ticket.
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
            {formatMoney(b.priceSnapshot, b.currency)} to pay
          </div>
          <p className="muted" style={{ fontSize: 13, margin: "0 0 10px" }}>
            {b.status === "confirmed"
              ? "Your appointment is held. Pay to keep it — unpaid bookings are released after a while."
              : "You can pay once the seller has accepted."}
          </p>
          <Button
            size="sm"
            disabled={b.status !== "confirmed"}
            onClick={() => router.push(bookingPayPath(bookingId))}
          >
            Pay now
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
            Move to another time
          </Button>
        )}
        {cancellable && (
          <Button variant="ghost" size="sm" disabled={busy} onClick={() => setConfirmCancel(true)}>
            Cancel booking
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => router.push(BOOKING_LIST)}>
          All bookings
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
        title="Cancel this booking?"
        tone="danger"
        icon="calendar-clock"
        confirmLabel="Cancel it"
        cancelLabel="Keep it"
        onConfirm={() => void cancel()}
        onCancel={() => setConfirmCancel(false)}
      >
        {b.paymentStatus === "paid"
          ? "If the seller's policy allows it, your payment will be refunded. Some payment methods have to be refunded by hand, which takes longer."
          : "The seller sets the cancellation policy, so this may not be allowed close to the appointment."}
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
