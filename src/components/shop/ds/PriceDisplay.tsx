"use client";

import { formatXAF } from "@/lib/shop/format";

export interface PriceDisplayProps {
  amount: number;
  compareAt?: number | null;
  size?: "sm" | "md" | "lg";
}

const sizeMap = { sm: 14, md: 18, lg: 26 };

export function PriceDisplay({ amount, compareAt, size = "md" }: PriceDisplayProps) {
  const fs = sizeMap[size];
  const onSale = Boolean(compareAt && compareAt > amount);
  return (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
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
        {formatXAF(amount)}
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
          {formatXAF(compareAt as number)}
        </span>
      )}
    </span>
  );
}
