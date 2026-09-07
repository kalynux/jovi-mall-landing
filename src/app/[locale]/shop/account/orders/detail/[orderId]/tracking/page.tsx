"use client";

import { use } from "react";
import { OrderTracking } from "@/components/shop/account/OrderDetail";

/**
 * `/shop/account/orders/detail/:orderId/tracking` — the web's tracking page.
 *
 * Nested under the single-order page rather than under the group, because a
 * customer tracks **one parcel**: a checkout group can be several parcels going
 * to several places on different days, and "track my order" has no single answer
 * there.
 *
 * ⚠ Same promise as its parent — the backend's notification catalogue writes
 * this exact path into every "Track delivery" button, so renaming it breaks
 * messages that have already been delivered. See
 * `api-doc/notifications/storefront-routes.md`.
 *
 * The screen lives in `components/shop/account/OrderDetail.tsx`; the app renders
 * it from `/shop/account/order/tracking?id=`.
 */
export default function Page({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  return <OrderTracking orderId={orderId} />;
}
