/**
 * The marketplace index — browse, search, filter and sort.
 *
 * ── Why this is a server component now ───────────────────────────────────────
 *
 * It used to be a 450-line client component that held the whole catalogue in
 * memory and filtered an array. That worked only because the catalogue was
 * invented and small. The real one is paginated, so filtering has to happen at
 * the API, which means the query has to live somewhere both the server and a
 * shareable link can read: the URL.
 *
 * So `searchParams` is the single source of truth for what is on screen. The
 * grid is rendered on the server from it — which is also what makes the products
 * visible to a crawler, the whole point of having a sitemap — and `ShopBrowser`
 * is a client child that owns the controls and pushes changes back into the URL.
 * A shopper can now share a filtered view, and the back button steps through
 * filter changes instead of leaving the page.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { listCategories, listProducts, resolveVariantBySku } from "@/lib/shop/catalog.api";
import { parseProductSearchParams } from "@/lib/shop/shop.query";
import { ShopBrowser } from "@/components/shop/ShopBrowser";
import { ShopBrowserClient } from "@/components/shop/ShopBrowserClient";
import { IS_NATIVE_BUILD } from "@/lib/platform";
import { localeAlternates } from "@/lib/seo/alternates";
import { isLocale } from "@/i18n/routing";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The canonical for `/shop` lives here rather than on the layout.
 *
 * It was on the layout only because this page used to be a client component and
 * could not export metadata. A canonical on a layout applies to every route
 * beneath it, so `/shop/cart` and `/shop/saved` were each declaring `/shop` as
 * their canonical URL — harmless in practice because robots.txt blocks them, but
 * it is the kind of thing that stops being harmless the moment a route is
 * unblocked. Now that this is a server component the self-reference sits on the
 * page it describes.
 *
 * Note it deliberately does **not** vary with `searchParams`: every filtered
 * view canonicalises to bare `/shop`, so a crawler is not offered a combinatorial
 * set of near-duplicate URLs to index.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "shop.meta" });

  return {
    title: t("shopTitle"),
    description: t("shopDescription"),
    alternates: localeAlternates(locale, "/shop"),
  };
}

/**
 * Two ways in, one grid.
 *
 * The app build must not touch `searchParams` — reading it forces dynamic
 * rendering, which `output: "export"` refuses — and must not fetch here, or the
 * catalogue would be baked into the APK at build time. So it returns before
 * either happens and lets `ShopBrowserClient` resolve the same query in the
 * browser. `IS_NATIVE_BUILD` is a compile-time constant, so the web build drops
 * the branch and this stays the server component it has always been.
 */
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  if (IS_NATIVE_BUILD) return <ShopBrowserClient />;

  const query = parseProductSearchParams(await searchParams);

  // One round trip each, both cached for 300s by the API's own Cache-Control.
  // The categories call is the second of the two the public rate-limit bucket
  // was sized for.
  const [{ data: products, meta }, categories] = await Promise.all([
    listProducts(query),
    listCategories(),
  ]);

  /*
     A second lookup, and only ever after the first one came back empty.

     `?q=` is a `$text` search over title, tags and description; it does not
     index SKU and never will, so a customer typing a code off a package or a
     WhatsApp message got a blank page indistinguishable from "we do not sell
     that". This asks the one question the search cannot.

     Conditional on purpose: it is an extra round trip, and on a query that
     matched products it would buy nothing. */
  const skuMatch = products.length === 0 && query.q ? await resolveVariantBySku(query.q) : null;

  return (
    <ShopBrowser
      products={products}
      meta={meta}
      categories={categories}
      query={query}
      skuMatch={skuMatch}
    />
  );
}
