"use client";

export interface AvatarProps {
  name: string;
  size?: number;
  shape?: "circle" | "squircle";
  ring?: boolean;
  status?: "open" | "closed";
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({ name, size = 40, shape = "circle", ring, status }: AvatarProps) {
  const radius = shape === "squircle" ? Math.round(size * 0.3) : "50%";
  return (
    <span style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
      <span
        aria-hidden
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: "var(--brand-subtle)",
          color: "var(--brand-hover)",
          border: ring ? "2px solid var(--surface)" : undefined,
          boxShadow: ring ? "var(--shadow-sm)" : undefined,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: Math.round(size * 0.38),
          letterSpacing: "-0.02em",
          fontFamily: "var(--font-display)",
        }}
      >
        {initials(name)}
      </span>
      {status && (
        <span
          style={{
            position: "absolute",
            right: 0,
            bottom: 0,
            width: Math.max(10, Math.round(size * 0.22)),
            height: Math.max(10, Math.round(size * 0.22)),
            borderRadius: "50%",
            background: status === "open" ? "var(--success)" : "var(--gray-400)",
            border: "2px solid var(--surface)",
          }}
        />
      )}
    </span>
  );
}
