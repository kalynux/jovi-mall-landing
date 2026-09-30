"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getPaymentOptions,
  type PaymentProvider,
  type PaymentProviderOption,
} from "@/lib/shop/payments.api";
import { optionsFromProviders, type PaymentOption } from "./PaymentMethodPicker";

export interface PaymentOptionsState {
  /**
   * The rows `/options` allows, in its order. `null` until the first answer.
   * **`[]` is a real answer**: online payment is switched off right now.
   */
  options: PaymentOption[] | null;
  /** The request itself failed — not the same thing as an empty list. */
  failed: boolean;
  /** Ask again. For the failed state's button. */
  reload: () => void;
  /**
   * Re-render from a `PAYMENT_PROVIDER_UNAVAILABLE` refusal.
   *
   * `details.offered` is the server's fresh list, so the rows shrink to it
   * immediately and everything else on the form stays as it is. `null` — a
   * refusal that carried no list — asks `/options` again instead of guessing.
   */
  applyOffered: (offered: PaymentProvider[] | null) => void;
}

/**
 * What the shopper can pay with, asked fresh each time a pay screen opens.
 *
 * `GET /api/payments/options` is `no-store` on purpose: an administrator can
 * switch a provider off, or move it to an aggregator with a code step, at any
 * moment. So this re-reads whenever `enabled` turns true — a sheet passes its
 * own `open`, a page its signed-in state — and never caches across screens.
 */
export function usePaymentOptions(enabled: boolean): PaymentOptionsState {
  const [entries, setEntries] = useState<PaymentProviderOption[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    getPaymentOptions()
      .then((list) => {
        if (cancelled) return;
        setEntries(list);
        setFailed(false);
      })
      .catch(() => {
        if (cancelled) return;
        // A list already on screen is kept: a failed re-read on reopening a
        // sheet is no reason to take away rows that worked a minute ago.
        setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const applyOffered = useCallback((offered: PaymentProvider[] | null) => {
    if (offered === null) {
      setNonce((n) => n + 1);
      return;
    }
    setEntries((current) => {
      const known = current ?? [];
      return offered.map((provider): PaymentProviderOption => {
        const entry = known.find((e) => e.provider === provider);
        if (entry) return entry;
        // A provider that came back on since the screen loaded. `offered` is
        // names only, so it gets the baseline for its kind — a number for
        // mobile money, nothing for a card. `flow` is only ever a hint; the
        // charge's own answer decides the next screen.
        return provider === "CARD"
          ? { provider, kind: "CARD", flow: "CARD_ELEMENT", fields: [], mayRequireOtp: false }
          : { provider, kind: "MOBILE_MONEY", flow: "PUSH", fields: ["phoneNumber"], mayRequireOtp: false };
      });
    });
  }, []);

  const options = useMemo(() => (entries ? optionsFromProviders(entries) : null), [entries]);

  return { options, failed: failed && entries === null, reload, applyOffered };
}
