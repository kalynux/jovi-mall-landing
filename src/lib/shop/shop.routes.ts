/**
 * The storefront's URL shape, in one place.
 *
 * Same discipline as `lib/blog/blog.routes.ts`: the sitemap, breadcrumbs,
 * JSON-LD and every internal link build their paths from here, so the shape
 * cannot be changed in one place and missed in a dozen.
 *
 * ── Why products nest under their store ──────────────────────────────────────
 *
 * `Product.slug` is unique **per vendor** (`{ vendorId: 1, slug: 1 }`), not
 * globally — two sellers may both own `blue-shirt`. So `/shop/products/:slug`
 * cannot resolve, and never could; it worked only because the catalogue was
 * invented and its slugs happened not to collide. The backend chose to nest
 * rather than run a migration that would have silently renamed live products,
 * and this is the frontend half of that decision.
 *
 * These are locale-agnostic paths, as authored. `localePath()` prefixes them per
 * language — nothing here knows that English goes unprefixed.
 */

import { IS_NATIVE_BUILD } from "@/lib/platform";
import { isLocale } from "@/i18n/routing";

export const SHOP_ROOT = "/shop";

/**
 * Is this URL inside the storefront?
 *
 * Takes a **live** pathname — locale prefix and all, exactly what
 * `usePathname()` answers — because the callers are redirect sites, and what
 * they hold is where the browser actually is.
 *
 * Only shoppers are ever behind these paths: there is no vendor, agency or
 * agent screen under `/shop`. That is what lets the sign-in gate skip its role
 * question for anyone bounced out of here — see the `customerOnly` note in the
 * login page.
 */
export function isShopPath(pathname: string): boolean {
  const [, first, ...rest] = normalizePath(pathname).split("/");
  const path = isLocale(first) ? `/${rest.join("/")}` : `/${[first, ...rest].join("/")}`;
  return path === SHOP_ROOT || path.startsWith(`${SHOP_ROOT}/`);
}

/**
 * Where the brand logo goes, and every other "back to home".
 *
 * On the web that is the marketing landing page. **In the app there is no such
 * page**: `build-native.mjs` leaves `[locale]/page.tsx` out of the bundle,
 * because it pulls the entire landing tree — hero, sections, four
 * always-animating background layers, every illustration — into a bundle that
 * exists to show a shop. A `<Link href="/">` there is a client-side navigation
 * to a route the export never wrote, which fails without a server to 404 it.
 *
 * So in the app the storefront *is* home. That is why this lives in this file
 * rather than somewhere more general: the answer is a fact about the shop.
 *
 * Header logos, the auth screens' "back to home" and anything else pointing at
 * `/` must come through here.
 */
/**
 * `usePathname()`, made safe to compare against the paths in this file.
 *
 * The app build sets `trailingSlash: true` — it has to, because Capacitor
 * serves a directory URL to its `index.html` — so `usePathname()` answers
 * "/shop/" while every constant here is written "/shop". Nothing warns about
 * that; the comparisons just quietly stop being true.
 *
 * It cost two visible bugs before anyone noticed: the hardware back button
 * could never exit the app (it compared against SHOP_ROOT and never matched,
 * so it looped forever), and no bottom-tab item ever showed as active,
 * because every `pathname === "/shop"` was false on a device while being true
 * on the web.
 *
 * Compare through here rather than trimming at each call site — the next
 * comparison somebody writes will be written the natural way.
 */
export function normalizePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function homePath(): string {
  return IS_NATIVE_BUILD ? SHOP_ROOT : "/";
}

/**
 * ── The app addresses the same things by query string ────────────────────────
 *
 * A nested path only resolves if something is there to resolve it. The web has
 * a server; the app is a folder of static files, and `output: "export"` writes
 * one file per *known* path — of which the catalogue has none, being paginated,
 * unbounded and free to change without a rebuild.
 *
 * So on the native target every parameterised screen becomes one static file
 * that reads its subject from the query and fetches it live. This is the only
 * place that knows, which is why the change reached no call site: `ProductCard`,
 * the cart, the order list and the store grid all build their links from these
 * four functions and are unchanged.
 *
 * The web keeps its nested, indexable URLs exactly as they were — the sitemap,
 * the canonicals and the JSON-LD all still derive from here.
 */

