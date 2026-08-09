/**
 * Reading time and dates for articles.
 *
 * Reading time is derived here rather than read off a field the API sends —
 * and the API deliberately does not send one. An editor's estimate drifts the
 * moment the article is revised, and "6 min read" over four paragraphs is the
 * kind of small lie that costs a reader's trust cheaply. The input is the
 * API's `wordCount`, which is derived from the body on write.
 *
 * (This file used to count the words itself, walking the block tree. That went
 * when the CMS landed: two independent word counts on the same prose is two
 * numbers to reconcile, and the card and the article would eventually disagree
 * about how long the same piece takes to read.)
 */
import type { Locale } from "@/i18n/routing";

/**
 * 200 words a minute, applied to every language.
 *
 * Real silent-reading rates differ by language — French prose runs roughly 10%
 * longer than its English source for the same content, so a per-locale constant
 * would be *more* accurate. It would also mean the same article advertising
 * different lengths in different languages, which reads as a bug. One constant,
 * rounded up, and never below one minute.
 */
const WORDS_PER_MINUTE = 200;

export function readingMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
}

/**
 * The visible byline date.
 *
 * `timeZone: "UTC"` is not cosmetic: `publishedAt` is an instant, and rendering
 * it in the server's zone means a post published at 23:30 UTC shows yesterday's
 * date to a build machine an hour behind — a visible mismatch with the
 * `datePublished` in the structured data right beside it.
 *
 * Latin digits for the same reason as `lib/marketing/format.ts`: Arabic's
 * default numbering system is Arabic-Indic, and every other date and price in
 * this product is written in Latin digits.
 */
export function formatArticleDate(locale: Locale, iso: string): string {
  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
    numberingSystem: "latn",
  }).format(new Date(iso));
}

/** The `datetime` attribute for `<time>` — the date half of the instant. */
export function isoDate(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}
