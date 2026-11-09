"use client";

import { useTranslations } from "next-intl";

import { useCallback, useEffect } from "react";
import { isNetworkError } from "@/lib/errors/is-network-error";
import { useRouter } from "@/i18n/navigation";
import { ProductCard } from "@/components/shop/ds";
import { useCart, useFavorites, useToast } from "@/components/shop/providers";
import { CART_OFFLINE_MESSAGE_KEY } from "@/lib/shop/cart-errors";
import { deliveryTermsOf } from "@/lib/shop/delivery";
import { productPathFor } from "@/lib/shop/shop.routes";
import { resolveQuickAdd } from "@/lib/shop/quick-add";
import type { ProductListItem } from "@/lib/shop/shop.types";
import { publicUrl } from "@/lib/shop/shop.types";

/**
 * The shop's product card, built from a product list row.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * `<ProductCard>` takes some twenty props, and every surface that drew one used
 * to map the row onto them by hand. They drifted: the product page's two strips
 * had no quick action (so no action row under the price on a fixed-price
 * product), "More from" had no category line and its hearts were never synced.
 * Every surface that shows a **list row** as a card — the browse grid, the
 * product page's strips — goes through here, so a card means the same thing
 * wherever it is drawn.
 *
 * The list row is the same shape from `GET /api/public/products`,
 * `GET /api/public/stores/:slug/products` and the `product` of each
 * `/products/:id/related` entry (api-doc/public/catalog.md), which is what makes
 * one mapping correct for all three.
 */
export function ShopProductCard({
  product,
  showVendor,
  layout = "grid",
}: {
  product: ProductListItem;
  /** Off under a heading that already names the store (grouped browse, "More from"). */
  showVendor: boolean;
  layout?: "grid" | "list";
}) {
  const { isFavorite, toggle } = useFavorites();
  const quickAdd = useQuickAdd();

  return (
    <ProductCard
      layout={layout}
      title={product.title}
      image={publicUrl(product.image)}
      type={product.type}
      price={product.price}
      compareAt={product.compareAtPrice}
      currency={product.currency}
      priceRange={product.priceRange}
      rating={product.rating}
      vendorName={product.store.name}
      vendorVerified={product.store.verified}
      showVendor={showVendor}
      category={product.categories[0]?.name}
      deliveryTerms={deliveryTermsOf(product)}
      favorite={isFavorite(product.id)}
      onToggleFavorite={() => toggle(product.id)}
      inStock={product.inStock}
      negotiable={product.negotiable}
      productId={product.id}
      onQuickAdd={() => void quickAdd(product)}
      href={productPathFor(product)}
      shareable={product}
    />
  );
}

/**
 * A horizontal row of shop cards, each exactly as wide as a column of the
 * browse grid (`.pgrid`) at the same breakpoint — see `.pstrip` in globals.css.
 * It fills the hearts for its rows the way the grid does.
 */
export function ProductStrip({ items, showVendor }: { items: ProductListItem[]; showVendor: boolean }) {
  useSyncFavorites(items);
  return (
    <div className="pstrip">
      {items.map((item) => (
        <ShopProductCard key={item.id} product={item} showVendor={showVendor} />
      ))}
    </div>
  );
}

/**
 * Fill the hearts for a set of rendered rows.
 *
 * One `saved-among` call for the whole set — the endpoint exists for exactly
 * this, and it is why a card does not have to ask on its own. Keyed on the
 * rendered ids so paging or refiltering re-asks and scrolling does not.
 */
export function useSyncFavorites(products: readonly { id: string }[]) {
  const { syncGrid } = useFavorites();
  const renderedIds = products.map((p) => p.id).join(",");
  useEffect(() => {
    if (renderedIds) syncGrid(renderedIds.split(","));
  }, [renderedIds, syncGrid]);
}

/**
 * The card's quick action.
 *
 * A list row has no variant, so this resolves the product before it can add
 * anything. Anything with a choice to make goes to the product page instead of
 * guessing which size the shopper meant.
 */
export function useQuickAdd() {
  const t = useTranslations("shop.browse");
  // Root-scoped: the lib modules emit absolute keys (`shop.status.…`).
  const tKey = useTranslations();
  const router = useRouter();
  const { addItem } = useCart();
  const { flash } = useToast();

  return useCallback(
    async (product: ProductListItem) => {
      try {
        const resolved = await resolveQuickAdd(product.id);

        if (resolved.kind === "unavailable") {
          flash(t("noLongerAvailable"));
          return;
        }
        if (resolved.kind === "choose") {
          router.push(productPathFor(product));
          return;
        }

        const outcome = await addItem(resolved.product, resolved.variant);
        switch (outcome.kind) {
          case "added":
            // Digital is a buy-now, not an add — one product, quantity one,
            // nothing to deliver — so it goes where the card's ⚡ promises it
            // goes: payment.
            if (resolved.product.type === "digital") {
              router.push("/shop/checkout");
              break;
            }
            flash(t("addedToCart", { product: resolved.product.title }));
            break;
          case "type_conflict":
            // The replace prompt belongs on the product page, where the shopper
            // can see what they are about to lose.
            router.push(productPathFor(product));
            break;
          case "digital_limit":
            flash(t("digitalLimit"));
            break;
          case "service_not_allowed":
            router.push(productPathFor(product));
            break;
          case "offline":
            flash(tKey(CART_OFFLINE_MESSAGE_KEY));
            break;
          case "error":
            flash(outcome.message ?? tKey(outcome.messageKey));
            break;
        }
      } catch (err) {
        /**
         * This catch covers `resolveQuickAdd` — a catalogue read — and NOT the
         * add itself, which returns its failures. Both can fail with no signal
         * and both must say so, which is why the sentence is shared with the
         * `offline` case above rather than living only here.
         *
         * The distinction is not academic: the resolve is usually served from
         * the HTTP cache, so on a dead connection this branch tends not to fire
         * while the add behind it does. That is why an offline add went on
         * reporting a raw engine string long after this looked fixed.
         */
        flash(isNetworkError(err) ? tKey(CART_OFFLINE_MESSAGE_KEY) : t("addFailed"));
      }
    },
    [addItem, flash, router, tKey, t]
  );
}
