/**
 * Wi-Mall's Legal Centre — the one place its documents' addresses live.
 *
 * A hub plus seven documents, hosted on the CDN, not in this repo, and updated
 * in place at these same URLs, so link to them and never copy the text in.
 * Always the `.html` page: it has its own language switch, "Download PDF" and
 * print buttons (swap `.html` for `.pdf` if a raw PDF is ever needed).
 *
 * The slug is the document's file name on the CDN, so a new one is a new
 * entry in `LEGAL_DOCS` and nothing else. The task list that placed each one
 * on the site is api-doc/public/FRONTEND-CHANGELOG-legal-centre.md.
 *
 * Only English and French exist. French UI gets French; every other locale
 * gets English.
 *
 * In the app these must open outside the WebView (the PDF download fails
 * inside it on Android) — use `LegalLink`, which goes through `openExternal`.
 *
 * The short web addresses (/privacy, /terms, /cookies, /legal and their French
 * forms) are redirects in next.config.ts, which imports this file — so keep it
 * free of `@/` path aliases.
 */
export const LEGAL_DOCS = [
  "legal-centre",
  "terms-of-service",
  "privacy-policy",
  "returns-refunds-policy",
  "cookie-policy",
  "prohibited-items-policy",
  "seller-agreement",
  "delivery-partner-agreement",
] as const;

export type LegalDoc = (typeof LEGAL_DOCS)[number];

const CDN = "https://cdn.wi-mall.com/legal";

export function legalUrl(doc: LegalDoc, locale: string): string {
  return `${CDN}/${doc}-${locale === "fr" ? "fr" : "en"}.html`;
}
