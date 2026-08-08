"use client";

import { useRouter } from "@/i18n/navigation";
import { EmptyState, ProductCard } from "@/components/shop/ds";
import { useCart, useFavorites, useToast } from "@/components/shop/providers";
import { products } from "@/lib/shop/shop.fixtures";
import { findVendorById } from "@/lib/shop/shop.api";
import type { Product } from "@/lib/shop/shop.types";

export default function SavedPage() {
  const router = useRouter();
  const { favorites, toggle } = useFavorites();
  const { addToCart } = useCart();
  const { flash } = useToast();

  const favs = products.filter((p) => favorites.has(p.id));

  const quickAdd = (p: Product) =>
    p.type === "service" ? router.push(`/shop/products/${p.slug}`) : (addToCart(p, p.variants[0]), flash("Added to cart"));

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6">
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-strong)", margin: 0 }}>Saved</h1>
        <span className="muted">{favs.length} items</span>
      </div>

      {favs.length === 0 ? (
        <EmptyState
          icon="heart"
          title="No favorites yet"
          description="Tap the heart on any product to save it here."
          actionLabel="Browse products"
          onAction={() => router.push("/shop")}
        />
      ) : (
        <div className="pgrid">
          {favs.map((p) => (
            <ProductCard
              key={p.id}
              title={p.title}
              image={p.images[0]}
              type={p.type}
              price={p.price}
              compareAt={p.compareAt}
              rating={p.rating}
              reviewCount={p.reviews}
              vendorName={findVendorById(p.vendorId)?.name}
              showVendor
              deliveryLabel={p.delivery}
              inStock={p.inStock}
              favorite
              onToggleFavorite={() => toggle(p.id)}
              onQuickAdd={() => quickAdd(p)}
              onClick={() => router.push(`/shop/products/${p.slug}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
