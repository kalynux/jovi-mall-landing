/**
 * `/shop/p?id=…` or `/shop/p?store=…&slug=…` — the app's product page.
 *
 * The web addresses a product by its nested, indexable path. The app cannot:
 * `output: "export"` writes one file per known path and the catalogue has none
 * worth prerendering, so the nested route is left out of the app bundle and
 * this single file takes its place. `shop.routes.ts` decides which shape a link
 * takes; nothing else in the codebase knows there are two.
 *
 * A thin server wrapper around a client component, purely so it can carry the
 * `noindex` below — a client component cannot export metadata.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetailClient } from "@/components/shop/ProductDetailClient";
import { isLocale } from "@/i18n/routing";

/**
 * Never indexed. On the web this is a second address for a product that already
 * has a canonical one, which is exactly the duplicate a crawler should not be
 * offered. `robots.ts` disallows it as well — belt and braces, because a
 * `Disallow`ed URL can still be indexed on the strength of an inbound link.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function ProductQueryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return <ProductDetailClient locale={locale} />;
}
