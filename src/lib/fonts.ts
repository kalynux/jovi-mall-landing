import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";

/**
 * Fonts are self-hosted at build time rather than fetched from fonts.gstatic.com
 * at runtime. The old `<link>` in the layout blocked first paint on a round trip
 * to Google's servers; these are served from our own origin, preloaded, and
 * given a matched fallback so text does not reflow when the real face lands.
 *
 * Both are variable fonts, so no `weight` is declared — the whole axis ships in
 * one file, which covers the 400–800 range the design uses.
 *
 * Latin subset only, on purpose: neither family has Arabic glyphs, and :lang(ar)
 * in globals.css hands RTL text to a system stack instead.
 */
export const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-jakarta",
});

export const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jetbrains",
});
