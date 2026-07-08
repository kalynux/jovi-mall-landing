"use client";

import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import { Rating } from "./Rating";

export interface VendorCardProps {
  name: string;
  rating: number;
  reviewCount: number;
  productCount: number;
  city: string;
  verified?: boolean;
  isOpen?: boolean;
  asHeader?: boolean;
  onView?: () => void;
}

/** Compact store header used to group the catalog by vendor. */
export function VendorCard({
  name,
  rating,
  reviewCount,
  productCount,
  city,
  verified,
  isOpen,
  onView,
}: VendorCardProps) {
  return (
    <div
      onClick={onView}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onView?.()}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 12px",
        background: "var(--surface-2)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-lg)",
        cursor: "pointer",
      }}
    >
      <Avatar name={name} size={44} shape="squircle" status={isOpen ? "open" : "closed"} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: "var(--text-strong)",
              letterSpacing: "-0.01em",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </span>
          {verified && <Icon name="badge-check" size={15} style={{ color: "var(--brand)" }} />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, flexWrap: "wrap" }}>
          <Rating value={rating} count={reviewCount} compact size={12} />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>· {productCount} items</span>
          <span style={{ fontSize: 12, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 2 }}>
            · <Icon name="map-pin" size={12} />
            {city}
          </span>
        </div>
      </div>
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 3,
          fontSize: 13,
          fontWeight: 700,
          color: "var(--brand-hover)",
          whiteSpace: "nowrap",
        }}
      >
        View store <Icon name="chevron-right" size={16} />
      </span>
    </div>
  );
}
