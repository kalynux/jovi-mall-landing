"use client";

import { useTranslations } from "next-intl";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { VendorStore } from "./VendorStore";
import { EmptyState, Skeleton } from "@/components/shop/ds";
import { ResourceError } from "@/components/shop/account/AccountShell";
import { getStore, listStoreProducts } from "@/lib/shop/catalog.api";
import { isProductType } from "@/lib/shop/shop.types";
import type { ListMeta, ProductListItem, ProductType, Store } from "@/lib/shop/shop.types";

/**
 * A vendor's storefront, resolved from `?s=<storeSlug>` instead of a path.
 *
 * The app's counterpart to `/shop/stores/[storeSlug]`, for the reason set out
 * in `shop.routes.ts`: a static export has no server to resolve a path segment
 * against, and there is no fixed set of stores to prerender.
 *
 * `?type=` is carried through so the tab a shopper picks survives a reload and
 * a share — the same contract the server page has, where the grid is fetched
 * with the type the URL names.
 */
/** `useSearchParams()` suspends during prerender — see `ShopBrowserClient`. */
export function VendorStoreClient() {
  return (
    <Suspense fallback={<StoreSkeleton />}>
      <StoreResolver />
    </Suspense>
  );
}

function StoreResolver() {
  const t = useTranslations("shop.store");
  const searchParams = useSearchParams();
  const slug = searchParams.get("s");
  const rawType = searchParams.get("type");
  const activeType: ProductType | undefined = isProductType(rawType) ? rawType : undefined;

  type Settled =
    | { status: "error"; error: unknown }
    | { status: "missing" }
    | { status: "ready"; store: Store; products: ProductListItem[]; meta: ListMeta };

  const [nonce, setNonce] = useState(0);
  const token = `${slug ?? ""}|${activeType ?? ""}#${nonce}`;

  const [settled, setSettled] = useState<{ token: string; value: Settled } | null>(null);

  /**
   * Derived rather than set in the effect — see `ShopBrowserClient`.
   *
   * A URL with no `?s=` is answered here rather than in the effect: it is a
   * property of the query, not the result of a request, and deciding it in
   * render means no flash of a skeleton for a page that was never going to
   * load anything.
   */
  const state: { status: "loading" } | Settled = !slug
    ? { status: "missing" }
    : settled?.token === token
      ? settled.value
      : { status: "loading" };

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    /**
     * The store is resolved first, then its grid — not both at once.
     *
     * `listStoreProducts` throws for a store that is not public rather than
     * answering an empty page, because an empty grid would say "this seller has
     * nothing" about a suspended vendor. Running them in parallel would turn a
     * closed store into an error screen; sequencing turns it into "this store
     * isn't available", which is what happened. The server page resolves in the
     * same order for the same reason.
     */
    (async () => {
      const store = await getStore(slug);
      if (!store) return { status: "missing" as const };

      const { data: products, meta } = await listStoreProducts(
        slug,
        activeType ? { type: [activeType] } : {}
      );
      return { status: "ready" as const, store, products, meta };
    })()
      .then((value) => {
        if (!cancelled) setSettled({ token, value });
      })
      .catch((error: unknown) => {
        if (!cancelled) setSettled({ token, value: { status: "error", error } });
      });

    return () => {
      cancelled = true;
    };
    // `slug` and `activeType` are both folded into `token`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (state.status === "loading") return <StoreSkeleton />;

  if (state.status === "error") {
    return (
      <ResourceError
        error={state.error}
        onRetry={() => setNonce((n) => n + 1)}
        fallback={t("loadFailed")}
      />
    );
  }

  if (state.status === "missing") {
    return (
      <EmptyState
        icon="store"
        title={t("unavailableTitle")}
        description={t("unavailableDescription")}
      />
    );
  }

  return (
    <VendorStore
      store={state.store}
      products={state.products}
      meta={state.meta}
      activeType={activeType}
    />
  );
}

/** Banner and avatar, then the type tabs, then a page of cards. */
function StoreSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <Skeleton height={140} radius={0} />
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 14 }}>
        <Skeleton height={26} width="56%" />
        <div style={{ display: "flex", gap: 8 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} height={32} width={78} radius={999} />
          ))}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
            gap: 12,
          }}
        >
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} height={232} radius={14} />
          ))}
        </div>
      </div>
    </div>
  );
}
