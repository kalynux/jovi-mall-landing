/** Money + slug helpers for the shop. Currency is XAF (FCFA), space-grouped. */

// fr-FR groups thousands with a narrow no-break space (U+202F). Normalise any
// narrow/no-break space or comma separator to a plain ASCII space.
const GROUP_SEP = new RegExp("[\\u202F\\u00A0,]", "g");
// Combining diacritical marks (produced by NFKD) to strip for clean slugs.
const COMBINING = new RegExp("[\\u0300-\\u036f]", "g");

/** Format an XAF amount like the design: `9 900 FCFA` (regular spaces). */
export function formatXAF(n: number): string {
  const value = Math.round(Number(n) || 0);
  return value.toLocaleString("fr-FR").replace(GROUP_SEP, " ") + " FCFA";
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
