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
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  getProduct,
  isPreviewRequest,
  listRelatedProducts,
  listStoreProducts,
} from "@/lib/shop/catalog.api";
import { ProductDetail } from "@/components/shop/ProductDetail";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo/jsonld";
import { localeAlternates } from "@/lib/seo/alternates";
import { productPath, storePath } from "@/lib/shop/shop.routes";
import { isLocale } from "@/i18n/routing";
import { publicUrl } from "@/lib/shop/shop.types";

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
  const t = await getTranslations({ locale, namespace: "shop.meta" });

  const product = await getProduct(storeSlug, productSlug);
  // An unknown slug renders notFound() below; keep it out of the index rather
  // than letting it inherit anything.
  if (!product) {
    return { title: t("productNotFound"), robots: { index: false, follow: false } };
  }

  const path = productPath(product.store.slug, product.slug);
  // The vendor's own SEO fields win where they set them — that is what they are
  // for — and the product's own title/description are the fallback.
  const title = product.seo?.title ?? product.title;
  const description = product.seo?.description ?? product.description;

  return {
    title: t("productTitle", { product: title }),
    description,
    alternates: localeAlternates(locale, path),
    openGraph: {
      title,
      description,
      // `publicUrl` filters out authorized files, which have no URL a crawler
      // could fetch. Product imagery is public, so this is normally a no-op.
      images: product.images
        .map((image) => publicUrl(image))
        .filter((url): url is string => url !== null)
        .slice(0, 1),
      url: path,
      type: "website",
    },
  };
}

export default async function ProductPage({ params, searchParams }: PageProps) {
  const { locale, storeSlug, productSlug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "shop.meta" });

  // `?preview=1` — the vendor dashboard's preview iframe, asking to skip the
  // five-minute catalog cache. Read freshness only: a draft still 404s below,
  // because the API refuses it.
  const fresh = isPreviewRequest(await searchParams);

  const product = await getProduct(storeSlug, productSlug, { fresh });
  if (!product) notFound();

  /**
   * Two strips, and they are not the same claim.
   *
   * "More from this store" is a plain query over the vendor's own catalogue.
   * The related strip is the platform's recommender, and its `meta.source` says
   * which of two signals produced it — genuine co-purchase, or a same-category
   * fallback. The heading has to follow that, which is why the source is carried
   * into the component rather than resolved here.
   */
  const { data: storeProducts } = await listStoreProducts(storeSlug, { limit: 7 }, { fresh });
  const moreFromStore = storeProducts.filter((item) => item.id !== product.id).slice(0, 6);

  const related = await listRelatedProducts(product.id);

  return (
    <>
      <JsonLd
        data={[
          productJsonLd(locale, product),
          breadcrumbJsonLd(locale, [
            { name: t("breadcrumbShop"), path: "/shop" },
            { name: product.store.name, path: storePath(product.store.slug) },
            { name: product.title, path: productPath(product.store.slug, product.slug) },
          ]),
        ]}
      />
      <ProductDetail
        product={product}
        locale={locale}
        moreFromStore={moreFromStore}
        related={related.items}
        relatedSource={related.source}
      />
    </>
  );
}
