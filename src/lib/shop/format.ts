/** Money + slug helpers for the shop. Currency is XAF (FCFA), space-grouped. */

import { isolateLtr } from "@/lib/bidi";

// fr-FR groups thousands with a narrow no-break space (U+202F). Normalise any
// narrow/no-break space or comma separator to a plain ASCII space.
const GROUP_SEP = new RegExp("[\\u202F\\u00A0,]", "g");
// Combining diacritical marks (produced by NFKD) to strip for clean slugs.
const COMBINING = new RegExp("[\\u0300-\\u036f]", "g");

/**
 * Format an XAF amount like the design: `9 900 FCFA` (regular spaces).
 *
 * ⚠ **The returned string is bidi-isolated** — see `lib/bidi.ts` for why, and
 * for the one thing that surprises people: `formatXAF(9900) === "9 900 FCFA"` is
 * false, because the marks are invisible characters. Strip them before
 * comparing.
 */
export function formatXAF(n: number): string {
  const value = Math.round(Number(n) || 0);
  return isolateLtr(value.toLocaleString("fr-FR").replace(GROUP_SEP, " ") + " FCFA");
}

/**
 * Format an amount in the currency the record actually carries.
 *
 * `formatXAF` hardcodes FCFA, which is right for the catalogue — XAF is the
 * platform default and what every seeded price is in. Orders, cart lines and
 * COD collections each carry their own `currency` field though, and printing an
 * order in FCFA because that is the usual case would misstate what someone was
 * charged. Amounts are whole units; XAF has no minor unit, so nothing is
 * divided by 100.
 */
export function formatMoney(amount: number, currency: string): string {
  if (!currency || currency.toUpperCase() === "XAF") return formatXAF(amount);
  const value = Math.round(Number(amount) || 0);
  return isolateLtr(
    `${value.toLocaleString("fr-FR").replace(GROUP_SEP, " ")} ${currency.toUpperCase()}`,
  );
}

/** Discount percentage from a compare-at price, rounded. */
export function discountPct(price: number, compareAt?: number | null): number | null {
  if (!compareAt || compareAt <= price) return null;
  return Math.round(((compareAt - price) / compareAt) * 100);
}

/** URL-safe, descriptive slug from a title/name (diacritics stripped). */
export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(COMBINING, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
