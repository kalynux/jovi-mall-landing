"use client";

import { Icon } from "./Icon";

export interface QtyStepperProps {
  value: number;
  onChange: (value: number) => void;
  max?: number;
  min?: number;
  size?: "sm" | "md";
}

export function QtyStepper({ value, onChange, max = 99, min = 1, size = "md" }: QtyStepperProps) {
  const dim = size === "sm" ? 30 : 38;
  const btn = (icon: string, delta: number, disabled: boolean) => (
    <button
      type="button"
      aria-label={delta > 0 ? "Increase quantity" : "Decrease quantity"}
      disabled={disabled}
      onClick={() => onChange(Math.min(max, Math.max(min, value + delta)))}
      style={{
        width: dim,
        height: dim,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        background: "transparent",
        color: disabled ? "var(--text-subtle)" : "var(--text-strong)",
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <Icon name={icon} size={size === "sm" ? 15 : 17} />
    </button>
  );
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        border: "1.5px solid var(--border)",
        borderRadius: "var(--radius-md)",
        background: "var(--surface)",
      }}
    >
      {btn("minus", -1, value <= min)}
      <span
        style={{
          minWidth: 26,
          textAlign: "center",
          fontWeight: 800,
          fontSize: size === "sm" ? 13 : 14.5,
          fontVariantNumeric: "tabular-nums",
          color: "var(--text-strong)",
        }}
      >
        {value}
      </span>
      {btn("plus", 1, value >= max)}
    </div>
  );
}
