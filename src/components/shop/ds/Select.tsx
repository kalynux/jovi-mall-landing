"use client";

import type { ChangeEvent } from "react";
import { Icon } from "./Icon";

export interface SelectProps {
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  options: readonly string[];
  size?: "sm" | "md";
  leadingIcon?: string;
  "aria-label"?: string;
}

export function Select({ value, onChange, options, size = "md", leadingIcon, ...rest }: SelectProps) {
  const h = size === "sm" ? 40 : 44;
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        height: h,
        padding: "0 10px",
        background: "var(--surface)",
        border: "1.5px solid var(--border)",
        borderRadius: "var(--radius-input)",
        position: "relative",
      }}
    >
      {leadingIcon && <Icon name={leadingIcon} size={16} style={{ color: "var(--text-muted)" }} />}
      <select
        value={value}
        onChange={onChange}
        {...rest}
        style={{
          appearance: "none",
          WebkitAppearance: "none",
          border: "none",
          outline: "none",
          background: "transparent",
          fontFamily: "var(--font-sans)",
          fontSize: size === "sm" ? 12.5 : 14,
          fontWeight: 700,
          color: "var(--text-strong)",
          cursor: "pointer",
          paddingRight: 16,
        }}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <Icon
        name="chevron-down"
        size={15}
        style={{ color: "var(--text-muted)", position: "absolute", right: 8, pointerEvents: "none" }}
      />
    </div>
  );
}
