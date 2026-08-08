/**
 * The standalone marketing pages, in one list.
 *
 * The sitemap, the footer's "Platform" column and every breadcrumb read from
 * here, so a page cannot exist without being linked and submitted — the failure
 * mode that made the old scroll-sections invisible in the first place.
 *
 * `nav` marks the handful that earn a slot in the header; everything else is
 * reachable from the footer and from in-page links.
 */
import { CITIES, cityPath } from "./geo";

export type MarketingRoute = {
  /** Locale-agnostic path, as authored. `localePath()` prefixes it per language. */
  path: string;
  /** Key under `pages.nav` for the link label. */
  key: string;
  priority: number;
  changeFrequency: "monthly" | "weekly";
  /** Show in the primary header nav. */
  nav?: boolean;
};

export const MARKETING_ROUTES: MarketingRoute[] = [
  { path: "/vendors", key: "vendors", priority: 0.9, changeFrequency: "monthly", nav: true },
  { path: "/agencies", key: "agencies", priority: 0.8, changeFrequency: "monthly" },
  { path: "/agents", key: "agents", priority: 0.8, changeFrequency: "monthly" },
  { path: "/pricing", key: "pricing", priority: 0.9, changeFrequency: "monthly", nav: true },
  { path: "/faq", key: "faq", priority: 0.7, changeFrequency: "monthly" },
  { path: "/cameroon", key: "cameroon", priority: 0.7, changeFrequency: "monthly" },
];

/** Every marketing URL including the per-city pages — what the sitemap submits. */
export const MARKETING_SITEMAP_ROUTES: MarketingRoute[] = [
  ...MARKETING_ROUTES,
  ...CITIES.map((city) => ({
    path: cityPath(city.slug),
    key: `city.${city.slug}`,
    priority: 0.6,
    changeFrequency: "monthly" as const,
  })),
];

export const NAV_MARKETING_ROUTES = MARKETING_ROUTES.filter((route) => route.nav);
