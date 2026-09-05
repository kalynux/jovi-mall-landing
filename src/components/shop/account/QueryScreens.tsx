"use client";

import { Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { EmptyState } from "@/components/shop/ds";
import { AccountSkeleton } from "./AccountShell";
import { BookingBalance } from "./BookingBalance";
import { BookingDetail } from "./BookingDetail";
import { BookingPay } from "./BookingPay";
import { BookingReschedule } from "./BookingReschedule";
import { OrderGroupDetail } from "./OrderGroupDetail";
import { TicketDetail } from "./TicketDetail";

/**
 * Every screen the app addresses by `?id=`, in one file.
 *
 * ── Why these exist ──────────────────────────────────────────────────────────
 *
 * `output: "export"` writes one file per *known* path, and the ids here are not
 * knowable at build time: an order group, a booking and a support thread all
 * belong to one customer and change without a rebuild. The web keeps its nested
 * routes — `/shop/account/orders/:cartId`, `bookings/:bookingId`,
 * `support/:ticketId` — and the app reads the same screens off a query string
 * instead. `shop.routes.ts` decides which shape a link takes; nothing else has
 * to know.
 *
 * Each pair is one screen component with two doors, never two implementations.
 * They were separate files until the booking and ticket screens needed the same
 * treatment; five more one-export files was the wrong answer to "do this four
 * more times".
 *
 * ── The empty state is not decoration ────────────────────────────────────────
 *
 * A missing `?id=` is only reachable by hand-editing the URL or following a
 * deep link that lost its query — every in-app link comes from `shop.routes.ts`
 * and carries one. It still has to say something, because the alternative is a
 * screen that renders nothing at all.
 */

/** `useSearchParams()` suspends during prerender — see `ShopBrowserClient`. */
function QueryScreen({
  icon,
  title,
  description,
  children,
}: {
  icon: string;
  title: string;
  description: string;
  children: (id: string) => ReactNode;
}) {
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <Resolver icon={icon} title={title} description={description} render={children} />
    </Suspense>
  );
}

function Resolver({
  icon,
  title,
  description,
  render,
}: {
  icon: string;
  title: string;
  description: string;
  render: (id: string) => ReactNode;
}) {
  const id = useSearchParams().get("id");
  if (!id) return <EmptyState icon={icon} title={title} description={description} />;
  return <>{render(id)}</>;
}

/** `/shop/account/order?id=<cartId>` */
export function OrderGroupClient() {
  return (
    <QueryScreen
      icon="package-open"
      title="No order to show"
      description="Open an order from your order history to see its details."
    >
      {(id) => <OrderGroupDetail cartId={id} />}
    </QueryScreen>
  );
}

/** `/shop/account/booking?id=<bookingId>` */
export function BookingDetailClient() {
  return (
    <QueryScreen
      icon="calendar-clock"
      title="No booking to show"
      description="Open a booking from your bookings list to see its details."
    >
      {(id) => <BookingDetail bookingId={id} />}
    </QueryScreen>
  );
}

/** `/shop/account/booking/pay?id=<bookingId>` */
export function BookingPayClient() {
  return (
    <QueryScreen
      icon="calendar-clock"
      title="No booking to pay for"
      description="Open a booking from your bookings list to pay for it."
    >
      {(id) => <BookingPay bookingId={id} />}
    </QueryScreen>
  );
}

/** `/shop/account/booking/balance?id=<bookingId>` */
export function BookingBalanceClient() {
  return (
    <QueryScreen
      icon="calendar-clock"
      title="No balance to settle"
      description="Open a booking from your bookings list to settle what is left to pay."
    >
      {(id) => <BookingBalance bookingId={id} />}
    </QueryScreen>
  );
}

/** `/shop/account/booking/reschedule?id=<bookingId>` */
export function BookingRescheduleClient() {
  return (
    <QueryScreen
      icon="calendar-clock"
      title="No booking to move"
      description="Open a booking from your bookings list to move it to another time."
    >
      {(id) => <BookingReschedule bookingId={id} />}
    </QueryScreen>
  );
}

/** `/shop/account/ticket?id=<ticketId>` */
export function TicketDetailClient() {
  return (
    <QueryScreen
      icon="message-square"
      title="No ticket to show"
      description="Open a ticket from your support list to see the conversation."
    >
      {(id) => <TicketDetail ticketId={id} />}
    </QueryScreen>
  );
}
