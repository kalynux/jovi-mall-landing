import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/site";
import { LOCALE_CODES, localePath } from "@/i18n/routing";

/**
 * Per-visitor state, not content: cart, checkout, saved items and account.
 * Disallow is prefix-matched, so "/shop/checkout" also covers
 * "/shop/checkout/success".
 *
 * Blocking these here is second best — a disallowed URL can still be indexed on
 * the strength of inbound links, since the crawler never fetches it to find a
 * noindex. It is the only option available: each of these is a "use client"
 * page, and client components cannot export metadata. Split any of them into a
 * server wrapper and it should move to `robots: { index: false }` instead.
 *
 * The auth routes are deliberately NOT listed. They carry a real noindex from
 * app/(auth)/layout.tsx, and adding a Disallow here would block the fetch that
 * lets a crawler read it.
 */
/**
 * `/shop/p` and `/shop/store` are the app's query-string addresses for a
 * product and a store. They exist in the web build too — one codebase — and
 * each is a second URL for a document that already has a canonical one, so
 * neither should be offered to a crawler. Both also carry `robots: { index:
 * false }` in their own metadata, which is the control that actually works;
 * this is the cheaper one that stops the fetch.
 */
const PRIVATE_PATHS = [
  "/shop/cart",
  "/shop/checkout",
  "/shop/saved",
  "/shop/account",
  "/shop/p",
  "/shop/store",
];

export default function robots(): MetadataRoute.Robots {
  // Each path once per locale: /shop/cart is the English URL, /fr/shop/cart the
  // French one, and a rule for the first says nothing about the second.
  const disallow = LOCALE_CODES.flatMap((locale) =>
    PRIVATE_PATHS.map((path) => localePath(locale, path))
  );

  return {
    rules: [{ userAgent: "*", allow: "/", disallow }],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
