"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { EmptyState, ProductCard, Skeleton } from "@/components/shop/ds";
import { useCart, useFavorites, useToast } from "@/components/shop/providers";
import { CART_OFFLINE_MESSAGE } from "@/lib/shop/cart-errors";
import { getProductById } from "@/lib/shop/catalog.api";
import { productPath } from "@/lib/shop/shop.routes";
import type { Product } from "@/lib/shop/shop.types";

/**
 * Saved products.
 *
 * Favourites are a set of product **ids** in localStorage — they always were,
 * and there is still no wishlist endpoint (Tier 3; it is the one Tier 3 item
 * asked for first in `BACKEND-SHOP-FOLLOWUP.md`). What changed is that there is
 * no in-memory catalogue to look them up in any more, so each is fetched by id.
 *
 * Two consequences worth knowing:
 *
 *  - A favourite that has since been delisted, archived or suspended resolves to
 *    `null` and is **dropped from the list, and from the saved set**. Leaving it
 *    would mean re-fetching a 404 on every visit forever.
 *  - This list does not follow a shopper to another device, and never has.
 */
export default function SavedPage() {
  const router = useRouter();
  const { favorites, toggle } = useFavorites();
  const { addItem } = useCart();
  const { flash } = useToast();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // `favorites` is a Set and a new instance each render, so the effect keys on a
  // stable string of its contents rather than the set itself.
  const ids = Array.from(favorites).sort().join(",");

  useEffect(() => {
    let cancelled = false;
    const list = ids ? ids.split(",") : [];

    if (list.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProducts([]);
      setLoading(false);
      return;
    }

    (async () => {
      setLoading(true);
      const resolved = await Promise.all(list.map((id) => getProductById(id).catch(() => null)));
      if (cancelled) return;

      const found = resolved.filter((p): p is Product => p !== null);
      setProducts(found);
      setLoading(false);

      // Forget the ones that no longer resolve. `toggle` on an id already in the
      // set removes it, which is exactly what a gone product needs.
      const alive = new Set(found.map((p) => p.id));
      for (const id of list) if (!alive.has(id)) toggle(id);
    })();

    return () => {
      cancelled = true;
    };
  }, [ids, toggle]);

  const quickAdd = useCallback(
    async (product: Product) => {
      if (product.type === "service" || product.options.length > 0 || product.variants.length > 1) {
        router.push(productPath(product.store.slug, product.slug));
        return;
      }
      const variant = product.variants.find((v) => v.id === product.defaultVariantId) ?? product.variants[0];
      if (!variant?.inStock) {
        flash("That product is out of stock.");
        return;
      }
      const outcome = await addItem(product, variant);
      if (outcome.kind === "added") flash("Added to cart");
      // Before the `else`, which sends the shopper to the product page to make a
      // choice. A dead connection is not a choice to make, and routing them
      // there would answer a connectivity failure with a page that cannot load
      // either.
      else if (outcome.kind === "offline") flash(CART_OFFLINE_MESSAGE);
      else if (outcome.kind === "error") flash(outcome.message);
      else router.push(productPath(product.store.slug, product.slug));
    },
    [addItem, flash, router]
  );

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      {/* The visible title is the header bar's, on every shop screen. */}
      <h1 className="sr-only">Saved</h1>
      {!loading && (
        <p className="muted" style={{ marginBottom: 14 }}>
          {products.length} item{products.length === 1 ? "" : "s"}
        </p>
      )}

      {loading ? (
        <div className="pgrid">
          {Array.from({ length: Math.min(4, favorites.size || 2) }).map((_, i) => (
            <Skeleton key={i} height={280} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <EmptyState
          icon="heart"
          title="No favorites yet"
          description="Tap the heart on any product to save it here."
          actionLabel="Browse products"
          onAction={() => router.push("/shop")}
        />
      ) : (
        <div className="pgrid">
          {products.map((product) => {
            const variant =
              product.variants.find((v) => v.id === product.defaultVariantId) ?? product.variants[0];
            return (
              <ProductCard
                key={product.id}
                title={product.title}
                image={product.images[0]?.url ?? null}
                type={product.type}
                price={variant?.price ?? 0}
                compareAt={variant?.compareAtPrice}
                currency={variant?.currency}
                vendorName={product.store.name}
                showVendor
                freeDelivery={product.freeDelivery}
                inStock={product.variants.some((v) => v.inStock)}
                favorite
                onToggleFavorite={() => toggle(product.id)}
                onQuickAdd={() => void quickAdd(product)}
                href={productPath(product.store.slug, product.slug)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
