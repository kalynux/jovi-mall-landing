"use client";

import type { CSSProperties, ReactNode } from "react";
import type { ProductType } from "@/lib/shop/shop.types";
import { Icon, type IconName } from "./Icon";

type Tone = "brand" | "neutral" | "success" | "warning" | "danger" | "info";
type Variant = "soft" | "solid" | "outline";

export interface BadgeProps {
  tone?: Tone;
  variant?: Variant;
  productType?: ProductType;
  size?: "sm" | "md";
  dot?: boolean;
  icon?: IconName;
  children: ReactNode;
  style?: CSSProperties;
}

function colorsFor(tone: Tone, productType?: ProductType): { fg: string; bg: string; border: string } {
  if (productType) {
    return {
      fg: `var(--type-${productType})`,
      bg: `var(--type-${productType}-bg)`,
      border: `var(--type-${productType})`,
    };
  }
  switch (tone) {
    case "brand":
      return { fg: "var(--brand-hover)", bg: "var(--brand-subtle)", border: "var(--brand)" };
    case "success":
      return { fg: "var(--success)", bg: "var(--success-bg)", border: "var(--success-border)" };
    case "warning":
      return { fg: "var(--warning)", bg: "var(--warning-bg)", border: "var(--warning-border)" };
    case "danger":
      return { fg: "var(--danger)", bg: "var(--danger-bg)", border: "var(--danger-border)" };
    case "info":
      return { fg: "var(--info)", bg: "var(--info-bg)", border: "var(--info-border)" };
    default:
      return { fg: "var(--text-muted)", bg: "var(--surface-2)", border: "var(--border)" };
  }
}

export function Badge({
  tone = "neutral",
  variant = "soft",
  productType,
  size = "md",
  dot,
  icon,
  children,
  style,
}: BadgeProps) {
  const c = colorsFor(tone, productType);
  const solid = variant === "solid";
  const outline = variant === "outline";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        fontFamily: "var(--font-sans)",
        fontSize: size === "sm" ? 11 : 12,
        fontWeight: 700,
        lineHeight: 1,
        padding: size === "sm" ? "4px 8px" : "5px 10px",
        borderRadius: "var(--radius-badge)",
        color: solid ? "#fff" : c.fg,
        background: solid ? c.fg : outline ? "transparent" : c.bg,
        border: outline ? `1px solid ${c.border}` : "1px solid transparent",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: solid ? "#fff" : c.fg,
          }}
        />
      )}
      {icon && <Icon name={icon} size={size === "sm" ? 12 : 14} />}
      {children}
    </span>
  );
}
