"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { readProviderRefusal, type PaymentProvider } from "@/lib/shop/payments.api";
import { NETWORK_NAME } from "./payment-networks";

/**
 * The shopper's sentence for a charge the server refused before writing
 * anything, or `null` when the error is not one of those three.
 *
 * All three mean nothing was charged, so every caller keeps its form exactly as
 * it is — number, choice, saved wallet — and only says what to change:
 *
 *   - `PAYMENT_PROVIDER_PHONE_MISMATCH` names the number's real network, from
 *     `details.detected`.
 *   - `PAYMENT_PROVIDER_UNAVAILABLE` hands `details.offered` to `applyOffered`,
 *     so the rows re-render from the server's fresh list; an empty one is
 *     "online payment is unavailable".
 *   - `PAYMENT_PROVIDER_REQUIRED` can only come from an old-style body, so if a
 *     current build ever sees it the honest thing is to ask for a choice again.
 *
 * The backend's own `message` is English and names raw codes (`ORANGE`), which
 * is why each is keyed on `code` here instead.
 */
export function useChargeRefusal(applyOffered: (offered: PaymentProvider[] | null) => void) {
  const t = useTranslations("shop.payProvider");

  return useCallback(
    (error: unknown): string | null => {
      const refusal = readProviderRefusal(error);
      if (!refusal) return null;

      switch (refusal.code) {
        case "PAYMENT_PROVIDER_PHONE_MISMATCH": {
          const provider = refusal.provider && refusal.provider !== "CARD" ? refusal.provider : null;
          return provider
            ? t("mismatch", { detected: NETWORK_NAME[refusal.detected], provider: NETWORK_NAME[provider] })
            : t("mismatchNoChoice", { detected: NETWORK_NAME[refusal.detected] });
        }
        case "PAYMENT_PROVIDER_UNAVAILABLE":
          applyOffered(refusal.offered);
          return refusal.offered?.length === 0 ? t("onlineUnavailable") : t("providerSwitchedOff");
        case "PAYMENT_PROVIDER_REQUIRED":
          return t("providerRequired");
      }
    },
    [applyOffered, t]
  );
}
