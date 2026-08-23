/**
 * The standalone marketing pages, in one list.
 *
 * The sitemap and every breadcrumb read from here, so a page cannot exist
 * without being submitted — the failure mode that made the old scroll-sections
 * invisible in the first place.
 *
 * This file describes what is *published*, not what is *in the menu*. Menu
 * structure lives in `lib/nav/menu.ts`; the header and footer read that. This
 * used to carry a `nav?: boolean` flag and export `NAV_MARKETING_ROUTES`, but
 * nothing imported it and its flags had drifted out of agreement with the
 * header it claimed to describe — two sources of truth, one of them quietly
 * wrong. It is gone.
 */
import { CITIES, cityPath } from "./geo";

export type MarketingRoute = {
  /** Locale-agnostic path, as authored. `localePath()` prefixes it per language. */
  path: string;
  /** Key under `pages.nav` for the link label. */
  key: string;
  priority: number;
  changeFrequency: "monthly" | "weekly";
};

export const MARKETING_ROUTES: MarketingRoute[] = [
  { path: "/vendors", key: "vendors", priority: 0.9, changeFrequency: "monthly" },
  { path: "/agencies", key: "agencies", priority: 0.8, changeFrequency: "monthly" },
  { path: "/agents", key: "agents", priority: 0.8, changeFrequency: "monthly" },
  // The buying side is the widest search intent of the four — "buy X in Douala"
  // is asked far more often than "sell on WhatsApp" — so it ranks with the
  // vendors page rather than below the two delivery roles.
  { path: "/customers", key: "customers", priority: 0.9, changeFrequency: "monthly" },
  { path: "/pricing", key: "pricing", priority: 0.9, changeFrequency: "monthly" },
  { path: "/faq", key: "faq", priority: 0.7, changeFrequency: "monthly" },
  { path: "/cameroon", key: "cameroon", priority: 0.7, changeFrequency: "monthly" },
  // The company tier. Lower priority than the role pages on purpose: they are
  // what someone searches for, these are what someone checks before trusting
  // them. /careers stays indexable while hiring is closed — the page is honest
  // about that, and it is the JobPosting markup that is gated, not the page.
  { path: "/about", key: "about", priority: 0.6, changeFrequency: "monthly" },
  { path: "/contact", key: "contact", priority: 0.6, changeFrequency: "monthly" },
  { path: "/careers", key: "careers", priority: 0.5, changeFrequency: "monthly" },
];

/**
 * The blog is deliberately not in this list.
 *
 * Its URLs are not a fixed registry: articles and category hubs exist per
 * locale rather than in all five, they carry real `lastModified` dates, and the
 * whole set is gated behind `BLOG_IS_PLACEHOLDER`. `app/sitemap.ts` reads them
 * from `lib/blog/blog.api.ts` instead. The header and footer both link /blog
 * sitewide, so the rule this file exists to enforce — nothing published without
 * being linked — holds there too.
 */

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
