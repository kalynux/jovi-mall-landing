import { defineRouting } from "next-intl/routing";

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
  if (locale === DEFAULT_LOCALE) return suffix || "/";
  return `/${locale}${suffix}`;
}

export const routing = defineRouting({
  locales: LOCALE_CODES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "as-needed",
});
