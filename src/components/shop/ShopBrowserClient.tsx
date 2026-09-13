"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ShopBrowser } from "./ShopBrowser";
import { Skeleton } from "@/components/shop/ds";
import { ResourceError } from "@/components/shop/account/AccountShell";
import { listCategories, listProducts, resolveVariantBySku } from "@/lib/shop/catalog.api";
import type { VariantBySku } from "@/lib/shop/catalog.api";
import { parseProductSearchParams } from "@/lib/shop/shop.query";
import type { CategoryCount, ListMeta, ProductListItem } from "@/lib/shop/shop.types";

/**
 * The catalogue, resolved in the browser instead of on a server.
 *
 * ── Why the app needs a second way in ────────────────────────────────────────
 *
 * `/shop` is a server component, and deliberately so: rendering the grid on the
 * server is what puts products in front of a crawler, which is the entire point
 * of the sitemap. Neither half of that survives a static export. There is no
 * server on a phone, so the fetch would run at **build** time and bake a
 * catalogue that is stale the moment the APK is signed — and the page reads
 * `searchParams`, which forces dynamic rendering and fails an export outright.
 *
 * So the native build renders this instead. It is not a rewrite: it calls the
 * same two `catalog.api` functions with the same parsed query and hands the
 * same four props to the same `ShopBrowser`. `catalog.api` was written
 * isomorphic for exactly this kind of caller — `/shop/cart` and `/shop/saved`
 * already resolve products from the browser today.
 *
 * ── The URL is still the state ───────────────────────────────────────────────
 *
 * `ShopBrowser` writes every control change into the query string and
 * navigates; nothing filters an array in memory. That contract is preserved
 * here — `useSearchParams()` is the input, so the back button still steps
 * through filter changes and a shared link still opens the same filtered view.
 * The only difference is who reads the URL.
 */
/**
 * The Suspense boundary is required, not decorative.
 *
 * `useSearchParams()` has no value during prerender — there is no request — so
 * a component that calls it suspends, and Next refuses to build a static page
 * whose bailout has nowhere to land:
 *
 *     useSearchParams() should be wrapped in a suspense boundary at page
 *     "/[locale]/shop"
 *
 * The fallback is the skeleton rather than `null` because this *is* what the
 * first frame shows on a device: the shell paints, the query resolves on
 * hydration, and the grid follows. A null fallback would show the header and
 * tab bar around an empty middle.
 */
export function ShopBrowserClient() {
  return (
    <Suspense fallback={<CatalogSkeleton />}>
      <ShopBrowserResolver />
    </Suspense>
  );
}

function ShopBrowserResolver() {
  const searchParams = useSearchParams();
  const query = parseProductSearchParams(Object.fromEntries(searchParams.entries()));

  type Settled =
    | { status: "error"; error: unknown }
    | {
        status: "ready";
        products: ProductListItem[];
        meta: ListMeta;
        categories: CategoryCount[];
        skuMatch: VariantBySku | null;
      };

  /**
   * Keyed on the serialised query rather than the parsed object, which is a new
   * reference on every render and would re-fetch forever as a dependency. The
   * nonce is what lets "Try again" re-run a request for a URL that has not
   * changed — the whole case a retry button exists for.
   */
  const [nonce, setNonce] = useState(0);
  const token = `${searchParams.toString()}#${nonce}`;

  const [settled, setSettled] = useState<{ token: string; value: Settled } | null>(null);

  /**
   * Loading is **derived**, not stored: a result whose token no longer matches
   * the query on screen is by definition stale, so it reads as loading without
   * anyone having to set it.
   *
   * Writing `setState({ status: "loading" })` at the top of the effect would be
   * the obvious alternative and is what `react-hooks/set-state-in-effect`
   * forbids — it renders once with the old data, then again with the spinner,
   * so a filter change flashes the previous results before clearing.
   */
  const state: { status: "loading" } | Settled =
    settled?.token === token ? settled.value : { status: "loading" };

  useEffect(() => {
    let cancelled = false;

    Promise.all([listProducts(query), listCategories()])
      .then(async ([{ data: products, meta }, categories]) => {
        // The same product-code fallback the web page runs, so the packaged app
        // does not quietly lose it: `?q=` cannot match a SKU, and a customer
        // reading a code off a package is if anything more likely to be on a
        // phone. Only asked for when the ordinary search found nothing.
        const skuMatch =
          products.length === 0 && query.q ? await resolveVariantBySku(query.q) : null;
        if (!cancelled) {
          setSettled({ token, value: { status: "ready", products, meta, categories, skuMatch } });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setSettled({ token, value: { status: "error", error } });
      });

    return () => {
      cancelled = true;
    };
    // `query` is derived from `token`; listing it too would defeat the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (state.status === "loading") return <CatalogSkeleton />;

  if (state.status === "error") {
    return (
      <ResourceError
        error={state.error}
        onRetry={() => setNonce((n) => n + 1)}
        fallback="We couldn't load the shop."
      />
    );
  }

  return (
    <ShopBrowser
      products={state.products}
      meta={state.meta}
      categories={state.categories}
      query={query}
      skuMatch={state.skuMatch}
    />
  );
}

/**
 * Roughly the shape of the grid it replaces — a header block, a filter row and
 * a page of cards — so the layout does not jump when the products land.
 */
function CatalogSkeleton() {
  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
      <Skeleton height={40} radius={12} />
      <div style={{ display: "flex", gap: 8 }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={32} width={84} radius={999} />
        ))}
      </div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
          gap: 12,
        }}
      >
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} height={232} radius={14} />
        ))}
      </div>
    </div>
  );
}
