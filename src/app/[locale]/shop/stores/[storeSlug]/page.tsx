import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getStore, isPreviewRequest, listStoreProducts } from "@/lib/shop/catalog.api";
import { VendorStore } from "@/components/shop/VendorStore";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, storeJsonLd } from "@/lib/seo/jsonld";
import { localeAlternates } from "@/lib/seo/alternates";
import { PAGE_SIZE, parseProductSearchParams } from "@/lib/shop/shop.query";
import { publicUrl } from "@/lib/shop/shop.types";
import { storePath } from "@/lib/shop/shop.routes";
import { isLocale } from "@/i18n/routing";
import { SHARE_IMAGES } from "@/lib/seo/share";

interface PageProps {
  params: Promise<{ locale: string; storeSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, storeSlug } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "shop.meta" });

  const store = await getStore(storeSlug);
  if (!store) {
    return { title: t("storeNotFound"), robots: { index: false, follow: false } };
  }

  const path = storePath(store.slug);
  const where = [store.city, store.country].filter(Boolean).join(", ");
  const storeShareImages = [publicUrl(store.banner) ?? publicUrl(store.logo)].filter(
    (url): url is string => Boolean(url),
  );

  return {
    title: t("storeTitle", { store: store.name }),
    description: store.description,
    alternates: localeAlternates(locale, path),
    openGraph: {
      title: where ? t("storeOgTitle", { store: store.name, where }) : store.name,
      description: store.description,
      // `banner` and `logo` are both nullable. Resolved through `publicUrl` so
      // a file held back by its owner's storage plan is treated as absent — a
      // scraper fetching a dead og:image is worse than one that never existed.
      //
      // A store with neither falls back to the site card rather than to
      // nothing: `openGraph` replaces the layout's block instead of merging
      // with it (see lib/seo/share.ts), so an empty array here is a blank
      // share, not an inherited one.
      images: storeShareImages.length ? storeShareImages : SHARE_IMAGES,
      url: path,
      type: "website",
    },
  };
}

export default async function StorePage({ params, searchParams }: PageProps) {
  const { locale, storeSlug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "shop.meta" });

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
            { name: t("breadcrumbShop"), path: "/shop" },
            { name: store.name, path: storePath(store.slug) },
          ]),
        ]}
      />
      <VendorStore store={store} products={products} meta={meta} activeType={query.type?.[0]} />
    </>
  );
}
