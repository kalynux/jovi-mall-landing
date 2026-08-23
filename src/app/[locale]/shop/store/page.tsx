/**
 * `/shop/store?s=<storeSlug>` — the app's vendor storefront.
 *
 * The query-string counterpart to `/shop/stores/[storeSlug]`, for the reason
 * set out in `shop.routes.ts`. Server wrapper only so it can carry `noindex`.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { VendorStoreClient } from "@/components/shop/VendorStoreClient";
import { isLocale } from "@/i18n/routing";

/** A second address for a store that already has a canonical one. */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function StoreQueryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return <VendorStoreClient />;
}
