"use client";

import { useTranslations } from "next-intl";
import type { PriceRange } from "@/lib/shop/shop.types";
import { BottomSheet } from "./BottomSheet";
import { Icon, type IconName } from "./Icon";
import { PriceDisplay } from "./PriceDisplay";

/** Shipped in `public/`, for products the vendor listed without a usable image. */
const NO_IMAGE = "/no_product_image.png";

export interface ProductAction {
  key: string;
  icon: IconName;
  label: string;
  /** `null` while the action is still being worked out — drawn as a spinner. */
  onPress: (() => void) | null;
  /** The one action the menu leads with, in the brand colour. */
  primary?: boolean;
  /** For a toggle (Save): the icon is drawn filled while true. */
  active?: boolean;
}

/**
 * What a press-and-hold on a product card opens.
 *
 * A bottom sheet on a phone — the thumb is already on the card, and the rows
 * land under it — and the same panel centred above `sm`, which is what
 * `BottomSheet` does by itself.
 *
 * The product leads the sheet. The card it came from is under the scrim now,
 * and a menu of verbs with no object ("Share", "Save") would leave the shopper
 * guessing which of twenty cards they held.
 *
 * Rows are 56px: comfortably above the 44–48px touch minimum, because these
 * are reached one-handed with the thumb, at the bottom of the screen.
 */
export function ProductActionsSheet({
  open,
  onClose,
  product,
  actions,
}: {
  open: boolean;
  onClose: () => void;
  product: {
    title: string;
    image: string | null;
    price: number;
    compareAt?: number | null;
    currency: string;
    priceRange?: PriceRange;
  };
  actions: ProductAction[];
}) {
  const t = useTranslations("shop.ds");

  return (
    // Portalled, but React still bubbles the sheet's clicks through the card's
    // <Link> — so without this every row would also open the product.
    <span style={{ display: "contents" }} onClick={(e) => e.stopPropagation()}>
      <BottomSheet open={open} onClose={onClose} title={t("actionsTitle")}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            paddingBottom: 14,
            marginBottom: 6,
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={product.image ?? NO_IMAGE}
            alt=""
            style={{
              width: 56,
              height: 56,
              borderRadius: "var(--radius-md)",
              objectFit: "cover",
              flexShrink: 0,
              background: "var(--surface-2)",
            }}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              className="ds-ugc"
              style={{
                fontSize: 14.5,
                fontWeight: 700,
                color: "var(--text-strong)",
                lineHeight: 1.3,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                overflowWrap: "anywhere",
              }}
            >
              {product.title}
            </div>
            <div style={{ marginTop: 4 }}>
              <PriceDisplay
                amount={product.price}
                compareAt={product.compareAt}
                currency={product.currency}
                range={product.priceRange}
                size="sm"
              />
            </div>
          </div>
        </div>

        <div role="menu" aria-label={product.title} style={{ display: "flex", flexDirection: "column" }}>
          {actions.map((action) => {
            const busy = action.onPress === null;
            return (
              <button
                key={action.key}
                type="button"
                role="menuitem"
                aria-disabled={busy || undefined}
                onClick={() => action.onPress?.()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  width: "100%",
                  minHeight: 56,
                  padding: "8px 4px",
                  background: "transparent",
                  border: "none",
                  cursor: busy ? "progress" : "pointer",
                  textAlign: "start",
                  opacity: busy ? 0.7 : 1,
                }}
              >
                <span
                  aria-hidden
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    flexShrink: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: action.primary ? "var(--brand)" : "var(--surface-2)",
                    color: action.primary
                      ? "#fff"
                      : action.active
                        ? "var(--danger)"
                        : "var(--text-body)",
                  }}
                >
                  <Icon
                    name={busy ? "loader" : action.icon}
                    size={20}
                    className={busy ? "animate-spin" : undefined}
                    style={action.active ? { fill: "currentColor" } : undefined}
                  />
                </span>
                <span style={{ fontSize: 15, fontWeight: 650, color: "var(--text-strong)" }}>
                  {action.label}
                </span>
              </button>
            );
          })}
        </div>
      </BottomSheet>
    </span>
  );
}
