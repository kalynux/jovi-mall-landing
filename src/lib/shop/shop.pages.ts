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

import type { IconName } from "@/components/shop/ds";
import { normalizePath } from "./shop.routes";

export interface ShopTab {
  href: string;
  /** `IconName`, not `string` — the tab bar is on every shop screen, so an
   *  unregistered name would draw a dot four times on every page. */
  icon: IconName;
  /**
   * A full dotted message key, never a word. This file is imported by the
   * header, the tab bar and the back arrow, none of which can hand it a
   * translator — and it has no React context of its own to call one from. See
   * LOCALISATION.md.
   */
  labelKey: string;
}

/**
 * The four screens the tab bar reaches, in its order.
 *
 * One list, three consumers: the bottom tab bar renders it, the desktop header
 * renders it as icons, and the back arrow uses it to decide it is not needed —
 * a tab is a root, and a root has nothing behind it.
 */
export const SHOP_TABS: ShopTab[] = [
  { href: "/shop", icon: "store", labelKey: "shop.nav.tabs.shop" },
  { href: "/shop/saved", icon: "heart", labelKey: "shop.nav.tabs.saved" },
  { href: "/shop/cart", icon: "shopping-cart", labelKey: "shop.nav.tabs.cart" },
  { href: "/shop/account", icon: "user", labelKey: "shop.nav.tabs.account" },
];

export function isShopTab(pathname: string): boolean {
  const here = normalizePath(pathname);
  return SHOP_TABS.some((tab) => tab.href === here);
}

/**
 * `/shop/account/order`, `/shop/account/booking`, `/shop/account/ticket` and
 * `/shop/store` are the app's query-string forms of routes the web addresses
 * by path — see `shop.routes.ts`. Both shapes are listed so the header is right
 * on either target.
 */
const EXACT_TITLES: Record<string, string> = {
  "/shop/checkout": "shop.nav.titles.checkout",
  "/shop/checkout/success": "shop.nav.titles.checkoutSuccess",
  "/shop/account/orders": "shop.nav.titles.orders",
  "/shop/account/order": "shop.nav.titles.orderDetails",
  "/shop/account/booking": "shop.nav.titles.booking",
  "/shop/account/booking/pay": "shop.nav.titles.bookingPay",
  "/shop/account/booking/balance": "shop.nav.titles.bookingBalance",
  "/shop/account/booking/reschedule": "shop.nav.titles.bookingReschedule",
  "/shop/account/ticket": "shop.nav.titles.ticket",
  "/shop/account/addresses": "shop.nav.titles.addresses",
  "/shop/account/payment-methods": "shop.nav.titles.paymentMethods",
  "/shop/account/notifications": "shop.nav.titles.notifications",
  "/shop/account/notifications/settings": "shop.nav.titles.notificationSettings",
  "/shop/account/downloads": "shop.nav.titles.downloads",
  "/shop/account/reviews": "shop.nav.titles.reviews",
  "/shop/account/security": "shop.nav.titles.security",
  "/shop/account/bookings": "shop.nav.titles.bookings",
  "/shop/account/support": "shop.nav.titles.support",
  "/shop/account/support/new": "shop.nav.titles.supportNew",
  "/shop/account/close": "shop.nav.titles.close",
  "/shop/p": "shop.nav.titles.product",
  "/shop/store": "shop.nav.titles.store",
};

const PATTERN_TITLES: [RegExp, string][] = [
  [/^\/shop\/account\/orders\/[^/]+$/, "shop.nav.titles.orderDetails"],
  [/^\/shop\/account\/bookings\/[^/]+$/, "shop.nav.titles.booking"],
  [/^\/shop\/account\/bookings\/[^/]+\/pay$/, "shop.nav.titles.bookingPay"],
  [/^\/shop\/account\/bookings\/[^/]+\/balance$/, "shop.nav.titles.bookingBalance"],
  [/^\/shop\/account\/bookings\/[^/]+\/reschedule$/, "shop.nav.titles.bookingReschedule"],
  [/^\/shop\/account\/support\/[^/]+$/, "shop.nav.titles.ticket"],
  [/^\/shop\/stores\/[^/]+\/products\/[^/]+$/, "shop.nav.titles.product"],
  [/^\/shop\/stores\/[^/]+$/, "shop.nav.titles.store"],
  [/^\/shop\/p\/[^/]+$/, "shop.nav.titles.product"],
];

/**
 * The message key naming this screen — resolve it with a root-scoped `t()`.
 *
 * Renamed from `shopPageTitle` so the compiler flags every consumer: the old
 * name returned a finished title, and a call site that kept it would have
 * printed `shop.nav.titles.checkout` into the header with nothing to catch it.
 */
export function shopPageTitleKey(pathname: string): string {
  const here = normalizePath(pathname);

  const tab = SHOP_TABS.find((t) => t.href === here);
  if (tab) return tab.labelKey;

  const exact = EXACT_TITLES[here];
  if (exact) return exact;

  for (const [pattern, titleKey] of PATTERN_TITLES) {
    if (pattern.test(here)) return titleKey;
  }

  return "shop.nav.titles.shop";
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
  "/shop/account/booking": "/shop/account/bookings",
  "/shop/account/booking/pay": "/shop/account/bookings",
  "/shop/account/booking/balance": "/shop/account/bookings",
  "/shop/account/booking/reschedule": "/shop/account/bookings",
  "/shop/account/ticket": "/shop/account/support",
  "/shop/account/notifications/settings": "/shop/account/notifications",
  "/shop/account/support/new": "/shop/account/support",
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
  if (/^\/shop\/account\/support\/[^/]+$/.test(here)) return "/shop/account/support";
  if (/^\/shop\/account\/bookings\/[^/]+/.test(here)) return "/shop/account/bookings";
  if (here.startsWith("/shop/account/")) return "/shop/account";

  return "/shop";
}

export function backIgnoresHistory(pathname: string): boolean {
  return IGNORES_HISTORY.has(normalizePath(pathname));
}
