"use client";

import { useTranslations } from "next-intl";

import { useRouter } from "@/i18n/navigation";
import { Badge, EmptyState, Skeleton } from "@/components/shop/ds";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { useApiResource } from "@/lib/shop/useApiResource";
import { formatMoney } from "@/lib/shop/format";
import { bookingPath } from "@/lib/shop/shop.routes";
import {
  BOOKING_PAYMENT_LABEL,
  BOOKING_STATUS_LABEL,
  listBookings,
  type Booking,
} from "@/lib/shop/bookings.api";

/**
 * The customer's appointments.
 *
 * Two badges per row, deliberately: `status` and `paymentStatus` are independent
 * — a confirmed booking can be unpaid, and a cancelled one can still be waiting
 * on a refund — so collapsing them into one chip would hide whichever the
 * shopper actually needed.
 */
export default function BookingsPage() {
  const router = useRouter();
  const { status } = useAuthGuard();
  const resource = useApiResource(() => listBookings({ limit: 50 }), [status]);

  if (status === "loading" || resource.status === "loading") {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-6">
        <Skeleton height={90} style={{ marginBottom: 10 }} />
        <Skeleton height={90} />
      </div>
    );
  }

  const bookings = resource.data?.data ?? [];

  return (
    <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-6">
      <h1 className="sr-only">My bookings</h1>

      {bookings.length === 0 ? (
        <EmptyState
          icon="calendar-clock"
          title="No bookings yet"
          description="Services you book will appear here."
          actionLabel="Browse services"
          onAction={() => router.push("/shop?type=service")}
        />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {bookings.map((booking) => (
            <BookingRow
              key={booking.id}
              booking={booking}
              onOpen={() => router.push(bookingPath(booking.id))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function BookingRow({ booking, onOpen }: { booking: Booking; onOpen: () => void }) {
  // Root-scoped: the lib modules emit absolute keys (`shop.status.…`).
  const tKey = useTranslations();
  const state = BOOKING_STATUS_LABEL[booking.status];
  const pay = BOOKING_PAYMENT_LABEL[booking.paymentStatus];
  const start = new Date(booking.startAt);

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 14,
        background: "none",
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, flexWrap: "wrap" }}>
        {state && (
          <Badge size="sm" tone={state.tone}>
            {tKey(state.labelKey)}
          </Badge>
        )}
        {/* Payment only matters while it is unresolved or went wrong. */}
        {pay && booking.paymentStatus !== "paid" && (
          <Badge size="sm" tone={pay.tone}>
            {tKey(pay.labelKey)}
          </Badge>
        )}
      </div>

      <div style={{ fontWeight: 700, fontSize: 14.5 }}>
        {booking.product?.title ?? "Service"}
      </div>
      {/*
          The handle a customer quotes to the vendor or to support. Null on
          bookings made before the field existed, so it is omitted rather than
          rendered as a bare "#" — and it is not a sequence counter, so nothing
          should read a position out of it. */}
      {booking.bookingNumber && (
        <div className="muted" style={{ fontSize: 12, marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
          {booking.bookingNumber}
        </div>
      )}
      <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
        {start.toLocaleString(undefined, {
          weekday: "short",
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        })}
        {" · "}
        {formatMoney(booking.priceSnapshot, booking.currency)}
      </div>
    </button>
  );
}
