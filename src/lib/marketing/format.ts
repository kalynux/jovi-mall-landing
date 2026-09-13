import { isolateLtr } from "@/lib/bidi";
import type { Locale } from "@/i18n/routing";

/**
 * Number and price formatting for the marketing pages.
 *
 * Grouping follows the locale — "5,000" in English, "5 000" in French — but the
 * numbering system is pinned to Latin digits. Arabic's default is Arabic-Indic
 * (٥٬٠٠٠), and every price the rest of this product shows a Cameroonian
 * merchant, from the dashboard to the WhatsApp thread, is in Latin digits. One
 * page rendering them differently is a mismatch, not a localisation.
 *
 * The currency comes from the plan, never from a constant here: it is a
 * per-plan, admin-editable field on the catalog. Today every seeded plan and
 * pack is XAF, but hardcoding that would make a future second currency render
 * as a wrong number rather than as an unfamiliar one.
 */

/**
 * How each ISO code is written where it is spent. XAF is universally "FCFA" in
 * Cameroon and writing "XAF 5,000" at a merchant would read as a foreign price.
 * Anything unmapped falls back to its own code, which is wrong-looking but never
 * misleading.
 */
const CURRENCY_LABELS: Record<string, string> = {
  XAF: "FCFA",
  XOF: "FCFA",
};

export function currencyLabel(currency: string): string {
  return CURRENCY_LABELS[currency] ?? currency;
}

export function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(locale, { numberingSystem: "latn" }).format(value);
}

/**
 * Written as a suffix rather than through `style: "currency"`: Intl renders XAF
 * variously as "FCFA 5,000", "5 000 F CFA" and "XAF 5,000" depending on locale,
 * and the number followed by FCFA is how the market writes it.
 *
 * ⚠ **That suffix is exactly what makes the isolate necessary.** `5 000 FCFA` is
 * a run of Latin digits and letters joined by a bidi-neutral space, so on `/ar`
 * — where `<html dir="rtl">` — the paragraph reorders it to `FCFA 000 5`. Pinning
 * the numbering system to Latin above is what puts a *Latin* run into an Arabic
 * paragraph in the first place, so the two decisions belong together. See
 * `lib/bidi.ts`.
 *
 * The returned string therefore contains invisible characters: compare against
 * this function's own output, not against a literal.
 */
export function formatPrice(locale: Locale, value: number, currency: string): string {
  return isolateLtr(`${formatNumber(locale, value)} ${currencyLabel(currency)}`);
}

/** Two decimals — the per-credit column, where the difference between packs is cents. */
export function formatUnitPrice(locale: Locale, value: number, currency: string): string {
  const formatted = new Intl.NumberFormat(locale, {
    numberingSystem: "latn",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

  return isolateLtr(`${formatted} ${currencyLabel(currency)}`);
}
