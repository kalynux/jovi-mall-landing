"use client";

import { useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ListingCard } from "@/components/shop/ds";
import { ShopProductCard } from "@/components/shop/ShopProductCard";
import { listingTeaserItems, productTeaserItems, type TeaserItem } from "@/lib/shop/drawer-teaser";
import type { PublicListingCard } from "@/lib/shop/listings";
import type { ProductListItem } from "@/lib/shop/shop.types";
import { PullTab } from "./PullTab";
import { SideRail } from "./SideRail";
import { RAIL_WIDTH, TONE, TabFace, tabShellStyle, type DrawerTone } from "./TeaserParts";

/**
 * The two sides of the shop, wired: on /shop the tab and the rail lead to the
 * listings, on /shop/listings they lead back to the products. Each side's
 * drawer previews the other page with the data this page already holds, so
 * what slides in is close to what the router then shows.
 */

interface Sides {
  listings: readonly PublicListingCard[];
  products: readonly ProductListItem[];
  /** Where the drawer goes. */
  href: string;
}

/* ─── On /shop: toward the listings ───────────────────────────────────────── */

export function ListingsPullTab({ listings, products, href }: Sides) {
  const t = useTranslations("shop.drawer");
  const items = useMemo(() => listingTeaserItems(listings), [listings]);
  return (
    <PullTab
      href={href}
      tone="listing"
      label={t("viewListings")}
      ariaLabel={t("openListings")}
      items={items}
      preview={<ListingsPreview listings={listings} products={products} />}
    />
  );
}

export function ListingsSideRail({ listings, products, href }: Sides) {
  const t = useTranslations("shop.drawer");
  const tListings = useTranslations("shop.listings");
  const items = useMemo(() => listingTeaserItems(listings), [listings]);
  return (
    <SideRail
      href={href}
      tone="listing"
      heading={tListings("resultsTitle")}
      lead={tListings("shelfLead")}
      lidLabel={t("lidListings")}
      ariaLabel={t("openListings")}
      seeAllLabel={t("seeAllListings")}
      items={items}
      preview={<ListingsPreview listings={listings} products={products} />}
    />
  );
}

/* ─── On /shop/listings: back toward the products ─────────────────────────── */

export function ProductsPullTab({ listings, products, href }: Sides) {
  const t = useTranslations("shop.drawer");
  const items = useMemo(() => productTeaserItems(products), [products]);
  return (
    <PullTab
      href={href}
      tone="product"
      label={t("viewProducts")}
      ariaLabel={t("openProducts")}
      items={items}
      preview={<ProductsPreview listings={listings} products={products} />}
    />
  );
}

export function ProductsSideRail({ listings, products, href }: Sides) {
  const t = useTranslations("shop.drawer");
  const items = useMemo(() => productTeaserItems(products), [products]);
  return (
    <SideRail
      href={href}
      tone="product"
      heading={t("lidProducts")}
      lead={t("productsLead")}
      lidLabel={t("lidProducts")}
      ariaLabel={t("openProducts")}
      seeAllLabel={t("seeAllProducts")}
      items={items}
      preview={<ProductsPreview listings={listings} products={products} />}
    />
  );
}

/* ─── The previews ────────────────────────────────────────────────────────── */

/** The listings page as it will arrive: heading, its own tab, the cards. */
function ListingsPreview({ listings, products }: Omit<Sides, "href">) {
  const tListings = useTranslations("shop.listings");
  const tDrawer = useTranslations("shop.drawer");
  const back = useMemo(() => productTeaserItems(products), [products]);
  return (
    <PreviewPage railTone={back.length ? "product" : null}>
      <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text-strong)" }}>
        {tListings("resultsTitle")}
      </h1>
      <p className="muted" style={{ margin: "4px 0 16px", fontSize: 14 }}>
        {tListings("shelfLead")}
      </p>
      <StaticTab items={back} tone="product" label={tDrawer("viewProducts")} />
      <div className="pgrid">
        {listings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
      </div>
    </PreviewPage>
  );
}

/** The shop as it will arrive: its tagline, its own tab, the products. */
function ProductsPreview({ listings, products }: Omit<Sides, "href">) {
  const tBrowse = useTranslations("shop.browse");
  const tDrawer = useTranslations("shop.drawer");
  const ahead = useMemo(() => listingTeaserItems(listings), [listings]);
  return (
    <PreviewPage railTone={ahead.length ? "listing" : null}>
      <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 600, color: "var(--text-body)" }}>{tBrowse("tagline")}</p>
      <StaticTab items={ahead} tone="listing" label={tDrawer("viewListings")} />
      <div className="pgrid">
        {products.map((product) => (
          <ShopProductCard key={product.id} product={product} showVendor />
        ))}
      </div>
    </PreviewPage>
  );
}

/** The incoming page's frame: its column, and a strip where its rail will be. */
function PreviewPage({ railTone, children }: { railTone: DrawerTone | null; children: ReactNode }) {
  return (
    <div className="lg:flex" style={{ height: "100%" }}>
      <div className={railTone ? "drawer-main min-w-0 flex-1" : "min-w-0 flex-1"}>
        <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6">{children}</div>
      </div>
      {railTone && (
        <div
          className="hidden lg:block"
          style={{
            width: RAIL_WIDTH,
            flexShrink: 0,
            background: `color-mix(in srgb, ${TONE[railTone].soft} 70%, var(--bg-app))`,
            borderInlineStart: `1px solid color-mix(in srgb, ${TONE[railTone].accent} 18%, var(--border))`,
          }}
        />
      )}
    </div>
  );
}

/** The incoming page's tab, drawn but not wired: the real one replaces it. */
function StaticTab({ items, tone, label }: { items: readonly TeaserItem[]; tone: DrawerTone; label: string }) {
  if (items.length === 0) return null;
  return (
    <div className="-me-4 mb-3 sm:-me-6 lg:hidden">
      <div style={tabShellStyle(tone)}>
        <TabFace items={items} index={0} tone={tone} label={label} />
      </div>
    </div>
  );
}
