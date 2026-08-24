/**
 * What each shop screen is called, and where its back arrow goes.
 *
 * The header bar names the page the shopper is on — the way an app bar does,
 * rather than repeating the brand on all twenty screens. That name has to be
 * known *before* the page renders (the header is a sibling of `main`, not a
 * child of it), so it is derived from the route here rather than passed down.
 *
 * Screens whose title is a piece of live data — a product, a store — override
 * it once they have loaded it; see `useShopPageTitle`. Everything static is
 * answered from this file, which is also what makes the title correct on the
 * very first paint.
 *
 * Paths here are locale-agnostic, matching `usePathname()` from
 * `@/i18n/navigation` — which is locale-stripped — and normalised through
 * `normalizePath` so the app build's trailing slash cannot make every
 * comparison quietly false.
 */

import { normalizePath } from "./shop.routes";

export interface ShopTab {
  href: string;
  icon: string;
  label: string;
}

/**
 * The four screens the tab bar reaches, in its order.
 *
 * One list, three consumers: the bottom tab bar renders it, the desktop header
 * renders it as icons, and the back arrow uses it to decide it is not needed —
 * a tab is a root, and a root has nothing behind it.
 */
export const SHOP_TABS: ShopTab[] = [
  { href: "/shop", icon: "store", label: "Shop" },
  { href: "/shop/saved", icon: "heart", label: "Saved" },
  { href: "/shop/cart", icon: "shopping-cart", label: "Cart" },
  { href: "/shop/account", icon: "user", label: "Account" },
];

export function isShopTab(pathname: string): boolean {
  const here = normalizePath(pathname);
  return SHOP_TABS.some((tab) => tab.href === here);
}

/**
 * `/shop/account/order` and `/shop/store` are the app's query-string forms of
 * routes the web addresses by path — see `shop.routes.ts`. Both shapes are
 * listed so the header is right on either target.
 */
const EXACT_TITLES: Record<string, string> = {
  "/shop/checkout": "Checkout",
  "/shop/checkout/success": "Order confirmed",
  "/shop/account/orders": "My orders",
  "/shop/account/order": "Order details",
  "/shop/account/addresses": "Addresses",
  "/shop/account/payment-methods": "Payment methods",
  "/shop/account/notifications": "Notifications",
  "/shop/account/notifications/settings": "Notification settings",
  "/shop/account/downloads": "My downloads",
  "/shop/account/reviews": "My reviews",
  "/shop/account/security": "Sign-in details",
  "/shop/account/close": "Close account",
  "/shop/p": "Product",
  "/shop/store": "Store",
};

const PATTERN_TITLES: [RegExp, string][] = [
  [/^\/shop\/account\/orders\/[^/]+$/, "Order details"],
  [/^\/shop\/stores\/[^/]+\/products\/[^/]+$/, "Product"],
  [/^\/shop\/stores\/[^/]+$/, "Store"],
  [/^\/shop\/p\/[^/]+$/, "Product"],
];

export function shopPageTitle(pathname: string): string {
  const here = normalizePath(pathname);

  const tab = SHOP_TABS.find((t) => t.href === here);
  if (tab) return tab.label;

  const exact = EXACT_TITLES[here];
  if (exact) return exact;

  for (const [pattern, title] of PATTERN_TITLES) {
    if (pattern.test(here)) return title;
  }

  return "Shop";
}

/**
 * Where the back arrow goes when there is nothing to step back through —
 * someone who opened this screen from a push notification, a shared link or a
 * cold app start.
 *
 * The storefront is the default, and the parent screen wins where there is a
 * real one: coming out of an order detail belongs in the order list, not at
 * the top of the shop.
 */
const EXACT_PARENTS: Record<string, string> = {
  "/shop/checkout": "/shop/cart",
  "/shop/checkout/success": "/shop",
  "/shop/account/order": "/shop/account/orders",
  "/shop/account/notifications/settings": "/shop/account/notifications",
};

/**
 * Screens whose back arrow ignores history entirely.
 *
 * Only the order confirmation, and for one reason: the entry behind it is the
 * checkout form for an order that has already been placed. Stepping back into
 * it offers to pay for something bought a second ago.
 */
const IGNORES_HISTORY = new Set(["/shop/checkout/success"]);

export function shopParentPath(pathname: string): string {
  const here = normalizePath(pathname);

  const exact = EXACT_PARENTS[here];
  if (exact) return exact;

  if (/^\/shop\/account\/orders\/[^/]+$/.test(here)) return "/shop/account/orders";
  if (here.startsWith("/shop/account/")) return "/shop/account";

  return "/shop";
}

export function backIgnoresHistory(pathname: string): boolean {
  return IGNORES_HISTORY.has(normalizePath(pathname));
}
