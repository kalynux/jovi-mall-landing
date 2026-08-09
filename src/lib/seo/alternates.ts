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

/**
 * The same job for a route that does **not** exist in every locale, and whose
 * path differs between the locales it does exist in.
 *
 * Articles are both: a post translated into English and French exists in two
 * languages, and its French URL is `/fr/blog/comment-vendre-…`, not the English
 * slug under a French prefix. `localeAlternates()` would advertise five
 * alternates for it, three of which 404 — and a crawler that follows an
 * hreflang to a 404 stops trusting the whole cluster.
 *
 * So the caller passes the map of locales to paths it actually has (for an
 * article, `ResolvedArticle.pathByLocale`). `x-default` points at the default
 * locale's version when there is one, and is simply omitted when there is not —
 * an article that exists only in French should not nominate a fallback that
 * does not exist.
 */
export function variantAlternates(
  locale: Locale,
  pathByLocale: Partial<Record<Locale, string>>
): Metadata["alternates"] {
  const languages: Record<string, string> = { ...pathByLocale };
  const fallback = pathByLocale[DEFAULT_LOCALE];
  if (fallback) languages["x-default"] = fallback;

  return { canonical: pathByLocale[locale], languages };
}
