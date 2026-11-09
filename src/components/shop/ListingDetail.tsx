"use client";

import { useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Chip, Icon, IconButton, Rating } from "@/components/shop/ds";
import { useShopPageTitle } from "@/components/shop/ShopChrome";
import { useToast } from "@/components/shop/providers";
import { useHydrated } from "@/lib/use-hydrated";
import { shareLink } from "@/lib/native/share";
import { categoryPath, listingShareUrl } from "@/lib/shop/shop.routes";
import { publicUrl } from "@/lib/shop/shop.types";
import {
  dayDate,
  placeParts,
  sortedHours,
  todayIn,
  type ListingOpeningHours,
  type PublicListingDetail,
} from "@/lib/shop/listings";
import { ListingContacts } from "./ListingContacts";
import { ListingReviewSection } from "./ListingReviewSection";
import { useListingSaves } from "./useListingSaves";

/**
 * A service listing's page.
 *
 * ── Order is the argument ────────────────────────────────────────────────────
 *
 * A phone reads it top to bottom: photo, what and where, the contacts, then
 * the description and the hours. The contacts come before the description
 * because unlocking one is the only thing to do here, and on a 390px screen a
 * description pushes them below the fold.
 *
 * From 768px it becomes two columns: the photo with the description and the
 * hours under it, and beside them the header and contacts, which stay in view
 * (sticky) from 1024px while the left column scrolls. Same DOM on every size;
 * the grid places it.
 *
 * Every string here except the labels is the business's own, so each one
 * carries `ds-ugc` (direction from its own first letter).
 */
export function ListingDetail({ listing }: { listing: PublicListingDetail }) {
  const t = useTranslations("shop.listings");
  const locale = useLocale();
  const router = useRouter();
  const { flash } = useToast();
  useShopPageTitle(listing.title);

  const photos = listing.photos.filter((photo) => publicUrl(photo));
  const [index, setIndex] = useState(0);
  const current = photos[Math.min(index, Math.max(photos.length - 1, 0))];
  const place = placeParts(listing);
  const hours = sortedHours(listing.openingHours);
  const saves = useListingSaves([listing.id]);
  const saved = saves.isSaved(listing.id);
  // Bumped on every unlock, so the review section re-asks whether this
  // customer may now rate the business.
  const [revealCount, setRevealCount] = useState(0);

  const share = () => {
    void shareLink({
      title: listing.title,
      url: listingShareUrl(locale, listing.slug),
      dialogTitle: t("shareDialogTitle", { name: listing.companyName || listing.title }),
    }).then((outcome) => {
      if (outcome === "copied") flash(t("linkCopied"));
      else if (outcome === "failed") flash(t("shareFailed"));
    });
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">
      <button
        type="button"
        onClick={() => router.push("/shop")}
        className="mb-4 inline-flex items-center gap-1.5"
        style={{
          minHeight: 36,
          border: "none",
          background: "none",
          cursor: "pointer",
          color: "var(--text-muted)",
          fontSize: 13,
          fontWeight: 600,
          padding: 0,
        }}
      >
        <Icon name="arrow-left" size={16} className="rtl-flip" /> {t("backToShop")}
      </button>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start lg:gap-10">
        {/* ── Photos ─────────────────────────────────────────────────────── */}
        <div className="md:col-start-1 md:row-start-1">
          <div
            style={{
              position: "relative",
              aspectRatio: "4 / 3",
              background: "var(--type-listing-bg)",
              borderRadius: "var(--radius-lg)",
              overflow: "hidden",
            }}
          >
            {current ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={publicUrl(current)!}
                alt={t("photoAlt", { name: listing.companyName || listing.title, n: index + 1 })}
                // Out of flow: the 4:3 box decides the height, whatever the photo's shape.
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" }}
              />
            ) : (
              <div
                aria-hidden="true"
                style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "var(--type-listing)", opacity: 0.5 }}
              >
                <Icon name="megaphone" size={56} strokeWidth={1.4} />
              </div>
            )}
          </div>
          {photos.length > 1 && (
            <div className="row-chips" style={{ marginTop: 10, gap: 8 }}>
              {photos.map((photo, i) => (
                <button
                  key={photo.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={t("photoAria", { n: i + 1 })}
                  aria-pressed={i === index}
                  style={{
                    flexShrink: 0,
                    width: 64,
                    height: 48,
                    padding: 0,
                    borderRadius: "var(--radius-sm)",
                    overflow: "hidden",
                    cursor: "pointer",
                    background: "none",
                    border: i === index ? "2px solid var(--type-listing)" : "1.5px solid var(--border)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={publicUrl(photo)!} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── What, where, and the way in ────────────────────────────────── */}
        <div className="md:col-start-2 md:row-span-2 md:row-start-1 lg:sticky lg:top-20">
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span className="listing-mark">
              <Icon name="megaphone" size={12} strokeWidth={2.4} />
              {t("kind")}
            </span>
            <span style={{ marginInlineStart: "auto", display: "inline-flex", gap: 8 }}>
              <IconButton
                icon="heart"
                variant="fav"
                active={saved}
                label={t(saved ? "unsave" : "save")}
                onClick={() => saves.toggle(listing.id)}
              />
              <IconButton icon="share-2" variant="surface" label={t("share")} onClick={share} />
            </span>
          </div>

          <h1
            className="ds-ugc"
            style={{
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: "-0.02em",
              lineHeight: 1.2,
              margin: "0 0 8px",
              color: "var(--text-strong)",
              textWrap: "balance",
            }}
          >
            {listing.title}
          </h1>

          {/* Only when someone reviewed it; a tap goes to what they said. */}
          {listing.rating && listing.rating.count > 0 && (
            <a
              href="#listing-reviews"
              aria-label={t("ratingAria", { average: listing.rating.average.toFixed(1), count: listing.rating.count })}
              style={{ display: "inline-flex", marginBottom: 8, textDecoration: "none", color: "inherit" }}
            >
              <Rating value={listing.rating.average} count={listing.rating.count} />
            </a>
          )}

          <div style={{ display: "grid", gap: 6, marginBottom: 12 }}>
            {listing.companyName && (
              <MetaLine icon="store">
                <span className="ds-ugc" style={{ fontWeight: 700, color: "var(--text-body)" }}>
                  {listing.companyName}
                </span>
              </MetaLine>
            )}
            {place.length > 0 && (
              <MetaLine icon="map-pin">
                <span className="ds-ugc">
                  {t("place", { first: place[0], second: place[1] ?? "", count: place.length })}
                </span>
              </MetaLine>
            )}
            {hours.length > 0 && <OpenNow hours={hours} />}
          </div>

          {listing.categories.length > 0 && (
            <div className="row-chips" style={{ flexWrap: "wrap", marginBottom: 16 }}>
              {/* `Chip` is a <button>, so it navigates itself rather than
                  sitting inside a link (a button in an <a> is invalid). */}
              {listing.categories.map((category) => (
                <Chip key={category.id} size="sm" onClick={() => router.push(categoryPath(category.slug))}>
                  {category.name}
                </Chip>
              ))}
            </div>
          )}

          <ListingContacts listing={listing} onRevealed={() => setRevealCount((n) => n + 1)} />
        </div>

        {/* ── About ───────────────────────────────────────────────────────── */}
        <div className="grid gap-4 md:col-start-1 md:row-start-2">
          {listing.description.trim() && (
            <Card title={t("aboutTitle")}>
              <p
                className="ds-ugc"
                style={{ margin: 0, fontSize: 14.5, lineHeight: 1.65, color: "var(--text-body)", whiteSpace: "pre-wrap", maxWidth: "70ch" }}
              >
                {listing.description}
              </p>
            </Card>
          )}
          {hours.length > 0 && (
            <Card title={t("hoursTitle")}>
              <HoursTable hours={hours} />
            </Card>
          )}
          <ListingReviewSection listing={listing} revealCount={revealCount} />
        </div>
      </div>
    </div>
  );
}

function MetaLine({ icon, children }: { icon: "store" | "map-pin" | "clock"; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 14, color: "var(--text-muted)", minWidth: 0 }}>
      <Icon name={icon} size={16} style={{ flexShrink: 0 }} />
      <span style={{ minWidth: 0 }}>{children}</span>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 16,
      }}
    >
      <h2 style={{ margin: "0 0 10px", fontSize: 16, fontWeight: 800, color: "var(--text-strong)" }}>{title}</h2>
      {children}
    </section>
  );
}

/* ─── Hours ───────────────────────────────────────────────────────────────── */

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Douala's clock, as minutes past midnight. */
function nowMinutesIn(timeZone = "Africa/Douala"): number {
  const parts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone }).format(new Date());
  return minutes(parts);
}

