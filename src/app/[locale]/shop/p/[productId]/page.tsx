/**
 * `/shop/p/:productId` — resolve an ObjectId to the canonical product URL.
 *
 * Products are addressed by `store slug + product slug`, which a link held
 * elsewhere often cannot build: an order line, a push notification's deep link
 * and a saved favourite all carry a product **id** and nothing else. Rather than
 * make every one of those fetch the store first, this redirects.
 *
 * It is a stub, not an address to publish — `robots.ts` should never allow it to
 * be indexed as a second URL for the same product, and nothing internal links to
 * it except the places that genuinely only hold an id.
 */
import { notFound, redirect } from "next/navigation";
import { getProductById, isPreviewRequest } from "@/lib/shop/catalog.api";
import { productPath } from "@/lib/shop/shop.routes";
import { localePath, isLocale } from "@/i18n/routing";
import type { Metadata } from "next";

interface PageProps {
  params: Promise<{ locale: string; productId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Never indexed: this is a redirect, and the canonical lives on the target. */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default async function ProductByIdPage({ params, searchParams }: PageProps) {
  const { locale, productId } = await params;
  if (!isLocale(locale)) notFound();

  const fresh = isPreviewRequest(await searchParams);

  const product = await getProductById(productId, { fresh });
  // `getProductById` returns null for a malformed id as well as an unknown one,
  // because the API answers 400 and 404 for cases a visitor cannot tell apart
  // and neither can we.
  if (!product) notFound();

  // The locale prefix has to be re-applied by hand: `redirect` from
  // `next/navigation` takes a real path, not a locale-relative one.
  //
  // `?preview=1` has to survive the hop too — this route resolves fresh, but the
  // canonical page it lands on would fall back to the cached read and undo the
  // whole point of the flag.
  const target = localePath(locale, productPath(product.store.slug, product.slug));
  redirect(fresh ? `${target}?preview=1` : target);
}
