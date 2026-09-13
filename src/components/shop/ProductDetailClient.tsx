"use client";

import { useTranslations } from "next-intl";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProductDetail } from "./ProductDetail";
import { EmptyState, Skeleton } from "@/components/shop/ds";
import { ResourceError } from "@/components/shop/account/AccountShell";
import { getProduct, getProductById, listStoreProducts, listRelatedProducts } from "@/lib/shop/catalog.api";
import type { Product, ProductListItem } from "@/lib/shop/shop.types";

/**
 * The product page, resolved from a query string instead of a path.
 *
 * ── Why the app cannot use `/shop/stores/:store/products/:product` ───────────
 *
 * A static export writes one HTML file per known path, and the catalogue has no
 * known paths — it is paginated, unbounded, and changes without a rebuild. So
 * the nested route is left out of the app bundle entirely (`build-native.mjs`)
 * and the app addresses a product by query instead, which needs exactly one
 * file and resolves against the live API like every other screen.
 *
 * The web keeps its nested URLs untouched. `shop.routes.ts` is what chooses
 * between the two shapes, which is why no call site had to change.
 *
 * ── Two ways to name a product, because callers hold different things ────────
 *
 *   ?id=…              an order line, a favourite, a push notification's target
 *   ?store=…&slug=…    a product card, a store grid, a share link
 *
 * Both resolve here rather than one redirecting to the other: a redirect costs
 * a second round trip on a connection this product is built for, and the app
 * has no crawler to keep a canonical URL for.
 */
/** `useSearchParams()` suspends during prerender — see `ShopBrowserClient`. */
export function ProductDetailClient({ locale }: { locale: string }) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductResolver locale={locale} />
    </Suspense>
  );
}

function ProductResolver({ locale }: { locale: string }) {
  const t = useTranslations("shop.product");
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const storeSlug = searchParams.get("store");
  const productSlug = searchParams.get("slug");

  type Settled =
    | { status: "error"; error: unknown }
    | { status: "missing" }
    | {
        status: "ready";
        product: Product;
        moreFromStore: ProductListItem[];
        related: { items: { product: ProductListItem; orders: number | null }[]; source: "co_purchase" | "same_category" };
      };

  const [nonce, setNonce] = useState(0);
  const token = `${id ?? ""}|${storeSlug ?? ""}|${productSlug ?? ""}#${nonce}`;

  const [settled, setSettled] = useState<{ token: string; value: Settled } | null>(null);

  /** Derived rather than set in the effect — see `ShopBrowserClient`. */
  const state: { status: "loading" } | Settled =
    settled?.token === token ? settled.value : { status: "loading" };

  useEffect(() => {
    let cancelled = false;

    const resolve = async () => {
      const product = id
        ? await getProductById(id)
        : storeSlug && productSlug
          ? await getProduct(storeSlug, productSlug)
          : null;

      if (!product) return { status: "missing" as const };

      /**
       * "More from this store" — a plain query over the vendor's catalogue,
       * which is a different claim from the recommender strip below it. Asks for
       * one more than it shows so the product already on screen can be dropped
       * without leaving a gap.
       *
       * Its failure is swallowed on purpose: a strip below the fold is not
       * worth replacing a product page with an error.
       */
      const moreFromStore = await listStoreProducts(product.store.slug, { limit: 7 })
        .then(({ data }) => data.filter((item) => item.id !== product.id).slice(0, 6))
        .catch(() => [] as ProductListItem[]);

      // The recommender. Its own failure is already swallowed inside
      // `listRelatedProducts`, which answers an empty same-category strip.
      const related = await listRelatedProducts(product.id);

      return { status: "ready" as const, product, moreFromStore, related };
    };

    resolve()
      .then((value) => {
        if (!cancelled) setSettled({ token, value });
      })
      .catch((error: unknown) => {
        if (!cancelled) setSettled({ token, value: { status: "error", error } });
      });

    return () => {
      cancelled = true;
    };
    // `id`, `storeSlug` and `productSlug` are all folded into `token`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (state.status === "loading") return <ProductSkeleton />;

  if (state.status === "error") {
    return (
      <ResourceError
        error={state.error}
        onRetry={() => setNonce((n) => n + 1)}
        fallback={t("loadFailed")}
      />
    );
  }

  /**
   * The web page calls `notFound()` here. There is no server to render a 404 in
   * the app, and an unknown product is not an error the shopper caused — most
   * often it is a link to something a vendor has since unpublished — so it says
   * so and offers the way back.
   */
  if (state.status === "missing") {
    return (
      <EmptyState
        icon="package-x"
        title={t("unavailableTitle")}
        description={t("unavailableDescription")}
      />
    );
  }

  return (
    <ProductDetail
      product={state.product}
      locale={locale}
      moreFromStore={state.moreFromStore}
      related={state.related.items}
      relatedSource={state.related.source}
    />
  );
}

/** Gallery, then title and price, then the buy block. */
function ProductSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14, padding: 16 }}>
      <Skeleton height={320} radius={16} />
      <Skeleton height={26} width="72%" />
      <Skeleton height={22} width="38%" />
      <Skeleton height={72} radius={12} />
      <Skeleton height={48} radius={12} />
    </div>
  );
}
