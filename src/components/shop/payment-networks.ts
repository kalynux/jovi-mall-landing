import type { MobileProvider } from "@/lib/shop/payments.api";

/**
 * The networks' own names, for sentences like "This number is on MTN".
 *
 * Brand names, so the same in every language (LOCALISATION.md §6) — which is
 * why they live here and not in the catalogues. The wire values (`ORANGE`) are
 * codes, never copy.
 */
export const NETWORK_NAME: Record<MobileProvider, string> = {
  MTN: "MTN",
  ORANGE: "Orange",
  MOOV: "Moov",
};
