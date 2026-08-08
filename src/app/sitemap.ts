import type { MetadataRoute } from "next";
import { getVendors, listProducts } from "@/lib/shop/shop.api";
import { absoluteUrl } from "@/lib/site";
import { DEFAULT_LOCALE, LOCALE_CODES, localePath } from "@/i18n/routing";
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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ data: products }, vendors] = await Promise.all([listProducts(), getVendors()]);

  return [
    entry("/", "weekly", 1),
    // The standalone marketing pages. They come from the same registry the
    // footer links from, so a page cannot be published without being both
    // linked and submitted — which is exactly how the landing page's per-role
    // scroll sections stayed invisible.
    ...MARKETING_SITEMAP_ROUTES.map((route) =>
      entry(route.path, route.changeFrequency, route.priority)
    ),
    entry("/shop", "daily", 0.8),
    ...vendors.map((vendor) => entry(`/shop/stores/${vendor.slug}`, "weekly", 0.6)),
    ...products.map((product) => entry(`/shop/products/${product.slug}`, "weekly", 0.7)),
  ];
}
