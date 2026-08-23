import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getStore, isPreviewRequest, listStoreProducts } from "@/lib/shop/catalog.api";
import { VendorStore } from "@/components/shop/VendorStore";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, storeJsonLd } from "@/lib/seo/jsonld";
import { localeAlternates } from "@/lib/seo/alternates";
import { PAGE_SIZE, parseProductSearchParams } from "@/lib/shop/shop.query";
import { storePath } from "@/lib/shop/shop.routes";
import { isLocale } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale: string; storeSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, storeSlug } = await params;
  if (!isLocale(locale)) notFound();

  const store = await getStore(storeSlug);
  if (!store) {
    return { title: "Store not found — Wi-Mall", robots: { index: false, follow: false } };
  }

  const path = storePath(store.slug);
  const where = [store.city, store.country].filter(Boolean).join(", ");

  return {
    title: `${store.name} — Wi-Mall`,
    description: store.description,
    alternates: localeAlternates(locale, path),
    openGraph: {
      title: where ? `${store.name} — ${where}` : store.name,
      description: store.description,
      // `banner` and `logo` are both nullable; a store with neither gets no
      // image rather than a broken one.
      images: [store.banner?.url ?? store.logo?.url].filter((url): url is string => Boolean(url)),
      url: path,
      type: "website",
    },
  };
}

export default async function StorePage({ params, searchParams }: PageProps) {
  const { locale, storeSlug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const resolvedSearchParams = await searchParams;
  const query = parseProductSearchParams(resolvedSearchParams);
  // `?preview=1` — the vendor dashboard's preview iframe, asking to skip the
  // five-minute catalog cache so a vendor sees the edit they just saved. Read
  // freshness only; it unlocks nothing.
  const fresh = isPreviewRequest(resolvedSearchParams);

  // Resolve the store first. Its own endpoint 404s a suspended vendor, and
  // `/stores/:slug/products` 404s too rather than returning an empty grid —
  // which would have said "this seller has nothing" about a suspended shop.
  const store = await getStore(storeSlug, { fresh });
  if (!store) notFound();

  const { data: products, meta } = await listStoreProducts(
    storeSlug,
    { ...query, limit: PAGE_SIZE },
    { fresh }
  );

  return (
    <>
      <JsonLd
        data={[
          storeJsonLd(locale, store),
          breadcrumbJsonLd(locale, [
            { name: "Shop", path: "/shop" },
            { name: store.name, path: storePath(store.slug) },
          ]),
        ]}
      />
      <VendorStore store={store} products={products} meta={meta} activeType={query.type?.[0]} />
    </>
  );
}
