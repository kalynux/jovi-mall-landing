/**
 * Keeping left-to-right values intact inside right-to-left text.
 *
 * ── The bug this exists for ──────────────────────────────────────────────────
 *
 * `26 000 FCFA` is, to the Unicode bidirectional algorithm, a left-to-right run
 * of digits and Latin letters joined by *neutral* spaces. Neutrals take the
 * direction of the paragraph around them, so in Arabic — where `/ar` sets
 * `dir="rtl"` on `<html>` — the run is reordered and every price in the product
 * grid, the cart, the order summary and the payment page rendered:
 *
 *     intended   26 000 FCFA
 *     Arabic     FCFA 000 26
 *
 * It is not a formatting mistake; the string is correct and the paragraph
 * rearranges it. The fix is to tell the algorithm that the amount is one
 * indivisible object.
 *
 * ── Why isolate marks rather than CSS ────────────────────────────────────────
 *
 * `unicode-bidi: isolate` on a wrapping element does the same job, and is the
 * right tool when a styled element is guaranteed to be there. Prices are not
 * like that: the same formatted string goes into a `<title>`, an `aria-label`, a
 * toast, a WhatsApp share message and a push notification body, none of which
 * carry CSS. Isolating in the string covers all of them and cannot be undone by
 * a component that forgets to wrap.
 *
 * U+2068 FIRST STRONG ISOLATE opens a run whose direction is taken from its own
 * first strong character; U+2069 POP DIRECTIONAL ISOLATE closes it. Between
 * them the amount orders itself, and to the text outside the pair is a single
 * neutral object that the surrounding script positions correctly. Both marks are
 * zero-width and invisible in LTR text, so nothing changes for the other four
 * locales.
 *
 * ⚠ **They are invisible but they ARE characters.** `formatXAF(26000) === "26 000
 * FCFA"` is false. Compare against the formatter's own output, or run the value
 * through {@link stripBidiIsolates} first. Never write an isolated string into
 * something that will be parsed as a number, used as an object key, or sent to
 * the API — these helpers are for display text only.
 */

/** U+2068 FIRST STRONG ISOLATE */
const FSI = "⁨";
/** U+2069 POP DIRECTIONAL ISOLATE */
const PDI = "⁩";

/** All four isolate marks: LRI, RLI, FSI, PDI. */
const ISOLATE_MARKS = /[⁦-⁩]/g;

/**
 * Wrap a value so the text around it cannot reorder its parts.
 *
 * For amounts, measurements, phone numbers, reference codes — anything whose
 * internal order is fixed and whose separators are bidi-neutral.
 */
export function isolateLtr(text: string): string {
  return `${FSI}${text}${PDI}`;
}

/**
 * Strip the isolate marks again.
 *
 * For tests asserting on readable text, and for anywhere a formatted value has
 * to be measured, compared or matched as plain characters.
 */
export function stripBidiIsolates(text: string): string {
  return text.replace(ISOLATE_MARKS, "");
}