/** The canonical product URL. Emit this from every link, the sitemap and JSON-LD. */
export function productPath(storeSlug: string, productSlug: string): string {
  if (IS_NATIVE_BUILD) {
    return `${SHOP_ROOT}/p?store=${encodeURIComponent(storeSlug)}&slug=${encodeURIComponent(productSlug)}`;
  }
  return `${SHOP_ROOT}/stores/${storeSlug}/products/${productSlug}`;
}

/**
 * The order group's detail page.
 *
 * Not previously a helper — the order list built this path inline. It is one
 * now for the same reason the others are: the app needs a different shape and
 * there should be exactly one place that decides it.
 */
export function orderGroupPath(cartId: string): string {
  if (IS_NATIVE_BUILD) {
    return `${SHOP_ROOT}/account/order?id=${encodeURIComponent(cartId)}`;
  }
  return `${SHOP_ROOT}/account/orders/${cartId}`;
}

/**
 * The deep-link form, by ObjectId.
 *
 * A redirect stub, not an address to publish: it resolves the product and sends
 * the browser to `productPath`. For links held somewhere that knows an id but
 * not a store slug — an order line, a notification, a saved favourite.
 */
export function productIdPath(productId: string): string {
  if (IS_NATIVE_BUILD) return `${SHOP_ROOT}/p?id=${encodeURIComponent(productId)}`;
  return `${SHOP_ROOT}/p/${productId}`;
}

export function storePath(storeSlug: string): string {
  if (IS_NATIVE_BUILD) return `${SHOP_ROOT}/store?s=${encodeURIComponent(storeSlug)}`;
  return `${SHOP_ROOT}/stores/${storeSlug}`;
}

/** A product row from any list already carries `store.slug`, so this needs no join. */
export function productPathFor(product: {
  slug: string;
  store: { slug: string };
}): string {
  return productPath(product.store.slug, product.slug);
}

/**
 * ── Bookings and support threads ─────────────────────────────────────────────
 *
 * Same split as the four above, and for the same reason: `bookings/[bookingId]`
 * — with `/pay`, `/balance` and `/reschedule` under it — and `support/[ticketId]`
 * are dynamic segments, and there is no honest set of ids to prerender. A
 * customer's appointments and tickets are theirs, unbounded, and change without
 * a rebuild.
 *
 * These two are not the catalogue, though. An order group can be reached from a
 * list, but a *booking* is a service somebody bought and a *ticket* is a problem
 * they raised — both are things the app has to be able to open, not browse past.
 * So they get the query-string treatment rather than being left out of the
 * bundle: `/shop/account/booking?id=…` and `/shop/account/ticket?id=…` are
 * ordinary static files that resolve against the live API on open.
 *
 * The web keeps its nested paths unchanged. `build-native.mjs` drops the
 * dynamic trees from the app build, and these functions are what keep every
 * link pointing at whichever shape the current target has.
 */

/** The bookings list. Static, so it is in every build. */
export const BOOKING_LIST = `${SHOP_ROOT}/account/bookings`;

/** The support ticket list. Static, so it is in every build. */
export const TICKET_LIST = `${SHOP_ROOT}/account/support`;

/** One appointment. */
export function bookingPath(bookingId: string): string {
  return bookingScreen("", bookingId);
}

/** Pay for a booking that was created unpaid. */
export function bookingPayPath(bookingId: string): string {
  return bookingScreen("pay", bookingId);
}

/** Settle what a completed booking turned out to cost above the quote. */
export function bookingBalancePath(bookingId: string): string {
  return bookingScreen("balance", bookingId);
}

/** Move a booking to another slot. */
export function bookingReschedulePath(bookingId: string): string {
  return bookingScreen("reschedule", bookingId);
}

/** One support thread. */
export function ticketPath(ticketId: string): string {
  if (IS_NATIVE_BUILD) {
    return `${SHOP_ROOT}/account/ticket?id=${encodeURIComponent(ticketId)}`;
  }
  return `${TICKET_LIST}/${encodeURIComponent(ticketId)}`;
}

/**
 * The four booking screens differ only by their last segment, so they are one
 * function — the alternative is the same target branch written four times, and
 * the next screen added would be the one that forgot it.
 */
function bookingScreen(step: "" | "pay" | "balance" | "reschedule", bookingId: string): string {
  const id = encodeURIComponent(bookingId);
  if (IS_NATIVE_BUILD) {
    const base = `${SHOP_ROOT}/account/booking${step ? `/${step}` : ""}`;
    return `${base}?id=${id}`;
  }
  return `${BOOKING_LIST}/${id}${step ? `/${step}` : ""}`;
}
