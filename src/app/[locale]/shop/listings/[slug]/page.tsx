/**
 * A service listing's page, and its canonical URL: `/shop/listings/:slug`.
 *
 * Server-rendered for the same reason the product page is: what a business
 * does and where is exactly what someone searches for. The contacts are not
 * here, and never in the HTML: a signed-in customer unlocks them one at a
 * time from the browser (`ListingContacts`). The app reaches the same page
 * as `/shop/listing?s=<slug>`; see `shop.routes.ts`.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getListing, isPreviewRequest } from "@/lib/shop/catalog.api";
import { ListingDetail } from "@/components/shop/ListingDetail";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, listingJsonLd } from "@/lib/seo/jsonld";
import { localeAlternates } from "@/lib/seo/alternates";
import { listingPath } from "@/lib/shop/shop.routes";
import { isLocale } from "@/i18n/routing";
import { publicUrl } from "@/lib/shop/shop.types";
import { placeParts } from "@/lib/shop/listings";
import { SHARE_IMAGES } from "@/lib/seo/share";

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "shop.listings.meta" });
  const tListings = await getTranslations({ locale, namespace: "shop.listings" });

  const listing = await getListing(slug);
  if (!listing) return { title: t("notFound"), robots: { index: false, follow: false } };

  const path = listingPath(listing.slug);
  const name = listing.companyName || listing.title;
  const parts = placeParts(listing);
  const where = parts.length ? tListings("place", { first: parts[0], second: parts[1] ?? "", count: parts.length }) : "";
  const hasWhere = where ? "yes" : "no";
  const description =
    listing.description?.trim() || t("fallbackDescription", { title: listing.title, name, where, hasWhere });
  const images = listing.photos
    .map((photo) => publicUrl(photo))
    .filter((url): url is string => url !== null)
    .slice(0, 1);

  return {
    title: t("title", { title: listing.title, name, where, hasWhere }),
    description,
    alternates: localeAlternates(locale, path),
    openGraph: {
      title: listing.title,
      description,
      // `openGraph` replaces the layout's block rather than merging, so a
      // listing with no photo must still name the site card (lib/seo/share.ts).
      images: images.length ? images : SHARE_IMAGES,
      url: path,
      type: "website",
    },
  };
}

export default async function ListingPage({ params, searchParams }: PageProps) {
  const { locale, slug } = await params;
  if (!isLocale(locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "shop.meta" });

  // The provider dashboard's preview, as on the product page: freshness only.
  const fresh = isPreviewRequest(await searchParams);
  const listing = await getListing(slug, { fresh });
  if (!listing) notFound();

  return (
    <>
      <JsonLd
        data={[
          listingJsonLd(locale, listing),
          breadcrumbJsonLd(locale, [
            { name: t("breadcrumbShop"), path: "/shop" },
            { name: listing.title, path: listingPath(listing.slug) },
          ]),
        ]}
      />
      <ListingDetail listing={listing} />
    </>
  );
}
