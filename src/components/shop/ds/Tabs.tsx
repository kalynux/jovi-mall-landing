"use client";

export interface TabItem {
  value: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  value: string;
  onChange: (value: string) => void;
  tabs: TabItem[];
  variant?: "underline" | "pill";
}

export function Tabs({ value, onChange, tabs, variant = "underline" }: TabsProps) {
  if (variant === "pill") {
    return (
      <div
        style={{
          display: "inline-flex",
          gap: 4,
          background: "var(--surface-2)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-pill)",
          padding: 4,
          flexWrap: "wrap",
        }}
      >
        {tabs.map((t) => {
          const active = t.value === value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => onChange(t.value)}
              style={{
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                fontWeight: 700,
                padding: "7px 14px",
                borderRadius: 999,
                background: active ? "var(--surface)" : "transparent",
                color: active ? "var(--brand-hover)" : "var(--text-muted)",
                boxShadow: active ? "var(--shadow-xs)" : "none",
                transition: "var(--transition-colors)",
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        borderBottom: "1px solid var(--border)",
        overflowX: "auto",
        scrollbarWidth: "none",
      }}
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => onChange(t.value)}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              fontWeight: 700,
              padding: "10px 12px",
              color: active ? "var(--text-strong)" : "var(--text-muted)",
              borderBottom: `2px solid ${active ? "var(--brand)" : "transparent"}`,
              marginBottom: -1,
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: active ? "var(--brand-hover)" : "var(--text-subtle)",
                  background: active ? "var(--brand-subtle)" : "var(--surface-2)",
                  borderRadius: 999,
                  padding: "1px 7px",
                }}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
