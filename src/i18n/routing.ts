import { defineRouting } from "next-intl/routing";
import { IS_NATIVE_BUILD } from "@/lib/platform";

/**
 * ── The app prefixes every locale; the web still does not ────────────────────
 *
 * `as-needed` works because middleware rewrites `/shop` onto `/en/shop` on the
 * way in. A static export has no middleware and no rewrite, so the only files
 * that exist are the prefixed ones — `out/en/shop/index.html`. Left on
 * `as-needed`, next-intl's `<Link href="/shop">` would render `/shop` for an
 * English user and 404 against a file that was never written.
 *
 * So the native build prefixes always. It costs the app nothing: nobody reads a
 * URL on a phone, and `localePath()` below derives from the same constant, so
 * the two cannot drift.
 */
const LOCALE_PREFIX = IS_NATIVE_BUILD ? "always" : "as-needed";

/**
 * The locale set, and the URL shape that makes each one visible to search.
 *
 * `localePrefix: "as-needed"` keeps English on the bare paths it already owns
 * (`/`, `/shop`) and prefixes the rest (`/fr`, `/fr/shop`). The alternative,
 * prefixing everything, would have moved every existing URL for no gain.
 */
export const LOCALE_CODES = ["en", "fr", "pt", "es", "ar"] as const;

export type Locale = (typeof LOCALE_CODES)[number];

export const DEFAULT_LOCALE: Locale = "en";

const RTL_LOCALES: readonly Locale[] = ["ar"];

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALE_CODES as readonly string[]).includes(value);
}

/**
 * ── The locales THIS BUILD renders, which is not always all of them ──────────
 *
 * `LOCALE_CODES` above is the *product's* language set and stays at five: it is
 * what the website serves, what the sitemap and hreflang enumerate, and what the
 * CMS is asked for. Nothing here changes any of that.
 *
 * The app is a different question, because a static export writes one complete
 * HTML + RSC tree per locale into the APK. Measured on this repo: each locale is
 * ~11 MB in `out/` and ~3.2 MB compressed inside the APK, so five languages are
 * ~16 MB of a 20 MB download for a shopper who reads one of them.
 *
 * So an app build names the subset it ships in `APP_LOCALES` (`.env.mobile`),
 * which `scripts/build-native.mjs` forwards as `NEXT_PUBLIC_APP_LOCALES` — a
 * `NEXT_PUBLIC_` name so the compiler inlines it and the array below is a
 * constant rather than a runtime lookup. Unset — which is every web build and
 * `npm run dev` — this is `LOCALE_CODES` and nothing downstream can tell the
 * difference.
 *
 * Everything that has to agree with the set of trees on disk derives from here:
 * `generateStaticParams` (which trees get written), `routing` below (which
 * prefixes next-intl will route), the language picker in `lib/i18n-provider`
 * (which languages are offered), and the locale bootstrap in
 * `scripts/build-native.mjs` (which one a cold start may resolve to). A locale
 * offered by any of those but absent from the export is a dead tap on a device,
 * because there is no server to 404 it — the same class as an off-bundle link.
 *
 * Unknown or misspelt codes are dropped rather than trusted, and an empty result
 * falls back to all five: a typo in an env file should cost bundle size, not
 * produce an app with no language at all.
 */
function parseShippedLocales(): readonly Locale[] {
  const raw = process.env.NEXT_PUBLIC_APP_LOCALES?.trim();
  if (!raw) return LOCALE_CODES;

  const named = new Set(raw.split(",").map((code) => code.trim().toLowerCase()));
  // Filtering LOCALE_CODES rather than mapping the input keeps the canonical
  // order however the env var was written, and drops anything unknown.
  const shipped = LOCALE_CODES.filter((code) => named.has(code));
  return shipped.length > 0 ? shipped : LOCALE_CODES;
}

export const SHIPPED_LOCALES: readonly Locale[] = parseShippedLocales();

/**
 * The fallback locale *for this build*.
 *
 * `DEFAULT_LOCALE` is a fact about the product and stays `en` — it is what
 * `localePath()` leaves unprefixed on the web, so it cannot move. But next-intl
 * requires its default to be one of the locales it routes, and a build that
 * ships only `fr` does not route `en`, so the two have to be free to differ in
 * the one place that matters.
 *
 * With `en` shipped, as it is today, these are the same value.
 */
export const BUILD_DEFAULT_LOCALE: Locale = SHIPPED_LOCALES.includes(DEFAULT_LOCALE)
  ? DEFAULT_LOCALE
  : SHIPPED_LOCALES[0];

/** Is this a language the running build actually has a tree for? */
export function isShippedLocale(value: unknown): value is Locale {
  return isLocale(value) && SHIPPED_LOCALES.includes(value);
}

export function localeDir(locale: Locale): "ltr" | "rtl" {
  return RTL_LOCALES.includes(locale) ? "rtl" : "ltr";
}

/**
 * The path a given route takes in a given locale — the single place that knows
 * the default locale goes unprefixed. Canonicals, hreflang and the sitemap all
 * derive from this, so they cannot drift apart.
 */
export function localePath(locale: Locale, path = "/"): string {
  const suffix = path === "/" ? "" : path;
  // The app has no middleware to rewrite an unprefixed path, so English is
  // prefixed there like every other language. See LOCALE_PREFIX above.
  if (locale === DEFAULT_LOCALE && !IS_NATIVE_BUILD) return suffix || "/";
  return `/${locale}${suffix}`;
}

export const routing = defineRouting({
  // Not LOCALE_CODES: next-intl must not route a locale this build wrote no tree
  // for. On the web the two are the same array.
  locales: SHIPPED_LOCALES,
  defaultLocale: BUILD_DEFAULT_LOCALE,
  localePrefix: LOCALE_PREFIX,
});
