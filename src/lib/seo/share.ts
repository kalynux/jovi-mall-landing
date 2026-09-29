import type { Metadata } from "next";

/**
 * The default social share card.
 *
 * ── Why this exists rather than the file convention ───────────────────────────
 * `src/app/opengraph-image.png` lives in the ROOT app segment, and this app has
 * no `app/layout.tsx` — every route is under `app/[locale]`. Next therefore
 * served the file at `/opengraph-image.png` and attached it to **nothing**.
 *
 * ── Why every page has to name it ─────────────────────────────────────────────
 * Metadata inheritance is not symmetrical between the two blocks, which is the
 * part that makes this easy to get wrong. Measured on this app:
 *
 *   `twitter`   MERGES  — a page that omits `images` still inherits the layout's.
 *   `openGraph` REPLACES — a page that declares `openGraph` at all loses the
 *                          layout's `images` entirely, even though it only meant
 *                          to override the title and url.
 *
 * Nineteen routes declare `openGraph` to set their own title, description and
 * url. Before 2026-09-29 exactly three of them set `images`, so the other
 * sixteen — the homepage, every marketing page, every city page, the blog index
 * — shared on WhatsApp as a title and a description on a blank card.
 *
 * So: **any page that declares `openGraph` must also declare `images`.** Spread
 * this in unless the page has a better, more specific image of its own (an
 * article cover, a product photo, a storefront banner).
 *
 * The path is relative on purpose — `metadataBase` in `app/[locale]/layout.tsx`
 * resolves it to an absolute URL, which WhatsApp and Facebook both require.
 */
export const SHARE_IMAGES: NonNullable<Metadata["openGraph"]>["images"] = [
  {
    url: "/opengraph-image.png",
    width: 1200,
    height: 630,
    // Not localized, deliberately: the card is a brand mark rather than prose,
    // and the brand name reads the same in all five languages.
    alt: "Wi-Mall",
  },
];

/** The Twitter/X twin. Same picture, separate field — the blocks do not share. */
export const SHARE_IMAGES_TWITTER: NonNullable<Metadata["twitter"]>["images"] = [
  { url: "/twitter-image.png", width: 1200, height: 630, alt: "Wi-Mall" },
];
