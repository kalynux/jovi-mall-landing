"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { OrderGroupDetail } from "./OrderGroupDetail";
import { AccountSkeleton } from "./AccountShell";
import { EmptyState } from "@/components/shop/ds";

/**
 * `/shop/account/order?id=<cartId>` — the app's order group page.
 *
 * Same screen as the web's `/shop/account/orders/:cartId`, reached the way a
 * static export can reach it. See `shop.routes.ts`.
 */
/** `useSearchParams()` suspends during prerender — see `ShopBrowserClient`. */
export function OrderGroupClient() {
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <OrderResolver />
    </Suspense>
  );
}

function OrderResolver() {
  const cartId = useSearchParams().get("id");

  // Only reachable by hand-editing the URL or following a truncated deep link:
  // every in-app link to this screen is built by `orderGroupPath`.
  if (!cartId) {
    return (
      <EmptyState
        icon="package-search"
        title="No order to show"
        description="Open an order from your order history to see its details."
      />
    );
  }

  return <OrderGroupDetail cartId={cartId} />;
}
