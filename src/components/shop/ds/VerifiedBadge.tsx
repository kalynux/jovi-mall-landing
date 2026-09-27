"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";

/**
 * Whose verification this badge vouches for. It picks the accessible label only;
 * the glyph is the same for all three, so a customer learns one mark.
 */
export type VerifiedKind = "vendor" | "agency" | "agent";

export interface VerifiedBadgeProps {
  kind: VerifiedKind;
  size?: number;
  style?: CSSProperties;
}

/**
 * The seal's outline: a circle whose radius swings on a cosine, sampled finely
 * enough to read as a smooth curve at any size it is drawn at.
 *
 * The family resemblance to the Facebook / WhatsApp mark is intended — it is the
 * shape people already read as "verified" — but it is not a copy. Theirs is a
 * tight many-pointed rosette in blue; this one has ten broad, soft lobes and is
 * filled with the brand green.
 *
 * Built once at module load rather than written out as a literal, so the lobe
 * count and depth stay tunable.
 */
const SEAL_PATH = (() => {
  const lobes = 10;
  const samples = 120;
  const [cx, cy, base, depth] = [12, 12, 10.6, 0.95];
  let d = "";
  for (let i = 0; i < samples; i++) {
    const a = (i / samples) * Math.PI * 2;
    const r = base + depth * Math.cos(lobes * a);
    d += `${i === 0 ? "M" : "L"}${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  }
  return `${d}Z`;
})();

/**
 * The verification mark for a seller, a delivery company or a courier.
 *
 * Render it **only from the API's flag** — `verified` on a store, an agency or an
 * agent block — never infer it from a status or a plan. A missing flag (an older
 * API) means no badge, not a guess.
 *
 * It is an image with a label rather than decoration, because the claim is the
 * point: a screen reader announces "Verified seller" after the name, and a
 * pointer hovering it gets the same words from `<title>`.
 */
export function VerifiedBadge({ kind, size = 16, style }: VerifiedBadgeProps) {
  const t = useTranslations("shop.ds.verified");
  const label = t(kind);

  return (
    <svg
      role="img"
      aria-label={label}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle", ...style }}
    >
      <title>{label}</title>
      <path d={SEAL_PATH} fill="var(--brand)" />
      <path
        d="M7.6 12.4l3 3 5.8-6.3"
        fill="none"
        stroke="var(--brand-on)"
        strokeWidth={2.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
