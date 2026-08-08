import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getProductBySlug, getVendorById } from "@/lib/shop/shop.api";
import { ProductDetail } from "@/components/shop/ProductDetail";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, productJsonLd } from "@/lib/seo/jsonld";
import { localeAlternates } from "@/lib/seo/alternates";
import { isLocale } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale: string; productSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, productSlug } = await params;
  if (!isLocale(locale)) notFound();

  const product = await getProductBySlug(productSlug);
  // An unknown slug renders notFound() below; keep it out of the index rather
  // than letting it inherit the shop's canonical.
  if (!product) {
    return { title: "Product not found — WiMall", robots: { index: false, follow: false } };
  }

  const path = `/shop/products/${product.slug}`;
  return {
    title: `${product.title} — WiMall`,
    description: product.desc,
    alternates: localeAlternates(locale, path),
    openGraph: {
      title: product.title,
      description: product.desc,
      images: product.images.slice(0, 1),
      url: path,
      type: "website",
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { locale, productSlug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const product = await getProductBySlug(productSlug);
  if (!product) notFound();
  const vendor = await getVendorById(product.vendorId);
  if (!vendor) notFound();

  return (
    <>
      <JsonLd
        data={[
          productJsonLd(locale, product, vendor),
          breadcrumbJsonLd(locale, [
            { name: "Shop", path: "/shop" },
            { name: vendor.name, path: `/shop/stores/${vendor.slug}` },
            { name: product.title, path: `/shop/products/${product.slug}` },
          ]),
        ]}
      />
      <ProductDetail product={product} vendor={vendor} />
    </>
  );
}
