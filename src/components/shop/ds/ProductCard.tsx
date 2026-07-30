"use client";

import type { ProductType } from "@/lib/shop/shop.types";
import { discountPct } from "@/lib/shop/format";
import { Badge } from "./Badge";
import { Icon } from "./Icon";
import { PriceDisplay } from "./PriceDisplay";
import { Rating } from "./Rating";

export interface ProductCardProps {
  layout?: "grid" | "list";
  title: string;
  image: string;
  type: ProductType;
  price: number;
  compareAt?: number | null;
  rating?: number;
  reviewCount?: number;
  vendorName?: string;
  showVendor?: boolean;
  deliveryLabel?: string;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  inStock?: boolean;
  onQuickAdd?: () => void;
  onClick?: () => void;
}

const quickAddIcon: Record<ProductType, string> = {
  physical: "plus",
  digital: "download",
  service: "calendar-clock",
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
        background: "rgba(255,255,255,0.9)",
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
    rating,
    reviewCount,
    vendorName,
    showVendor,
    deliveryLabel,
    favorite,
    onToggleFavorite,
    inStock = true,
    onQuickAdd,
    onClick,
  } = props;

  const pct = discountPct(price, compareAt);

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
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "6px 0", flexWrap: "wrap" }}>
        {typeof rating === "number" && <Rating value={rating} count={reviewCount} compact size={13} />}
      </div>
      <PriceDisplay amount={price} compareAt={compareAt} size="sm" />
      {deliveryLabel && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 11.5, color: "var(--text-muted)", fontWeight: 600 }}>
          <Icon name="truck" size={13} />
          {deliveryLabel}
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
        src={image}
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
          aria-label={type === "service" ? "Book" : "Quick add"}
          className="ds-pop"
          onClick={(e) => {
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
          <Icon name={quickAddIcon[type]} size={18} />
        </button>
      )}
    </div>
  );

  if (layout === "list") {
    return (
      <div
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && onClick?.()}
        className="ds-card lift"
        style={{
          display: "flex",
          gap: 12,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          cursor: "pointer",
          boxShadow: "var(--shadow-card)",
        }}
      >
        {imageBox({ width: 118, height: 118 })}
        <div style={{ flex: 1, minWidth: 0, padding: "10px 12px 10px 0" }}>{meta}</div>
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick?.()}
      className="fadein lift ds-card"
      style={{
        display: "flex",
        flexDirection: "column",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        cursor: "pointer",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {imageBox({ width: "100%", aspect: "1 / 1" })}
      <div style={{ padding: "10px 12px 12px" }}>{meta}</div>
    </div>
  );
}
