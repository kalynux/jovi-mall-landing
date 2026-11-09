/**
 * The saved list's row shape, and the one function that reads it. Pure, so it
 * is tested (wishlist-entry.test.ts); `saved.api.ts` does the request.
 */
import type { CustomerCatalogEntry } from "./saved.api";
import type { PublicListingCard } from "./listings";

/**
 * One row of the SAVED list, which since 2026-11-08 holds products and service
 * listings side by side (api-doc/customer/saved-and-viewed.md § 3, owner RS-1).
 *
 * ⚠ **Branch on `kind`, never on which id is present.** The bot could save a
 * listing before this screen knew listings existed, so a saved list written for
 * products only meets rows with no `productId`.
 *
 * `listing: null` follows the product rule: no longer visible (paused,
 * archived, taken down), rendered as "no longer available" with a working
 * remove, never why.
 */
export type WishlistEntry =
  | ({ kind: "product" } & CustomerCatalogEntry)
  | { kind: "listing"; listingId: string; at: string; listing: PublicListingCard | null };

export type WishlistKind = WishlistEntry["kind"];

/**
 * An API from before 2026-11-08 sends no `kind`; every row it sends is a
 * product. A row with a kind this app does not know is dropped rather than
 * drawn as an empty card.
 */
export function normaliseWishlistEntry(raw: Record<string, unknown>): WishlistEntry | null {
  const kind = raw.kind ?? "product";
  if (kind === "product" && typeof raw.productId === "string") {
    return { ...(raw as unknown as CustomerCatalogEntry), kind: "product" };
  }
  if (kind === "listing" && typeof raw.listingId === "string") {
    return {
      kind: "listing",
      listingId: raw.listingId,
      at: typeof raw.at === "string" ? raw.at : "",
      listing: (raw.listing as PublicListingCard | null | undefined) ?? null,
    };
  }
  return null;
}

