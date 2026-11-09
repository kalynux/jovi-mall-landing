/**
 * The shop ⇄ listings drawers: what the pull tab (phone) and the side rail
 * (desktop) show, and the arithmetic of pulling one open.
 *
 * Pure on purpose, so the rules have tests: the components in
 * `components/shop/drawer/` only draw what this decides.
 */
import { formatMoney } from "@/lib/shop/format";
import type { PublicListingCard } from "@/lib/shop/listings";
import { listingPath, productPathFor } from "@/lib/shop/shop.routes";
import { publicUrl, type ProductListItem } from "@/lib/shop/shop.types";

/** One face the tab or the rail rotates through. */
export interface TeaserItem {
  id: string;
  /** The item's own page: the rail's rows and featured card open it. */
  href: string;
  title: string;
  /** "Company · city" for a listing, the price and the store for a product. */
  subtitle: string;
  image: string | null;
}

export function listingTeaserItems(listings: readonly PublicListingCard[]): TeaserItem[] {
  return listings.map((l) => ({
    id: l.id,
    href: listingPath(l.slug),
    title: l.title,
    subtitle: [l.companyName, l.city].map((s) => s?.trim()).filter(Boolean).join(" · "),
    image: publicUrl(l.photo),
  }));
}

/**
 * A ranged product quotes its lowest price: the tab has no room for "from",
 * and the lowest is the one a shopper can actually pay.
 */
export function productTeaserItems(products: readonly ProductListItem[]): TeaserItem[] {
  return products.map((p) => ({
    id: p.id,
    href: productPathFor(p),
    title: p.title,
    subtitle: `${formatMoney(p.priceRange?.min ?? p.price, p.currency)} · ${p.store.name}`,
    image: publicUrl(p.image),
  }));
}

/** How far through the pull a release must be to open the drawer. */
export const PULL_COMMIT_AT = 0.25;

/** Movement below this is a tap, not a drag. */
export const PULL_SLOP_PX = 8;

/**
 * How far open the drawer is, 0–1, for a pointer that has moved `dx` pixels.
 *
 * The drawer comes in from the inline end, so it is pulled towards the inline
 * start: left in French, right in Arabic. `distance` is how far the drawer's
 * leading edge travels: the whole screen on a phone, the rail's inner edge on a
 * desktop.
 */
export function pullProgress(dx: number, distance: number, rtl: boolean): number {
  if (!(distance > 0)) return 0;
  const toward = rtl ? dx : -dx;
  return Math.min(1, Math.max(0, toward / distance));
}

/** Whether a released pull opens the drawer or springs back. */
export function pullCommits(progress: number, moved: boolean): boolean {
  return moved && progress >= PULL_COMMIT_AT;
}

/** The next face after `index`, wrapping. A list of one never moves. */
export function nextTeaserIndex(index: number, count: number): number {
  return count > 1 ? (index + 1) % count : 0;
}
