import type { MetadataRoute } from "next";
import { getVendors, listProducts } from "@/lib/shop/shop.api";
import { blogSitemapEntries } from "@/lib/blog/blog.api";
import { absoluteUrl } from "@/lib/site";
import { DEFAULT_LOCALE, LOCALE_CODES, localePath, type Locale } from "@/i18n/routing";
import { MARKETING_SITEMAP_ROUTES } from "@/lib/marketing/routes";

/**
 * Public URLs only — the auth and cart/checkout routes blocked in robots.ts are
 * deliberately absent, since listing a disallowed URL in a sitemap is a
 * contradiction Search Console flags.
 *
 * Each route appears once at its default-locale URL, carrying `alternates` for
 * the other four. That is the sitemap form of hreflang, and it means a crawler
 * that only fetches the sitemap still discovers all five language variants.
 *
 * No `lastModified`: the catalog carries no timestamps, and a fabricated date
 * (today, on every build) trains crawlers to ignore the field. Add it when
 * products come from the API with real `updatedAt` values.
 */
function entry(
  path: string,
  changeFrequency: "daily" | "weekly" | "monthly",
  priority: number
) {
  return {
    url: absoluteUrl(localePath(DEFAULT_LOCALE, path)),
    changeFrequency,
    priority,
    alternates: {
      languages: Object.fromEntries(
        LOCALE_CODES.map((locale) => [locale, absoluteUrl(localePath(locale, path))])
      ),
    },
  };
}

/**
 * The same thing for a URL that does *not* exist in every locale and whose path
 * differs between the ones it does — an article, or a category hub that is
 * empty in three languages.
 *
 * `entry()` above assumes one path and five locales, which for an article
 * translated into two would submit three URLs that 404. It also takes a real
 * `lastModified`, which the shop half deliberately has none of.
 */
function variantEntry(
  pathByLocale: Partial<Record<Locale, string>>,
  changeFrequency: "weekly" | "monthly",
  priority: number,
  lastModified?: string
) {
  const paths = Object.entries(pathByLocale) as [Locale, string][];
  // Canonical row is the default locale's URL when it exists, else the first
  // translation — a French-only article is still submitted, at its French URL.
  const canonical = pathByLocale[DEFAULT_LOCALE] ?? paths[0][1];

  return {
    url: absoluteUrl(canonical),
    changeFrequency,
    priority,
    ...(lastModified ? { lastModified: new Date(lastModified) } : {}),
    alternates: {
      languages: Object.fromEntries(paths.map(([locale, path]) => [locale, absoluteUrl(path)])),
    },
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ data: products }, vendors] = await Promise.all([listProducts(), getVendors()]);

  // Empty while the blog is unlaunched — see BLOG_IS_PLACEHOLDER.
  const blog = await blogSitemapEntries();

  return [
    entry("/", "weekly", 1),
    // The standalone marketing pages. They come from the same registry the
    // footer links from, so a page cannot be published without being both
    // linked and submitted — which is exactly how the landing page's per-role
    // scroll sections stayed invisible.
    ...MARKETING_SITEMAP_ROUTES.map((route) =>
      entry(route.path, route.changeFrequency, route.priority)
    ),
    // The index is a real page in all five locales even where it is empty, so
    // it takes the ordinary entry; the articles and hubs below do not.
    ...(blog.length ? [entry("/blog", "weekly", 0.8)] : []),
    ...blog.map((item) =>
      variantEntry(item.pathByLocale, item.changeFrequency, item.priority, item.lastModified)
    ),
    entry("/shop", "daily", 0.8),
    ...vendors.map((vendor) => entry(`/shop/stores/${vendor.slug}`, "weekly", 0.6)),
    ...products.map((product) => entry(`/shop/products/${product.slug}`, "weekly", 0.7)),
  ];
}
