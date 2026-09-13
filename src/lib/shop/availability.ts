/**
 * What `inStock: false` means, said correctly for each kind of product.
 *
 * Kept out of the components for the same reason `order-status.ts` is: the same
 * judgement is needed in four places — the product card, the product page's
 * variant row, its buy button, and the SKU-match row in search — and getting it
 * wrong is a copy bug the shopper reads as incompetence rather than a styling
 * one.
 *
 * ── Why one boolean needs three sentences ────────────────────────────────────
 *
 * The catalogue publishes a single `inStock` boolean for every product type,
 * deliberately: there are no stock counts by design. But the *fact* it reports
 * differs by type, and the storefront printed the physical-goods sentence over
 * all three. The first card in the default grid was a yoga class, greyed out and
 * captioned "Out of stock" — a service is not stocked, it is scheduled, and a
 * shopper reading that has been told the wrong thing about why they cannot buy.
 *
 * - **physical** — genuinely sold through. "Out of stock" is right.
 * - **service** — no bookable slots. Availability comes from
 *   `GET /api/products/:productId/availability`, not from a shelf.
 * - **digital** — a file cannot run out, so `false` here means the vendor has
 *   withdrawn it. "Out of stock" would be simply untrue.
 */
import type { ProductType } from "./shop.types";

/**
 * ⚠ These are message KEYS, not sentences — see LOCALISATION.md. A non-React
 * module cannot call `useTranslations`, so it names the string and the
 * component translates it with a root-scoped `t()`.
 */
const UNAVAILABLE: Record<ProductType, string> = {
  physical: "shop.status.availability.unavailable.physical",
  digital: "shop.status.availability.unavailable.digital",
  service: "shop.status.availability.unavailable.service",
};

/**
 * The message key for a product that cannot be bought right now.
 *
 * Named `…Key` rather than `…Label` on purpose: the old name returned a
 * sentence, and a call site that kept it would have rendered the raw key with
 * no build error to catch it. The rename makes every consumer a compile error
 * until it has been looked at.
 */
export function unavailableLabelKey(type: ProductType): string {
  return UNAVAILABLE[type];
}

/**
 * The positive counterpart, for the variant row that shows both states.
 *
 * "In stock" is only meaningful for something stocked; a service that has slots
 * is *available*, and a digital product always is.
 */
const AVAILABLE: Record<ProductType, string> = {
  physical: "shop.status.availability.available.physical",
  digital: "shop.status.availability.available.digital",
  service: "shop.status.availability.available.service",
};

export function availabilityLabelKey(type: ProductType, inStock: boolean): string {
  return inStock ? AVAILABLE[type] : UNAVAILABLE[type];
}
