"use client";

import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/shop/ds";

const TONES = {
  info: { bg: "var(--info-bg)", border: "var(--info-border)", fg: "var(--info)" },
  warning: { bg: "var(--warning-bg)", border: "var(--warning-border)", fg: "var(--warning)" },
  danger: { bg: "var(--danger-bg)", border: "var(--danger-border)", fg: "var(--danger)" },
  neutral: { bg: "var(--surface-2)", border: "var(--border)", fg: "var(--text-muted)" },
} as const;

/** A status line on the referral page. Takes translated copy, like every shop primitive. */
export function ReferralNotice({
  tone,
  icon,
  title,
  children,
}: {
  tone: keyof typeof TONES;
  icon: IconName;
  title?: string;
  children: ReactNode;
}) {
  const colors = TONES[tone];

  return (
    <div
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        border: `1px solid ${colors.border}`,
        background: colors.bg,
        borderRadius: "var(--radius-md)",
        padding: "12px 13px",
      }}
    >
      <Icon name={icon} size={17} style={{ color: colors.fg, flexShrink: 0, marginTop: 1 }} />
      <div style={{ minWidth: 0, fontSize: 13, lineHeight: 1.55, color: "var(--text-body)" }}>
        {title && (
          <p style={{ margin: "0 0 2px", fontSize: 14, fontWeight: 700, color: "var(--text-strong)" }}>{title}</p>
        )}
        {children}
      </div>
    </div>
  );
}

/** A card's heading. A real `<h2>`: the page's own title is the shell's `<h1>`. */
export function ReferralHeading({ children }: { children: ReactNode }) {
  return (
    <h2 style={{ margin: "0 0 10px", fontSize: 14.5, fontWeight: 800, color: "var(--text-strong)" }}>{children}</h2>
  );
}

/** A label above a form control, in the shop's `.field` look. */
export function ReferralField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-body)", marginBottom: 6 }}>
        {label}
      </span>
      {children}
      {hint && (
        <span className="muted" style={{ display: "block", fontSize: 12, marginTop: 5 }}>
          {hint}
        </span>
      )}
    </label>
  );
}