/**
 * "Open now · until 18:00" / "Closed now", from the business's own hours in
 * Douala time. Only after hydration: the server's clock is not the reader's,
 * and a mismatch would be a hydration error for nothing.
 */
function OpenNow({ hours }: { hours: ListingOpeningHours[] }) {
  const t = useTranslations("shop.listings.hours");
  const hydrated = useHydrated();
  if (!hydrated) return null;

  const today = hours.find((row) => row.day === todayIn());
  let open = false;
  if (today && !today.isClosed) {
    const now = nowMinutesIn();
    const from = minutes(today.openTime);
    const to = minutes(today.closeTime);
    // A close before the open is a night that runs past midnight.
    open = to > from ? now >= from && now < to : now >= from || now < to;
  }

  return (
    <MetaLine icon="clock">
      <span style={{ fontWeight: 700, color: open ? "var(--success)" : "var(--text-body)" }}>
        {open && today ? t("openUntil", { time: today.closeTime }) : t("closedNow")}
      </span>
    </MetaLine>
  );
}

function HoursTable({ hours }: { hours: ListingOpeningHours[] }) {
  const t = useTranslations("shop.listings.hours");
  const format = useFormatter();
  const hydrated = useHydrated();
  const today = hydrated ? todayIn() : null;

  return (
    <dl style={{ margin: 0, display: "grid", gap: 2 }}>
      {hours.map((row) => {
        const isToday = row.day === today;
        return (
          <div
            key={row.day}
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              padding: "7px 10px",
              borderRadius: "var(--radius-sm)",
              background: isToday ? "var(--type-listing-bg)" : "transparent",
              fontSize: 14,
            }}
          >
            <dt style={{ fontWeight: isToday ? 800 : 600, color: "var(--text-strong)" }}>
              {format.dateTime(dayDate(row.day), { weekday: "long", timeZone: "UTC" })}
            </dt>
            <dd style={{ margin: 0, color: row.isClosed ? "var(--text-muted)" : "var(--text-body)", fontVariantNumeric: "tabular-nums" }}>
              {row.isClosed ? t("closed") : <span dir="ltr">{t("range", { from: row.openTime, to: row.closeTime })}</span>}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}
