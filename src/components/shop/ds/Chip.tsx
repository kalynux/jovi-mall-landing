"use client";

import type { CSSProperties, ReactNode } from "react";
import { Icon } from "./Icon";

export interface ChipProps {
  children: ReactNode;
  selected?: boolean;
  solid?: boolean;
  size?: "sm" | "md";
  removable?: boolean;
  onRemove?: () => void;
  icon?: string;
  onClick?: () => void;
  style?: CSSProperties;
}

export function Chip({
  children,
  selected,
  solid,
  size = "md",
  removable,
  onRemove,
  icon,
  onClick,
  style,
}: ChipProps) {
  let bg = "var(--surface)";
  let color = "var(--text-body)";
  let border = "var(--border)";
  if (selected && solid) {
    bg = "var(--brand)";
    color = "#fff";
    border = "var(--brand)";
  } else if (selected) {
    bg = "var(--brand-subtle)";
    color = "var(--brand-hover)";
    border = "var(--brand)";
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        flexShrink: 0,
        fontFamily: "var(--font-sans)",
        fontSize: size === "sm" ? 12 : 13,
        fontWeight: 700,
        padding: size === "sm" ? "5px 10px" : "7px 13px",
        borderRadius: "var(--radius-pill)",
        border: `1.5px solid ${border}`,
        background: bg,
        color,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "var(--transition-colors)",
        ...style,
      }}
    >
      {icon && <Icon name={icon} size={size === "sm" ? 13 : 15} />}
      {children}
      {removable && (
        <span
          role="button"
          aria-label="Remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove?.();
          }}
          style={{ display: "inline-flex", marginLeft: 1, marginRight: -2 }}
        >
          <Icon name="x" size={14} />
        </span>
      )}
    </button>
  );
}
