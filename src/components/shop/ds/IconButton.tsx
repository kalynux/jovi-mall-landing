"use client";

import type { ButtonHTMLAttributes, CSSProperties } from "react";
import { Icon } from "./Icon";

type Variant = "plain" | "surface" | "fav";
type Size = "sm" | "md";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: string;
  label: string;
  variant?: Variant;
  size?: Size;
  active?: boolean;
}

export function IconButton({
  icon,
  label,
  variant = "plain",
  size = "md",
  active,
  style,
  ...rest
}: IconButtonProps) {
  const dim = size === "sm" ? 34 : 40;
  const iconSize = size === "sm" ? 18 : 20;

  let base: CSSProperties = { background: "transparent", border: "1.5px solid transparent", color: "var(--text-body)" };
  if (variant === "surface") {
    base = { background: "var(--surface)", border: "1.5px solid var(--border)", color: "var(--text-body)" };
  } else if (variant === "fav") {
    base = {
      background: "var(--surface)",
      border: "1.5px solid var(--border)",
      color: active ? "var(--danger)" : "var(--text-body)",
    };
  }

  return (
    <button
      {...rest}
      aria-label={label}
      title={label}
      aria-pressed={variant === "fav" ? Boolean(active) : undefined}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: dim,
        height: dim,
        flexShrink: 0,
        borderRadius: "var(--radius-md)",
        cursor: "pointer",
        transition: "background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out)",
        ...base,
        ...style,
      }}
    >
      <Icon
        name={icon}
        size={iconSize}
        style={variant === "fav" && active ? { fill: "currentColor" } : undefined}
      />
    </button>
  );
}
