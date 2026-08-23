"use client";

export interface AvatarProps {
  name: string;
  /**
   * A store logo, where one exists.
   *
   * Stores carry a real `logo` file now, and initials are the fallback rather
   * than the only option. `null`/absent keeps the initials, which is also what a
   * broken URL should degrade to — hence the `onError` below.
   */
  src?: string | null;
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

export function Avatar({ name, src, size = 40, shape = "circle", ring, status }: AvatarProps) {
  const radius = shape === "squircle" ? Math.round(size * 0.3) : "50%";
  const frame = {
    width: size,
    height: size,
    borderRadius: radius,
    border: ring ? "2px solid var(--surface)" : undefined,
    boxShadow: ring ? "var(--shadow-sm)" : undefined,
  } as const;

  return (
    <span style={{ position: "relative", display: "inline-flex", flexShrink: 0 }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          style={{ ...frame, objectFit: "cover", background: "var(--surface-2)" }}
          
        />
      ) : (
        <span
          aria-hidden
          style={{
            ...frame,
            background: "var(--brand-subtle)",
            color: "var(--brand-hover)",
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
      )}
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
