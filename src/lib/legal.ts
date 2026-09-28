/**
 * Wi-Mall's Privacy Policy and Terms of Service — the one place their
 * addresses live.
 *
 * Hosted on the CDN, not in this repo, and updated in place at these same
 * URLs, so link to them and never copy the text in. Always the `.html` page:
 * it has its own language switch and "Download PDF" button (swap `.html` for
 * `.pdf` if a raw PDF is ever needed).
 *
 * Only English and French exist. French UI gets French; every other locale
 * gets English.
 *
 * In the app these must open outside the WebView (the PDF download fails
 * inside it on Android) — use `LegalLink`, which goes through `openExternal`.
 *
 * The short web addresses (/privacy, /terms, /fr/confidentialite,
 * /fr/conditions) are redirects in next.config.ts, which imports this file —
 * so keep it free of `@/` path aliases.
 */
export type LegalDoc = "privacy" | "terms";

export const LEGAL_URLS = {
  privacy: {
    en: "https://cdn.wi-mall.com/legal/privacy-policy-en.html",
    fr: "https://cdn.wi-mall.com/legal/privacy-policy-fr.html",
  },
  terms: {
    en: "https://cdn.wi-mall.com/legal/terms-of-service-en.html",
    fr: "https://cdn.wi-mall.com/legal/terms-of-service-fr.html",
  },
} as const satisfies Record<LegalDoc, { en: string; fr: string }>;

export function legalUrl(doc: LegalDoc, locale: string): string {
  return LEGAL_URLS[doc][locale === "fr" ? "fr" : "en"];
}
