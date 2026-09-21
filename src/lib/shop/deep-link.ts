/**
 * Where a link from outside the app opens, inside it.
 *
 * Everything that opens the app from elsewhere — a "View request" button in
 * WhatsApp, an order email, a product somebody shared — reaches `NativeShell`'s
 * `appUrlOpen` listener as a full URL. This file turns that URL into a path the
 * app build actually has a page for.
 *
 * ── Why the path cannot be followed as it arrives ────────────────────────────
 *
 * The links are **web** URLs. The backend builds them for the website, and
 * Android App Links hand the very same URL to the app when it is installed. The
 * web addresses a support thread as `/shop/account/support/<id>`; the app is a
 * static export with no server to resolve a path segment against, so it
 * addresses the same screen as `/shop/account/ticket?id=<id>` (see
 * `shop.routes.ts`). Following the web path inside the app asks Capacitor's
 * local server for a file the export never wrote. It answers an empty 404, and
 * the WebView replaces the whole app with "Webpage not available" — which is
 * what every nested link from outside did until this file existed.
 *
 * ── No second route table ────────────────────────────────────────────────────
 *
 * The translation is the one the notification inbox and push taps already use:
 * `matchStorefrontPath` in `notification-routing.ts`, which hands each shape to
 * its `shop.routes.ts` helper. A route added there is understood here too.
 *
 * Native only in practice: the listener that calls this is compiled out of the
 * web build, where an incoming path is already the right one.
 */
import { isLocale } from "@/i18n/routing";
import { matchStorefrontPath } from "./notification-routing";
import { homePath } from "./shop.routes";

/**
 * Reduce an incoming deep link to a path this app can route to, or `null`.
 *
 * Deliberately strict. A deep link is attacker-controllable — anything can fire
 * an intent at a registered scheme — so this keeps the path and query and
 * throws the rest away rather than trusting a host, and refuses anything that
 * is not an absolute in-app path. `//evil.com` is rejected for the same reason
 * `validateReturnUrl` rejects it: a browser reads it as a protocol-relative URL
 * pointing somewhere else entirely.
 */
export function toInAppPath(rawUrl: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  const path = `${parsed.pathname}${parsed.search}`;
  if (!path.startsWith("/") || path.startsWith("//")) return null;

  return path;
}

/**
 * The in-app destination for a path `toInAppPath` has already accepted.
 * Locale-agnostic, like everything in `shop.routes.ts`: hand it to the router
 * from `@/i18n/navigation`, which adds the prefix.
 *
 * In order:
 *
 *   1. **A leading locale is dropped.** The backend writes the customer's
 *      language into every link (`/fr/shop/…`), and the locale-aware router
 *      prefixes whatever it is given with the language the app is in — so a
 *      kept prefix becomes `/en/fr/shop/…`, which is nothing. The app's own
 *      language wins: it is the shopper's setting on this device, and it is the
 *      only one guaranteed to exist here, since an app build may ship fewer
 *      languages than the site.
 *   2. **A path the web addresses by segment is re-shaped** through the shared
 *      table, and the link's query string is carried over — the store page
 *      reads `?type=` on both targets. The path's own ids win a collision, so a
 *      `?id=` tacked onto a link cannot point it at a different record.
 *   3. **An unknown path below one of those opens the nearest one above it**,
 *      without the query, which belonged to the screen that was not found. A
 *      link to a screen this version of the app does not have —
 *      `/shop/account/bookings/<id>/receipt`, say, added to the site after the
 *      app was built — opens that booking. The id is the most specific thing the
 *      customer was sent: a list would make them find it again, and the shop
 *      home would lose it altogether.
 *   4. **The web's home page is not in the app**, so `/` opens the storefront,
 *      which is the app's home (`homePath`).
 *   5. **Anything else is already an in-app path** — a static screen, a
 *      query-string search (`/shop?q=…`), the magic sign-in link — and comes
 *      back exactly as it arrived.
 *
 * ⚠ **What 5 cannot catch:** a static page the website has and this installed
 * app does not — one added after the APK was built. Nothing here can tell it
 * from a page the app does have without a list of the app's pages, so it is
 * passed through and still opens on nothing.
 *
 * ⚠ `/pay/<token>` resolves to itself, and the app has no pay page by design
 * (see `payPath`). App Links never deliver one — the manifest claims only
 * `/shop` and `/login/magic`, so a pay link opens the browser — and only a
 * hand-made `wimall:///pay/…` could reach this function with it.
 */
export function resolveDeepLink(path: string): string {
  const queryAt = path.indexOf("?");
  const arrived = queryAt === -1 ? path : path.slice(0, queryAt);
  const search = queryAt === -1 ? "" : path.slice(queryAt);

  // 1. The router adds the prefix for the language in use.
  //
  // ⚠ The collapse is what keeps `toInAppPath`'s promise. It refused a path
  //   opening with `//` because a router follows one off-site; `/fr//evil.com`
  //   passes that check and turns into exactly that once the locale is gone.
  const first = arrived.split("/")[1];
  const pathname = isLocale(first)
    ? arrived.slice(first.length + 1).replace(/^\/+/, "/") || "/"
    : arrived;

  // 2. The web's nested shape, re-shaped for this build.
  const target = matchStorefrontPath(pathname);
  if (target) return withQuery(target, search);

  // 3. Something below a recognised screen: open that screen.
  const segments = pathname.split("/").filter(Boolean);
  for (let depth = segments.length - 1; depth > 0; depth -= 1) {
    const ancestor = matchStorefrontPath(segments.slice(0, depth).join("/"));
    if (ancestor) return ancestor;
  }

  // 4. The landing page is not in the app bundle.
  if (segments.length === 0) return withQuery(homePath(), search);

  // 5. Already an in-app path.
  return pathname === arrived ? path : `${pathname}${search}`;
}

/**
 * `target`, with the incoming query's parameters appended — except any the
 * target already sets, which name the record the path pointed at.
 *
 * Appended rather than re-serialised, so a target that needs nothing added is
 * returned byte for byte as its `shop.routes.ts` helper built it.
 */
function withQuery(target: string, search: string): string {
  const ownAt = target.indexOf("?");
  const own = new URLSearchParams(ownAt === -1 ? "" : target.slice(ownAt + 1));

  const extra = new URLSearchParams();
  new URLSearchParams(search).forEach((value, key) => {
    if (!own.has(key)) extra.append(key, value);
  });

  const tail = extra.toString();
  if (!tail) return target;
  return `${target}${ownAt === -1 ? "?" : "&"}${tail}`;
}
