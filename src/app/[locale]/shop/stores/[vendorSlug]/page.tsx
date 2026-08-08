import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getVendorBySlug } from "@/lib/shop/shop.api";
import { VendorStore } from "@/components/shop/VendorStore";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, storeJsonLd } from "@/lib/seo/jsonld";
import { localeAlternates } from "@/lib/seo/alternates";
import { isLocale } from "@/i18n/routing";

interface PageProps {
  params: Promise<{ locale: string; vendorSlug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, vendorSlug } = await params;
  if (!isLocale(locale)) notFound();

  const vendor = await getVendorBySlug(vendorSlug);
  if (!vendor) {
    return { title: "Store not found — WiMall", robots: { index: false, follow: false } };
  }

  const path = `/shop/stores/${vendor.slug}`;
  return {
    title: `${vendor.name} — WiMall`,
    description: vendor.desc,
    alternates: localeAlternates(locale, path),
    openGraph: {
      title: `${vendor.name} — ${vendor.city}, ${vendor.country}`,
      description: vendor.desc,
      images: [vendor.banner],
      url: path,
      type: "website",
    },
  };
}

export default async function VendorPage({ params }: PageProps) {
  const { locale, vendorSlug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);

  const vendor = await getVendorBySlug(vendorSlug);
  if (!vendor) notFound();

  return (
    <>
      <JsonLd
        data={[
          storeJsonLd(locale, vendor),
          breadcrumbJsonLd(locale, [
            { name: "Shop", path: "/shop" },
            { name: vendor.name, path: `/shop/stores/${vendor.slug}` },
          ]),
        ]}
      />
      <VendorStore vendor={vendor} />
    </>
  );
}
