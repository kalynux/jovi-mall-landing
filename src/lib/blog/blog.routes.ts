/**
 * The blog's URL shape, in one place.
 *
 * Same discipline as `lib/marketing/geo.ts`: the sitemap, the breadcrumbs, the
 * hreflang set and every internal link build their paths from here, so the URL
 * shape cannot be changed in one place and missed in four.
 *
 * These are locale-agnostic paths, as authored. `localePath()` prefixes them
 * per language — nothing here knows that English goes unprefixed.
 */

export const BLOG_ROOT = "/blog";

export function articlePath(slug: string): string {
  return `${BLOG_ROOT}/${slug}`;
}

export function categoryPath(slug: string): string {
  return `${BLOG_ROOT}/category/${slug}`;
}
