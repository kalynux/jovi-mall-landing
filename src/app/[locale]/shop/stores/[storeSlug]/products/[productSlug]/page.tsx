/**
 * The product page — and the canonical product URL.
 *
 * It takes **two** slugs. `Product.slug` is unique per vendor, not globally
 * (`{ vendorId: 1, slug: 1 }`), so two sellers may both own `blue-shirt` and
 * there is no such thing as `/shop/products/:slug`. The old flat route only ever
 * worked because the catalogue was invented. `/shop/p/:id` handles the case
 * where a link holds an id and not a store slug.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getProduct, isPreviewRequest, listStoreProducts } from "@/lib/shop/catalog.api";
import { ProductDetail } from "@/components/shop/ProductDetail";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo/jsonld";
import { localeAlternates } from "@/lib/seo/alternates";
import { productPath, storePath } from "@/lib/shop/shop.routes";
import { isLocale } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale: string; storeSlug: string; productSlug: string }>;
  /**
   * Only `?preview=1` is read, and only by the page — `generateMetadata` stays
   * on the cached path, because the vendor's preview iframe never renders a
   * `<head>` anyone reads.
   */
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, storeSlug, productSlug } = await params;
  if (!isLocale(locale)) notFound();

  const product = await getProduct(storeSlug, productSlug);
  // An unknown slug renders notFound() below; keep it out of the index rather
  // than letting it inherit anything.
  if (!product) {
    return { title: "Product not found — Wi-Mall", robots: { index: false, follow: false } };
  }

  const path = productPath(product.store.slug, product.slug);
  // The vendor's own SEO fields win where they set them — that is what they are
  // for — and the product's own title/description are the fallback.
  const title = product.seo?.title ?? product.title;
  const description = product.seo?.description ?? product.description;

  return {
    title: `${title} — Wi-Mall`,
    description,
    alternates: localeAlternates(locale, path),
    openGraph: {
      title,
      description,
      images: product.images.slice(0, 1).map((image) => image.url),
      url: path,
      type: "website",
    },
  };
}

export default async function ProductPage({ params, searchParams }: PageProps) {
  const { locale, storeSlug, productSlug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  // `?preview=1` — the vendor dashboard's preview iframe, asking to skip the
  // five-minute catalog cache. Read freshness only: a draft still 404s below,
  // because the API refuses it.
  const fresh = isPreviewRequest(await searchParams);

  const product = await getProduct(storeSlug, productSlug, { fresh });
  if (!product) notFound();

  /**
   * "More from this store", not "related products".
   *
   * There is no recommender — `getRelatedProducts` used to return same-vendor
   * items from the mock and call it related. A store's own catalogue is a real
   * query, so this asks for one more than it shows and drops the product the
   * shopper is already looking at.
   */
  const { data: storeProducts } = await listStoreProducts(storeSlug, { limit: 7 }, { fresh });
  const moreFromStore = storeProducts.filter((item) => item.id !== product.id).slice(0, 6);

  return (
    <>
      <JsonLd
        data={[
          productJsonLd(locale, product),
          breadcrumbJsonLd(locale, [
            { name: "Shop", path: "/shop" },
            { name: product.store.name, path: storePath(product.store.slug) },
            { name: product.title, path: productPath(product.store.slug, product.slug) },
          ]),
        ]}
      />
      <ProductDetail product={product} locale={locale} moreFromStore={moreFromStore} />
    </>
  );
}
