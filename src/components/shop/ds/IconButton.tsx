"use client";

import type { ButtonHTMLAttributes, CSSProperties } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "plain" | "surface" | "fav";
type Size = "sm" | "md";

export interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  icon: IconName;
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

  /**
   * Never an implicit submit.
   *
   * A <button> with no `type` inside a <form> is a submit button, and these are
   * decorative-by-position: the shop's search row puts Filters and Layout beside
   * the field, inside its form, so pressing Enter in the box ran the FIRST of
   * them instead of searching, and clicking either one submitted the form as a
   * side effect. Declared before the spread, so a caller that genuinely wants a
   * submit can still say so.
   */
  return (
    <button
      type="button"
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
