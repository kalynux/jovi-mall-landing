"use client";

import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "ghost" | "whatsapp" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  elevated?: boolean;
  leadingIcon?: IconName;
  trailingIcon?: IconName;
  children?: ReactNode;
}

const sizeMap: Record<Size, { height: number; padding: string; fontSize: number; icon: number }> = {
  sm: { height: 34, padding: "0 12px", fontSize: 13, icon: 16 },
  md: { height: 44, padding: "0 16px", fontSize: 14.5, icon: 18 },
  lg: { height: 52, padding: "0 20px", fontSize: 15.5, icon: 19 },
};

function variantStyle(variant: Variant): CSSProperties {
  switch (variant) {
    case "secondary":
      return { background: "var(--surface)", color: "var(--text-strong)", border: "1.5px solid var(--border)" };
    case "ghost":
      return { background: "transparent", color: "var(--brand-hover)", border: "1.5px solid transparent" };
    case "whatsapp":
      return { background: "var(--whatsapp)", color: "#fff", border: "1.5px solid transparent" };
    case "danger":
      return { background: "var(--danger)", color: "#fff", border: "1.5px solid transparent" };
    default:
      return { background: "var(--brand)", color: "var(--brand-on)", border: "1.5px solid transparent" };
  }
}

export function Button({
  variant = "primary",
  size = "md",
  block,
  elevated,
  leadingIcon,
  trailingIcon,
  children,
  disabled,
  style,
  className,
  ...rest
}: ButtonProps) {
  const s = sizeMap[size];
  /**
   * Never an implicit submit.
   *
   * A <button> with no `type` is a submit button whenever it happens to sit
   * inside a <form>, which turns "Reset", "Cancel" and every ghost action into
   * a form submission the moment someone wraps them in one. The one call site
   * that does want to submit — the connection-code form in ChatChannels — says
   * `type="submit"`, and still wins: this is declared before the spread.
   */
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled}
      className={className ? `ds-btn ${className}` : "ds-btn"}
      style={{
        display: block ? "flex" : "inline-flex",
        width: block ? "100%" : undefined,
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        height: s.height,
        padding: s.padding,
        fontFamily: "var(--font-sans)",
        fontSize: s.fontSize,
        fontWeight: 700,
        letterSpacing: "-0.01em",
        borderRadius: "var(--radius-button)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        boxShadow: elevated && variant === "primary" ? "var(--shadow-brand)" : undefined,
        transition: "background var(--dur-fast) var(--ease-out), transform var(--dur-fast) var(--ease-out)",
        whiteSpace: "nowrap",
        ...variantStyle(variant),
        ...style,
      }}
    >
      {leadingIcon && <Icon name={leadingIcon} size={s.icon} />}
      {children}
      {trailingIcon && <Icon name={trailingIcon} size={s.icon} />}
    </button>
  );
}
