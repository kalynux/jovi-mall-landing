/**
 * The category table — the half of a category the frontend owns.
 *
 * The backend knows only the `key`. The **URL slug and the accent colour are
 * ours**, and the label lives in the message catalog
 * (`pages.blog.categories.<key>`), so a typo in a category name is a copy edit
 * rather than a deploy on two repos.
 *
 * Category slugs are deliberately locale-agnostic, unlike article slugs: a
 * category page is an internal hub whose traffic comes from the blog itself, so
 * the keyword-in-path argument does not apply, and a stable slug keeps
 * `localeAlternates()` usable and one fewer table in sync across five languages.
 *
 * Adding a sixth category is a two-repo change — `CategoryKey` is a union type
 * here and a Zod enum there — so ask before adding one. A category with a
 * single article in it is also an empty hub that dilutes the internal linking
 * it exists to concentrate.
 */
import type { Category, CategoryKey } from "./blog.types";

export const BLOG_CATEGORIES: Category[] = [
  { key: "selling", slug: "selling-on-whatsapp", accent: "role-vendor" },
  { key: "payments", slug: "payments-and-payouts", accent: "role-accent" },
  { key: "delivery", slug: "delivery-and-logistics", accent: "role-agency" },
  { key: "growth", slug: "growing-your-business", accent: "role-customer" },
  { key: "guides", slug: "product-guides", accent: "role-agent" },
];

/**
 * Throws rather than returning undefined. An unknown key means the backend has
 * published a sixth category without the matching frontend change, and a card
 * silently rendering with no label would hide that until someone noticed the
 * gap on a live page.
 */
export function findCategory(key: string): Category {
  const category = BLOG_CATEGORIES.find((candidate) => candidate.key === key);
  if (!category) {
    throw new Error(
      `Unknown article category "${key}". Categories are a two-repo change: add it to ` +
        `CategoryKey in blog.types.ts, to BLOG_CATEGORIES here, and to ` +
        `pages.blog.categories.<key> in all five message catalogs.`
    );
  }
  return category;
}

export function findCategoryBySlugOrNull(slug: string): Category | undefined {
  return BLOG_CATEGORIES.find((candidate) => candidate.slug === slug);
}

/** The hub URL for a key — used when an archived article redirects to it. */
export function categorySlugFor(key: CategoryKey): string {
  return findCategory(key).slug;
}
