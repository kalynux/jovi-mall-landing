"use client";

import { Icon } from "./Icon";

export interface RatingProps {
  value: number;
  count?: number;
  compact?: boolean;
  showValue?: boolean;
  size?: number;
}

/**
 * Two modes:
 *  - showValue !== false (default): a compact "★ 4.6 (214)" summary.
 *  - showValue === false: a 5-star row filled up to `value`.
 */
export function Rating({ value, count, compact, showValue = true, size = 14 }: RatingProps) {
  if (showValue === false) {
    return (
      <span style={{ display: "inline-flex", gap: 2 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <Icon
            key={i}
            name="star"
            size={size}
            style={{
              color: i < Math.round(value) ? "var(--star)" : "var(--star-empty)",
              fill: i < Math.round(value) ? "var(--star)" : "transparent",
            }}
          />
        ))}
      </span>
    );
  }

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: compact ? 13 : 14,
        fontWeight: 700,
        color: "var(--text-strong)",
      }}
    >
      <Icon name="star" size={size} style={{ color: "var(--star)", fill: "var(--star)" }} />
      {value.toFixed(1)}
      {typeof count === "number" && (
        <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>({count})</span>
      )}
    </span>
  );
}
