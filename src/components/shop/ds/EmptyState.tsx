"use client";

import { Button } from "./Button";
import { Icon } from "./Icon";

export interface EmptyStateProps {
  icon: string;
  title: string;
  description?: string;
  actionLabel?: string;
  actionIcon?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, actionIcon, onAction }: EmptyStateProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "48px 24px",
        gap: 6,
      }}
    >
      <span
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "var(--surface-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 8,
        }}
      >
        <Icon name={icon} size={30} style={{ color: "var(--text-muted)" }} />
      </span>
      <h3 style={{ fontSize: 17, fontWeight: 800, color: "var(--text-strong)", margin: 0 }}>{title}</h3>
      {description && (
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.5, margin: 0, maxWidth: 320 }}>
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <div style={{ marginTop: 12 }}>
          <Button variant="secondary" leadingIcon={actionIcon} onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
