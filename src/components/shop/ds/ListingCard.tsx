"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  drawableFields,
  FIELD_ICON,
  fieldLabelKey,
  placeParts,
  type PublicListingCard,
} from "@/lib/shop/listings";
import { listingPath } from "@/lib/shop/shop.routes";
import { publicUrl } from "@/lib/shop/shop.types";
import { Icon } from "./Icon";

/**
 * A service listing in a list of results.
 *
 * It shares the product card's shell (surface, border, radius, lift) so the
 * two sit together on one page, and differs in everything that says what it
 * is. A 4:3 photo, not a square. The blue "Service listing" mark, never the
 * amber "Service" of a bookable product. A place line where a product has its
 * price. The kinds of contact it offers, drawn as icons.
 *
 * ⛔ No price and no credit cost, ever. The customer pays nothing, and what
 * the business pays is not the customer's business.
 *
 * Its width comes from the container: `.listing-rail` (a swipeable row on a
 * phone, a grid from 768px) or a `.pgrid` cell.
 */
export function ListingCard({ listing }: { listing: PublicListingCard }) {
  const t = useTranslations("shop.listings");
  const tKey = useTranslations();
  const image = publicUrl(listing.photo);
  const place = placeParts(listing);
  const fields = drawableFields(listing.availableFields);

  const shell: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    boxShadow: "var(--shadow-card)",
    textDecoration: "none",
    color: "inherit",
  };

  return (
    <Link href={listingPath(listing.slug)} className="fadein lift ds-card" style={shell} data-kind="listing">
      <div className="listing-card__photo" style={{ position: "relative", background: "var(--type-listing-bg)" }}>
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={image}
            alt=""
            loading="lazy"
            // Out of flow, so the box's aspect-ratio decides the height rather
            // than the photo's own proportions.
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
          />
        ) : (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              color: "var(--type-listing)",
              opacity: 0.55,
            }}
          >
            <Icon name="megaphone" size={34} strokeWidth={1.6} />
          </div>
        )}
        <span className="listing-mark" style={{ position: "absolute", top: 8, insetInlineStart: 8 }}>
          <Icon name="megaphone" size={12} strokeWidth={2.4} />
          {t("kind")}
        </span>
      </div>

      <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 4, flex: "1 1 auto" }}>
        {/* `ds-ugc`: both strings are the business's own, in any script. */}
        <div
          className="ds-ugc"
          style={{
            fontSize: 14,
            fontWeight: 700,
            lineHeight: 1.3,
            color: "var(--text-strong)",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {listing.title}
        </div>
        {listing.companyName && (
          <div
            className="ds-ugc"
            style={{
              fontSize: 12.5,
              fontWeight: 600,
              color: "var(--text-body)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {listing.companyName}
          </div>
        )}
        {place.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12.5,
              color: "var(--text-muted)",
              minWidth: 0,
            }}
          >
            <Icon name="map-pin" size={13} style={{ flexShrink: 0 }} />
            <span className="ds-ugc" style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {t("place", { first: place[0], second: place[1] ?? "", count: place.length })}
            </span>
          </div>
        )}

        {fields.length > 0 && (
          <div
            style={{
              marginTop: "auto",
              paddingTop: 8,
              display: "flex",
              alignItems: "center",
              gap: 6,
              color: "var(--type-listing)",
            }}
          >
            {/* The icons name what can be unlocked, so a sighted reader and a
                screen reader get the same list. */}
            <span
              role="img"
              aria-label={t("offers", { list: fields.map((f) => tKey(fieldLabelKey(f))).join(", ") })}
              style={{ display: "inline-flex", gap: 6 }}
            >
              {fields.slice(0, 4).map((field) => (
                <Icon key={field} name={FIELD_ICON[field]} size={15} />
              ))}
            </span>
            {fields.length > 4 && (
              <span style={{ fontSize: 12, fontWeight: 700 }} aria-hidden="true">
                {t("moreFields", { n: fields.length - 4 })}
              </span>
            )}
            <span
              style={{
                marginInlineStart: "auto",
                fontSize: 12.5,
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: 2,
              }}
            >
              {t("viewContacts")}
              <Icon name="chevron-right" size={14} className="rtl-flip" />
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}
