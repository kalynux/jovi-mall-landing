"use client";

import { use } from "react";
import { OrderDetail } from "@/components/shop/account/OrderDetail";

/**
 * `/shop/account/orders/detail/:orderId` — the web's single-order page.
 *
 * ⚠ **The `detail` segment is not decoration.** Its sibling `orders/[cartId]` is
 * a dynamic segment sitting at exactly this depth, and without a static segment
 * in front of the id every link here would resolve to the group screen instead —
 * which would then look up a checkout group by an order id and find nothing. A
 * static sibling wins over a dynamic one in the App Router; that is the whole
 * mechanism.
 *
 * ⚠ **This address is baked into messages already sent.** The backend's
 * `customer-notification-catalog.ts` writes it as a literal into every "View
 * order" button, on every channel, in five languages — and a link sitting in
 * somebody's inbox cannot be changed. Renaming this route is a two-repository
 * change in one go; see `api-doc/notifications/storefront-routes.md`.
 *
 * The screen itself lives in `components/shop/account/OrderDetail.tsx` because
 * the app renders it too, from `/shop/account/order/detail?id=` — a static
 * export has no server to resolve a path segment against. All this route does is
 * unwrap the segment.
 */
export default function Page({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = use(params);
  return <OrderDetail orderId={orderId} />;
}
