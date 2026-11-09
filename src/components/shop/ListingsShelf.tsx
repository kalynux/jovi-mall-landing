"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Icon, ListingCard } from "@/components/shop/ds";
import type { ListingListResponse } from "@/lib/shop/listings";
import { listingsPath } from "@/lib/shop/shop.routes";
import { useListingSaves } from "./useListingSaves";

/**
 * Service listings above the products: the ones matching a search or a
 * category, or on plain /shop the newest ones.
 *
 * Its own section rather than cards mixed into the grid: the API pages
 * listings and products separately, so any interleaving would be an order we
 * invented, and the two are different things to do (contact a business, buy a
 * product). On a phone it is a swipeable row, so it costs one card's height
 * before the products; from 768px it is a grid (see `.listing-rail`).
 *
 * Renders nothing when nothing matched, so the products page is unchanged for
 * every search a listing does not answer.
 */
export function ListingsShelf({
  listings,
  query,
}: {
  listings: ListingListResponse;
  query: { q?: string; category?: string };
}) {
  const t = useTranslations("shop.listings");
  const saves = useListingSaves(listings.data.map((l) => l.id));
  if (listings.data.length === 0) return null;

  const total = Math.max(listings.meta.total, listings.data.length);
  const more = total > listings.data.length;

  return (
    <section aria-labelledby="listings-shelf-heading" className="mb-7">
      {/* Heading and "See all" share a row; the one-line subtitle gets the
          full width under them, so it never wraps on a phone. */}
      <div className="flex items-center gap-3">
        <h2
          id="listings-shelf-heading"
          className="min-w-0 flex-1"
          style={{ margin: 0, fontSize: 17, fontWeight: 800, letterSpacing: "-0.01em", color: "var(--text-strong)" }}
        >
          {t("shelfHeading", { n: total })}
        </h2>
        {more && (
          <Link
            href={listingsPath(query)}
            className="inline-flex shrink-0 items-center gap-1"
            style={{
              minHeight: 44,
              fontSize: 13.5,
              fontWeight: 700,
              color: "var(--type-listing)",
              textDecoration: "none",
            }}
          >
            {t("seeAll", { n: total })}
            <Icon name="chevron-right" size={16} className="rtl-flip" />
          </Link>
        )}
      </div>
      <p className="muted" style={{ margin: more ? "-6px 0 10px" : "2px 0 10px", fontSize: 13, lineHeight: 1.45 }}>
        {t("shelfLead")}
      </p>

      <div className="listing-rail">
        {listings.data.map((listing) => (
          <ListingCard key={listing.id} listing={listing} {...saves.cardProps(listing.id)} />
        ))}
      </div>
    </section>
  );
}
