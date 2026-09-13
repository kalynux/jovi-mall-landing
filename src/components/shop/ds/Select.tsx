"use client";

import type { ChangeEvent } from "react";
import { Icon, type IconName } from "./Icon";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onChange: (e: ChangeEvent<HTMLSelectElement>) => void;
  /**
   * Either bare strings (value === label) or `{ value, label }` pairs.
   *
   * The pairs exist because the catalog's sort values are a wire contract —
   * `price_asc` is sent verbatim as `?sort=` — while the option a shopper reads
   * is "Price: low to high". Before the catalogue was real those were the same
   * string, which only worked because nothing was ever sent anywhere.
   */
  options: readonly string[] | readonly SelectOption[];
  size?: "sm" | "md";
  leadingIcon?: IconName;
  "aria-label"?: string;
}

function normalize(options: SelectProps["options"]): readonly SelectOption[] {
  return options.map((o) => (typeof o === "string" ? { value: o, label: o } : o));
}

export function Select({ value, onChange, options, size = "md", leadingIcon, ...rest }: SelectProps) {
  const h = size === "sm" ? 40 : 44;
  const items = normalize(options);
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
        // A <select> is as wide as its widest option, which is a translated
        // string here — so on a phone it is capped rather than trusted.
        maxWidth: "100%",
        minWidth: 0,
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
          minWidth: 0,
          maxWidth: "100%",
          textOverflow: "ellipsis",
        }}
      >
        {items.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
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
