/**
 * `/shop/listings?q=&category=&page=` — every service listing for a search or
 * a category: the page the shop's pull tab and side rail open.
 *
 * Server-rendered on the web, like the product grid, and resolved in the
 * browser in the app (no `searchParams` and no fetch at export time; see
 * `shop/page.tsx` for why). Every filtered view canonicalises to the bare path.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { listListings, listProductTeaserQuietly } from "@/lib/shop/catalog.api";
import { ListingResults, ListingResultsClient } from "@/components/shop/ListingResults";
import { LISTING_PAGE_SIZE, parseListingSearchParams } from "@/lib/shop/listings";
import { IS_NATIVE_BUILD } from "@/lib/platform";
import { localeAlternates } from "@/lib/seo/alternates";
import { LISTINGS_ROOT } from "@/lib/shop/shop.routes";
import { isLocale } from "@/i18n/routing";

type SearchParams = Record<string, string | string[] | undefined>;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "shop.listings.meta" });
  return {
    title: t("resultsTitle"),
    description: t("resultsDescription"),
    alternates: localeAlternates(locale, LISTINGS_ROOT),
  };
}

export default async function ListingResultsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  if (IS_NATIVE_BUILD) return <ListingResultsClient />;

  const query = parseListingSearchParams(await searchParams);
  // The products teaser feeds the tab and rail back to the shop; it is quiet,
  // so a product outage costs the way back its preview, never this page.
  const [listings, products] = await Promise.all([
    listListings({
      q: query.q,
      category: query.category,
      page: query.page,
      limit: LISTING_PAGE_SIZE,
    }),
    listProductTeaserQuietly(),
  ]);

  return <ListingResults listings={listings} query={query} products={products} />;
}
