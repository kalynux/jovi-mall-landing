"use client";

import { Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { EmptyState, type IconName } from "@/components/shop/ds";
import { AccountSkeleton } from "./AccountShell";
import { BookingBalance } from "./BookingBalance";
import { BookingDetail } from "./BookingDetail";
import { BookingPay } from "./BookingPay";
import { BookingReschedule } from "./BookingReschedule";
import { OrderDetail, OrderTracking } from "./OrderDetail";
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
 *
 * That copy is this file’s own, so it is translated here, from
 * `shop.query.screens`. `QueryScreen` below still takes finished strings —
 * eighteen call sites across the account tree pass `title` / `description` into
 * the same shell components, and the caller is where a screen’s own name is
 * known.
 */

/** `useSearchParams()` suspends during prerender — see `ShopBrowserClient`. */
function QueryScreen({
  icon,
  title,
  description,
  children,
}: {
  icon: IconName;
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
  icon: IconName;
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
  const t = useTranslations("shop.query.screens");
  return (
    <QueryScreen
      icon="package-open"
      title={t("orderTitle")}
      description={t("orderDescription")}
    >
      {(id) => <OrderGroupDetail cartId={id} />}
    </QueryScreen>
  );
}

/**
 * `/shop/account/order/detail?id=<orderId>`
 *
 * ⚠ **An `orderId`, not the `cartId` `OrderGroupClient` above takes.** A basket
 * splits into one order per seller; the group screen shows all of them and this
 * shows one. The two ids look identical and resolve to nothing in each other's
 * screen, which is why they are adjacent here rather than filed apart.
 */
export function OrderDetailClient() {
  const t = useTranslations("shop.query.screens");
  return (
    <QueryScreen
      icon="receipt-text"
      title={t("orderTitle")}
      description={t("orderDescription")}
    >
      {(id) => <OrderDetail orderId={id} />}
    </QueryScreen>
  );
}

/** `/shop/account/order/tracking?id=<orderId>` — the same `orderId` as above. */
export function OrderTrackingClient() {
  const t = useTranslations("shop.query.screens");
  return (
    <QueryScreen
      icon="map-pin"
      title={t("trackingTitle")}
      description={t("trackingDescription")}
    >
      {(id) => <OrderTracking orderId={id} />}
    </QueryScreen>
  );
}

/** `/shop/account/booking?id=<bookingId>` */
export function BookingDetailClient() {
  const t = useTranslations("shop.query.screens");
  return (
    <QueryScreen
      icon="calendar-clock"
      title={t("bookingTitle")}
      description={t("bookingDescription")}
    >
      {(id) => <BookingDetail bookingId={id} />}
    </QueryScreen>
  );
}

/** `/shop/account/booking/pay?id=<bookingId>` */
export function BookingPayClient() {
  const t = useTranslations("shop.query.screens");
  return (
    <QueryScreen
      icon="calendar-clock"
      title={t("bookingPayTitle")}
      description={t("bookingPayDescription")}
    >
      {(id) => <BookingPay bookingId={id} />}
    </QueryScreen>
  );
}

/** `/shop/account/booking/balance?id=<bookingId>` */
export function BookingBalanceClient() {
  const t = useTranslations("shop.query.screens");
  return (
    <QueryScreen
      icon="calendar-clock"
      title={t("bookingBalanceTitle")}
      description={t("bookingBalanceDescription")}
    >
      {(id) => <BookingBalance bookingId={id} />}
    </QueryScreen>
  );
}

/** `/shop/account/booking/reschedule?id=<bookingId>` */
export function BookingRescheduleClient() {
  const t = useTranslations("shop.query.screens");
  return (
    <QueryScreen
      icon="calendar-clock"
      title={t("bookingRescheduleTitle")}
      description={t("bookingRescheduleDescription")}
    >
      {(id) => <BookingReschedule bookingId={id} />}
    </QueryScreen>
  );
}

/** `/shop/account/ticket?id=<ticketId>` */
export function TicketDetailClient() {
  const t = useTranslations("shop.query.screens");
  return (
    <QueryScreen
      icon="message-square"
      title={t("ticketTitle")}
      description={t("ticketDescription")}
    >
      {(id) => <TicketDetail ticketId={id} />}
    </QueryScreen>
  );
}
