/**
 * Canonical origin for everything a crawler reads — `metadataBase`, canonicals,
 * robots.txt, the sitemap and the JSON-LD graph.
 *
 * Crawlers reject relative URLs in og:image and in structured data, so this has
 * to resolve even in preview builds; hence the fallback rather than a bare env
 * read. Set NEXT_PUBLIC_SITE_URL in production — if it is wrong, every canonical
 * and every sitemap entry points at the wrong host.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://wimall.com"
).replace(/\/+$/, "");

/** Absolute URL for a site-relative path (`/shop` → `https://wimall.com/shop`). */
export function absoluteUrl(path = "/"): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
