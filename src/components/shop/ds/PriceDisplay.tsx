"use client";

import { formatMoney } from "@/lib/shop/format";
import type { PriceRange } from "@/lib/shop/shop.types";

export interface PriceDisplayProps {
  amount: number;
  compareAt?: number | null;
  /**
   * The currency the record actually carries.
   *
   * Defaulted rather than required because XAF is the platform currency and
   * every seeded price is in it — but it is read from the data wherever the data
   * has it, so a vendor priced in anything else is not silently relabelled FCFA.
   */
  currency?: string;
  /**
   * A price band across a product's variants.
   *
   * The API **omits** this when every variant costs the same, so its presence
   * alone means "there is more than one price" — no min/max comparison needed.
   * When present it replaces the single amount with "from X", because the
   * headline `price` is only the default variant's and printing it flat would
   * understate a product whose other sizes cost more.
   */
  range?: PriceRange;
  size?: "sm" | "md" | "lg";
}

const sizeMap = { sm: 14, md: 18, lg: 26 };

export function PriceDisplay({ amount, compareAt, currency = "XAF", range, size = "md" }: PriceDisplayProps) {
  const fs = sizeMap[size];
  // A range and a strikethrough together read as though the whole band is
  // discounted, which is not what the data says — the compare-at belongs to one
  // variant. The band wins and the strikethrough is dropped.
  const onSale = !range && Boolean(compareAt && compareAt > amount);

  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
      {range && (
        <span
          style={{
            fontSize: Math.max(11, fs - 5),
            fontWeight: 600,
            color: "var(--text-muted)",
          }}
        >
          from
        </span>
      )}
      <span
        style={{
          fontFamily: "var(--font-sans)",
          fontWeight: 800,
          fontSize: fs,
          letterSpacing: "-0.01em",
          fontVariantNumeric: "tabular-nums",
          color: onSale ? "var(--price-sale)" : "var(--price)",
        }}
      >
        {formatMoney(range ? range.min : amount, currency)}
      </span>
      {onSale && (
        <span
          style={{
            fontSize: Math.max(12, fs - 8),
            fontWeight: 600,
            color: "var(--price-compare)",
            textDecoration: "line-through",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {formatMoney(compareAt as number, currency)}
        </span>
      )}
    </span>
  );
}
