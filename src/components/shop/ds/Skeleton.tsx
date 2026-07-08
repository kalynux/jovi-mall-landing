"use client";

import type { CSSProperties } from "react";

export interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
  style?: CSSProperties;
}

export function Skeleton({ width = "100%", height = 16, radius = "var(--radius-sm)", style }: SkeletonProps) {
  return (
    <span
      aria-hidden
      className="shop-skeleton"
      style={{
        display: "block",
        width,
        height,
        borderRadius: radius,
        background:
          "linear-gradient(90deg, var(--surface-2) 25%, var(--surface-sunken) 37%, var(--surface-2) 63%)",
        backgroundSize: "400% 100%",
        animation: "shop-skel 1.4s ease infinite",
        ...style,
      }}
    />
  );
}
