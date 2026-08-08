import type { Metadata } from "next";
import { DEFAULT_LOCALE, LOCALE_CODES, localePath, type Locale } from "@/i18n/routing";

/**
 * Canonical + hreflang set for one route, in every locale it exists in.
 *
 * Must be attached per page rather than on the layout: metadata is inherited,
 * so a set declared once at the top would tell crawlers that every route is the
 * homepage — the exact bug this project already had.
 *
 * The canonical is the *current* locale's path, so /fr/shop points at itself
 * and not at /shop; the hreflang list is what ties the five variants together.
 * `x-default` points at the unprefixed English path, which is what a crawler
 * should offer when it can match none of the listed languages.
 */
export function localeAlternates(locale: Locale, path = "/"): Metadata["alternates"] {
  const languages = Object.fromEntries([
    ...LOCALE_CODES.map((code) => [code, localePath(code, path)]),
    ["x-default", localePath(DEFAULT_LOCALE, path)],
  ]);

  return { canonical: localePath(locale, path), languages };
}
