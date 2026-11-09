"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { EmptyState, Icon, ListingCard, Skeleton } from "@/components/shop/ds";
import { ResourceError } from "@/components/shop/account/AccountShell";
import { useShopPageTitle } from "@/components/shop/ShopChrome";
import { listListings, listProductTeaserQuietly } from "@/lib/shop/catalog.api";
import {
  LISTING_PAGE_SIZE,
  parseListingSearchParams,
  type ListingListResponse,
  type ListingResultsQuery,
} from "@/lib/shop/listings";
import { listingsPath } from "@/lib/shop/shop.routes";
import type { ProductListItem } from "@/lib/shop/shop.types";
import { ProductsPullTab, ProductsSideRail } from "./drawer/ShopDrawers";
import { DrawerColumns } from "./drawer/SideRail";
import { useListingSaves } from "./useListingSaves";

/**
 * Every service listing for a search or a category: the page the shop's pull
 * tab and side rail open. A grid of the same cards, paged, with its own tab and
 * rail (in the brand green, rotating products) that pull the shop back in.
 */
export function ListingResults({
  listings,
  query,
  products = [],
}: {
  listings: ListingListResponse;
  query: ListingResultsQuery;
  /** The newest products, for the way back to the shop. Empty means no tab and no rail. */
  products?: readonly ProductListItem[];
}) {
  const t = useTranslations("shop.listings");
  useShopPageTitle(t("resultsTitle"));
  const { data, meta } = listings;
  const saves = useListingSaves(data.map((l) => l.id));
  const backHref = (() => {
    const params = new URLSearchParams();
    if (query.q) params.set("q", query.q);
    if (query.category) params.set("category", query.category);
    const qs = params.toString();
    return qs ? `/shop?${qs}` : "/shop";
  })();

  return (
    <DrawerColumns
      rail={
        products.length > 0 ? <ProductsSideRail listings={data} products={products} href={backHref} /> : null
      }
    >
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      {/* No products to tease (or none could be read): the plain way back. */}
      {products.length === 0 && (
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1.5"
          style={{ minHeight: 36, color: "var(--text-muted)", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
        >
          <Icon name="arrow-left" size={16} className="rtl-flip" />
          {t("backToResults")}
        </Link>
      )}

      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-strong)" }}>
        {query.q ? t("resultsHeadingQuery", { query: query.q }) : t("resultsTitle")}
      </h1>
      <p className="muted" style={{ margin: "4px 0 18px", fontSize: 14, display: "flex", flexWrap: "wrap", columnGap: 10 }}>
        <span style={{ fontWeight: 700 }}>{t("resultsCount", { n: meta.total })}</span>
        <span>{t("shelfLead")}</span>
      </p>

      <ProductsPullTab listings={data} products={products} href={backHref} />

      {data.length === 0 ? (
        <EmptyState
          icon="megaphone"
          title={t("emptyTitle")}
          description={query.q ? t("emptyWithQuery", { query: query.q }) : t("emptyDescription")}
        />
      ) : (
        <div className="pgrid">
          {data.map((listing) => (
            <ListingCard key={listing.id} listing={listing} {...saves.cardProps(listing.id)} />
          ))}
        </div>
      )}

      {meta.pages > 1 && (
        <nav aria-label={t("pagination")} className="mt-8 flex items-center justify-center gap-3">
          {query.page > 1 ? (
            <PageLink href={listingsPath({ ...query, page: query.page - 1 })} icon="chevron-left" label={t("previous")} />
          ) : null}
          <span className="muted" style={{ fontSize: 13 }}>
            {t("pageOf", { page: query.page, pages: meta.pages })}
          </span>
          {query.page < meta.pages ? (
            <PageLink href={listingsPath({ ...query, page: query.page + 1 })} icon="chevron-right" label={t("next")} trailing />
          ) : null}
        </nav>
      )}
    </div>
    </DrawerColumns>
  );
}

function PageLink({
  href,
  icon,
  label,
  trailing = false,
}: {
  href: string;
  icon: "chevron-left" | "chevron-right";
  label: string;
  trailing?: boolean;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-1"
      style={{
        minHeight: 44,
        padding: "0 14px",
        borderRadius: "var(--radius-md)",
        border: "1.5px solid var(--border)",
        background: "var(--surface)",
        color: "var(--text-strong)",
        fontSize: 14,
        fontWeight: 700,
        textDecoration: "none",
      }}
    >
      {!trailing && <Icon name={icon} size={16} className="rtl-flip" />}
      {label}
      {trailing && <Icon name={icon} size={16} className="rtl-flip" />}
    </Link>
  );
}

/* ─── The app's way in ────────────────────────────────────────────────────── */

/** The same page resolved in the browser, for the static app build. */
export function ListingResultsClient() {
  return (
    <Suspense fallback={<ResultsSkeleton />}>
      <ResultsResolver />
    </Suspense>
  );
}

function ResultsResolver() {
  const t = useTranslations("shop.listings");
  const searchParams = useSearchParams();
  const query = parseListingSearchParams(Object.fromEntries(searchParams.entries()));
  const [nonce, setNonce] = useState(0);
  const token = `${searchParams.toString()}#${nonce}`;

  type Settled =
    | { status: "error"; error: unknown }
    | { status: "ready"; listings: ListingListResponse; products: ProductListItem[] };
  const [settled, setSettled] = useState<{ token: string; value: Settled } | null>(null);
  const state: { status: "loading" } | Settled = settled?.token === token ? settled.value : { status: "loading" };

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      listListings({ q: query.q, category: query.category, page: query.page, limit: LISTING_PAGE_SIZE }),
      listProductTeaserQuietly(),
    ])
      .then(([listings, products]) => {
        if (!cancelled) setSettled({ token, value: { status: "ready", listings, products } });
      })
      .catch((error: unknown) => {
        if (!cancelled) setSettled({ token, value: { status: "error", error } });
      });
    return () => {
      cancelled = true;
    };
    // `query` is derived from `token`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (state.status === "loading") return <ResultsSkeleton />;
  if (state.status === "error") {
    return <ResourceError error={state.error} onRetry={() => setNonce((n) => n + 1)} fallback={t("loadFailed")} />;
  }
  return <ListingResults listings={state.listings} query={query} products={state.products} />;
}

function ResultsSkeleton() {
  return (
    <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
      <Skeleton height={28} width="60%" radius={8} />
      <div className="pgrid">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} height={230} radius={16} />
        ))}
      </div>
    </div>
  );
}
