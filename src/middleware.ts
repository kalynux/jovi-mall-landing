import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";
import { DEFAULT_LOCALE, isLocale, localePath, routing, type Locale } from "@/i18n/routing";

/**
 * Two jobs, in order.
 *
 * 1. Locale routing. next-intl resolves which of the five languages a request
 *    is for and rewrites /fr/shop onto the [locale] segment. English keeps the
 *    unprefixed paths (localePrefix: "as-needed").
 *
 * 2. The session gate that used to be this file's only job — protecting
 *    /add-role and /auth-me. It has to run against the locale-stripped path,
 *    since those routes are now reachable as /fr/add-role too, and it has to
 *    redirect back into the same locale so a French visitor is not dropped onto
 *    the English login page.
 *
 * Strategy for the gate is unchanged: check for the presence of EITHER cookie
 * emitted by the backend:
 *   - access_token  (15 min JWT)
 *   - refresh_token (30 day rotation token)
 *
 * If both are absent the user has no session at all. We do NOT decode or verify
 * the JWT — that is the backend's responsibility. The backend will reject
 * expired/invalid tokens and return 401.
 *
 * SameSite=Lax cookies are included on same-site navigations and cross-site
 * top-level GET navigations, so this check works correctly.
 */
const handleI18n = createMiddleware(routing);

/** Routes that require a session, as authored — without any locale prefix. */
const PROTECTED_PATHS = ["/add-role", "/auth-me"];

/**
 * Subtrees that require a session — matched by prefix, so a page added under
 * one is covered without editing this file.
 *
 * `/shop/account` is every owner-scoped surface in the shop: profile, saved
 * addresses, payment methods, the notification inbox, order history and the
 * digital library. All of it is `requireRole(['customer'])` server-side, so an
 * anonymous visitor would only ever see a page of 401s — better to send them to
 * login before the request than after it.
 *
 * The rest of /shop stays public on purpose: browsing must not need an account.
 */
/**
 * `/shop/checkout` joins `/shop/account` here because checkout is
 * `requireRole(['customer'])` server-side: a signed-out visitor reaching it
 * could only ever have seen a form that fails on submit. Browsing and the cart
 * stay public — a visitor fills a cart, signs in at this gate, and
 * `POST /cart/merge` carries the basket over.
 */
const PROTECTED_PREFIXES = ["/shop/account", "/shop/checkout"];

/** Splits "/fr/add-role" into its locale and "/add-role". */
function splitLocale(pathname: string): { locale: Locale; rest: string } {
  const [, maybeLocale, ...segments] = pathname.split("/");
  if (isLocale(maybeLocale)) {
    return { locale: maybeLocale, rest: `/${segments.join("/")}` };
  }
  return { locale: DEFAULT_LOCALE, rest: pathname };
}

export function middleware(req: NextRequest) {
  const { locale, rest } = splitLocale(req.nextUrl.pathname);

  const isProtected =
    PROTECTED_PATHS.includes(rest) ||
    PROTECTED_PREFIXES.some((p) => rest === p || rest.startsWith(`${p}/`));

  if (isProtected) {
    const hasSession = Boolean(
      req.cookies.get("access_token")?.value || req.cookies.get("refresh_token")?.value
    );

    if (!hasSession) {
      const loginUrl = new URL(localePath(locale, "/login"), req.url);
      // The return path keeps its locale prefix so the post-login redirect lands
      // back where the visitor actually was — and its query string, since
      // /add-role?role=vendor loses its preselected role without it.
      loginUrl.searchParams.set("return", req.nextUrl.pathname + req.nextUrl.search);
      // The server half of the same rule the client guard applies: nothing
      // under /shop belongs to a vendor, agency or agent, so the sign-in page
      // is told it is dealing with a shopper and skips the role step. `rest`
      // is already locale-stripped by splitLocale above.
      if (rest === "/shop" || rest.startsWith("/shop/")) {
        loginUrl.searchParams.set("role", "customer");
      }
      return NextResponse.redirect(loginUrl);
    }
  }

  return handleI18n(req);
}

export const config = {
  // Everything except Next internals, the metadata routes that must stay
  // unprefixed (robots.txt, sitemap.xml, the icons) and anything with a file
  // extension.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
