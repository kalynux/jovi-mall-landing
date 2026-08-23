/**
 * "Add to cart" from a grid, where the row does not carry a variant.
 *
 * A list row is a projection: it has a headline price and an `inStock` boolean,
 * but no variants — and the cart is variant-first, so there is nothing to add
 * without fetching the product. That is not an oversight in the API; a product
 * with three sizes has no single thing to put in a basket, and the previous
 * quick-add only worked because the mock let it grab `variants[0]` sight unseen.
 *
 * So the button resolves first and then does one of two honest things: add the
 * only variant there is, or send the shopper to choose. One extra request, on an
 * explicit click.
 */
import { getProductById } from "./catalog.api";
import type { Product, Variant } from "./shop.types";

export type QuickAddResolution =
  /** Exactly one sellable variant and no options — safe to add without asking. */
  | { kind: "add"; product: Product; variant: Variant }
  /** Options to pick, or several variants — the product page owns this. */
  | { kind: "choose"; product: Product }
  /** Delisted between the page render and the click, or sold out. */
  | { kind: "unavailable" };

/**
 * `defaultVariantId` is only reported when it points at a variant the shopper
 * can actually buy, so it is trustworthy where it exists; the first sellable
 * variant is the fallback for a product whose default was archived.
 */
function defaultVariant(product: Product): Variant | undefined {
  return (
    product.variants.find((v) => v.id === product.defaultVariantId) ?? product.variants[0]
  );
}

export async function resolveQuickAdd(productId: string): Promise<QuickAddResolution> {
  const product = await getProductById(productId);
  if (!product) return { kind: "unavailable" };

  // Services are booked on their own page, never carted.
  if (product.type === "service") return { kind: "choose", product };

  if (product.options.length > 0 || product.variants.length > 1) {
    return { kind: "choose", product };
  }

  const variant = defaultVariant(product);
  if (!variant || !variant.inStock) return { kind: "unavailable" };

  return { kind: "add", product, variant };
}
