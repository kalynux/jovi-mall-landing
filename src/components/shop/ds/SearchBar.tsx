"use client";

import { useTranslations } from "next-intl";
import type { ChangeEvent } from "react";
import { Icon } from "./Icon";

export interface SearchBarProps {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onClear?: () => void;
  placeholder?: string;
  filled?: boolean;
}

export function SearchBar({ value, onChange, onClear, placeholder, filled }: SearchBarProps) {
  // `placeholder` names what is being searched, so it stays the caller’s.
  const t = useTranslations("shop.ds");

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        background: filled ? "var(--surface-2)" : "var(--surface)",
        border: "1.5px solid var(--border)",
        borderRadius: "var(--radius-input)",
        padding: "0 12px",
        height: 46,
      }}
    >
      <Icon name="search" size={19} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{
          flex: 1,
          minWidth: 0,
          border: "none",
          outline: "none",
          background: "transparent",
          fontFamily: "var(--font-sans)",
          fontSize: 15,
          color: "var(--text-strong)",
        }}
      />
      {value && onClear && (
        <button
          type="button"
          aria-label={t("clearSearch")}
          onClick={onClear}
          style={{ display: "inline-flex", border: "none", background: "transparent", cursor: "pointer", color: "var(--text-muted)" }}
        >
          <Icon name="x" size={18} />
        </button>
      )}
    </div>
  );
}
