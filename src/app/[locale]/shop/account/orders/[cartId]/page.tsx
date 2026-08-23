"use client";

import { use } from "react";
import { OrderGroupDetail } from "@/components/shop/account/OrderGroupDetail";

/**
 * `/shop/account/orders/:cartId` — the web's order group page.
 *
 * The screen itself moved to `components/shop/account/OrderGroupDetail.tsx`
 * because the app renders it too, from `/shop/account/order?id=` — a static
 * export has no server to resolve a path segment against, so the app addresses
 * an order group by query. All this route does is unwrap the segment.
 */
export default function OrderGroupPage({
  params,
}: {
  params: Promise<{ cartId: string }>;
}) {
  const { cartId } = use(params);
  return <OrderGroupDetail cartId={cartId} />;
}
