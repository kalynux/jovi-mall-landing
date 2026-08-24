"use client";

import { Link } from "@/i18n/navigation";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

export interface VendorCardProps {
  name: string;
  /** The store's URL. Prefer over `onView` — a grouped grid should link to stores. */
  href?: string;
  productCount: number;
  /**
   * The only address component the API publishes, and `null` when the vendor has
   * set none. The rest of a vendor's `business_addresses[]` is a home or
   * warehouse address and is deliberately private.
   */
  city?: string | null;
  /** `kyc_details.legit_verified`. */
  verified?: boolean;
  /** Vacation mode. A closed store still sells — this is a flag, not a gate. */
  isOpen?: boolean;
  asHeader?: boolean;
  onView?: () => void;
}

/**
 * Compact store header used to group the catalog by vendor.
 *
 * Carried a star rating and a review count until the catalogue went real, when
 * both turned out to be fixtures.
 *
 * Product reviews exist now, but **a store still carries no aggregate of its
 * own** — `GET /api/public/stores` publishes none, and averaging the products on
 * screen would invent one from whichever page happened to load. A store card is
 * exactly the surface where a made-up 4.8 reads as a fact about a real
 * business, so it stays out until the API has a number for it.
 */
export function VendorCard({
  name,
  href,
  productCount,
  city,
  verified,
  isOpen,
  onView,
}: VendorCardProps) {
  const shell = {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 12px",
    background: "var(--surface-2)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-lg)",
    cursor: "pointer",
    textDecoration: "none",
    color: "inherit",
  } as const;

  // Built as a value and wrapped below rather than as a component defined during
  // render — a fresh component identity each render remounts the whole subtree.
  const body = (
    <>
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
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {productCount} item{productCount === 1 ? "" : "s"}
          </span>
          {city && (
            <span style={{ fontSize: 12, color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: 2 }}>
              · <Icon name="map-pin" size={12} />
              {city}
            </span>
          )}
          {isOpen === false && (
            <span style={{ fontSize: 12, color: "var(--warning)", fontWeight: 700 }}>· On holiday</span>
          )}
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
    </>
  );

  if (href) {
    return (
      <Link href={href} style={shell}>
        {body}
      </Link>
    );
  }

  return (
    <div
      onClick={onView}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onView?.()}
      style={shell}
    >
      {body}
    </div>
  );
}
