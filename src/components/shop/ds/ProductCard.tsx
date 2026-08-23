"use client";

import type { CSSProperties, ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import type { PriceRange, ProductType } from "@/lib/shop/shop.types";
import { discountPct } from "@/lib/shop/format";
import { Badge } from "./Badge";
import { Icon } from "./Icon";
import { PriceDisplay } from "./PriceDisplay";

/** Shipped in `public/`, for products the vendor listed without a usable image. */
const NO_IMAGE = "/no_product_image.png";

export interface ProductCardProps {
  layout?: "grid" | "list";
  title: string;
  /** `null` when the product has no usable image — the API says so explicitly. */
  image: string | null;
  type: ProductType;
  price: number;
  compareAt?: number | null;
  currency?: string;
  /** Present only when the product's variants differ in price. */
  priceRange?: PriceRange;
  vendorName?: string;
  showVendor?: boolean;
  /**
   * A real backend field, unlike the free-text delivery label this card used to
   * take. It is a boolean promise about this product, not a description.
   */
  freeDelivery?: boolean;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  /** Boolean by design — the API publishes no stock count. */
  inStock?: boolean;
  onQuickAdd?: () => void;
  /**
   * The product's URL.
   *
   * **Prefer this over `onClick`.** The card used to be a `div` with a click
   * handler, which meant the grid contained no links at all: a crawler could
   * read the titles and had no way to reach a product, and a shopper could not
   * middle-click, open in a new tab, or copy a link. Server-rendering the grid
   * only pays off if what it renders is navigable.
   */
  href?: string;
  onClick?: () => void;
}

/**
 * What the corner button does, per type — and it is three different things, so
 * it says three different things. Digital is a buy-now: it goes to checkout
 * rather than into a cart, and a "+" over that is a lie about where the tap
 * lands.
 */
const quickAction: Record<ProductType, { icon: string; label: string }> = {
  physical: { icon: "plus", label: "Quick add" },
  digital: { icon: "zap", label: "Buy now" },
  service: { icon: "calendar-clock", label: "Book" },
};

const typeLabel = (t: ProductType) => t[0].toUpperCase() + t.slice(1);

function FavButton({ favorite, onToggleFavorite }: Pick<ProductCardProps, "favorite" | "onToggleFavorite">) {
  return (
    <button
      type="button"
      aria-label={favorite ? "Remove from saved" : "Save"}
      aria-pressed={favorite}
      className="ds-pop"
      onClick={(e) => {
        // `preventDefault` as well as `stopPropagation`: the card is a link now,
        // and without it saving a product also navigates to it.
        e.preventDefault();
        e.stopPropagation();
        onToggleFavorite?.();
      }}
      style={{
        width: 32,
        height: 32,
        borderRadius: "50%",
        border: "none",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#FFFFFF",
        color: favorite ? "var(--danger)" : "var(--gray-600)",
        boxShadow: "var(--shadow-sm)",
      }}
    >
      <Icon name="heart" size={17} style={favorite ? { fill: "currentColor" } : undefined} />
    </button>
  );
}

export function ProductCard(props: ProductCardProps) {
  const {
    layout = "grid",
    title,
    image,
    type,
    price,
    compareAt,
    currency = "XAF",
    priceRange,
    vendorName,
    showVendor,
    freeDelivery,
    favorite,
    onToggleFavorite,
    inStock = true,
    onQuickAdd,
    href,
    onClick,
  } = props;

  // Suppressed on a price band: the compare-at belongs to the default variant,
  // so a "-20%" badge over "from 24 000" claims a discount on prices it does
  // not describe.
  const pct = priceRange ? null : discountPct(price, compareAt);

  const titleEl = (
    <div
      style={{
        fontSize: 14,
        fontWeight: 700,
        color: "var(--text-strong)",
        lineHeight: 1.3,
        display: "-webkit-box",
        WebkitLineClamp: 2,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}
    >
      {title}
    </div>
  );

  const meta = (
    <>
      {showVendor && vendorName && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600, marginBottom: 3 }}>
          {vendorName}
        </div>
      )}
      {titleEl}
      <div style={{ marginTop: 6 }}>
        <PriceDisplay amount={price} compareAt={compareAt} currency={currency} range={priceRange} size="sm" />
      </div>
      {freeDelivery && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600 }}>
          <Icon name="truck" size={13} />
          Free delivery
        </div>
      )}
    </>
  );

  const imageBox = (dim: { width: string | number; aspect?: string; height?: number }) => (
    <div
      className="ds-media"
      style={{
        position: "relative",
        width: dim.width,
        aspectRatio: dim.aspect,
        height: dim.height,
        background: "var(--surface-2)",
        flexShrink: 0,
        overflow: "hidden",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image ?? NO_IMAGE}
        alt={title}
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: inStock ? 1 : 0.6 }}
        
      />
      <div style={{ position: "absolute", top: 8, left: 8, display: "flex", gap: 5 }}>
        <Badge productType={type} variant="solid" size="sm">
          {typeLabel(type)}
        </Badge>
        {pct && (
          <Badge tone="danger" variant="solid" size="sm">
            -{pct}%
          </Badge>
        )}
      </div>
      <div style={{ position: "absolute", top: 8, right: 8 }}>
        <FavButton favorite={favorite} onToggleFavorite={onToggleFavorite} />
      </div>
      {!inStock && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(26,25,21,0.35)",
          }}
        >
          <span
            style={{
              background: "var(--surface)",
              color: "var(--text-strong)",
              fontSize: 12,
              fontWeight: 800,
              padding: "5px 10px",
              borderRadius: "var(--radius-pill)",
            }}
          >
            Out of stock
          </span>
        </div>
      )}
      {inStock && onQuickAdd && (
        <button
          type="button"
          aria-label={quickAction[type].label}
          title={quickAction[type].label}
          className="ds-pop"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onQuickAdd();
          }}
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            width: 34,
            height: 34,
            borderRadius: "50%",
            border: "none",
            cursor: "pointer",
            background: "var(--brand)",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "var(--shadow-md)",
          }}
        >
          <Icon name={quickAction[type].icon} size={18} />
        </button>
      )}
    </div>
  );

  const listShell: CSSProperties = {
    display: "flex",
    gap: 12,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    cursor: "pointer",
    boxShadow: "var(--shadow-card)",
    textDecoration: "none",
    color: "inherit",
  };

  const gridShell: CSSProperties = {
    display: "flex",
    flexDirection: "column",
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    cursor: "pointer",
    boxShadow: "var(--shadow-card)",
    textDecoration: "none",
    color: "inherit",
  };

  const body =
    layout === "list" ? (
      <>
        {imageBox({ width: 118, height: 118 })}
        <div style={{ flex: 1, minWidth: 0, padding: "10px 12px 10px 0" }}>{meta}</div>
      </>
    ) : (
      <>
        {imageBox({ width: "100%", aspect: "1 / 1" })}
        <div style={{ padding: "10px 12px 12px" }}>{meta}</div>
      </>
    );

  return (
    <CardShell
      href={href}
      onClick={onClick}
      className={layout === "list" ? "ds-card lift" : "fadein lift ds-card"}
      style={layout === "list" ? listShell : gridShell}
    >
      {body}
    </CardShell>
  );
}

/**
 * A real `<a>` when there is somewhere to go, and the old click-handled `div`
 * only where there is not.
 *
 * The fallback exists because a couple of surfaces navigate imperatively rather
 * than to a fixed URL; everything with a product behind it should pass `href`.
 */
function CardShell({
  href,
  onClick,
  className,
  style,
  children,
}: {
  href?: string;
  onClick?: () => void;
  className: string;
  style: CSSProperties;
  children: ReactNode;
}) {
  if (href) {
    return (
      <Link href={href} onClick={onClick} className={className} style={style}>
        {children}
      </Link>
    );
  }

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className={className}
      style={style}
    >
      {children}
    </div>
  );
}
