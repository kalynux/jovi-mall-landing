/**
 * `/shop/listing?s=<slug>` — the app's service-listing page.
 *
 * The query-string counterpart to `/shop/listings/[slug]`, for the reason set
 * out in `shop.routes.ts`. Server wrapper only so it can carry `noindex`: on
 * the web it is a second address for a page that has a canonical one.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingDetailClient } from "@/components/shop/ListingDetailClient";
import { isLocale } from "@/i18n/routing";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ListingQueryPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <ListingDetailClient />;
}
