"use client";

import { useCallback, useId } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/shop/ds";
import { Link } from "@/i18n/navigation";
import { currencyLabel, formatMoney } from "@/lib/shop/format";
import {
  parsePartialAmount,
  partialAmountBreach,
  refusedAmountLimits,
  type PartialLimits,
  type PartialRefusalReason,
} from "@/lib/shop/partial-payment";
import { TICKET_NEW } from "@/lib/shop/shop.routes";

/**
 * The pieces checkout and the order's pay sheet share for "pay part now"; the
 * rules are in `lib/shop/partial-payment.ts`.
 */

/**
 * The one amount, for the whole checkout, however many shops it spans.
 *
 * The line under it is the limits, turning red while what is typed cannot be
 * charged. The split below is only a preview: the server shares the amount
 * across shops and parcels, and each parcel's cash is on the order afterwards.
 */
export function PartialAmountField({
  limits,
  value,
  onChange,
  currency,
  disabled,
}: {
  limits: PartialLimits;
  value: string;
  onChange: (next: string) => void;
  currency: string;
  disabled?: boolean;
}) {
  const t = useTranslations("shop.partialPayment");
  const id = useId();
  const amount = parsePartialAmount(value, limits);
  const breach = partialAmountBreach(value, limits);

  return (
    <div>
      <label
        htmlFor={`${id}-amount`}
        style={{
          display: "block",
          fontSize: 12.5,
          fontWeight: 600,
          color: "var(--text-strong)",
          marginBottom: 6,
        }}
      >
        {t("amountLabel", { currency: currencyLabel(currency) })}
      </label>
      <input
        id={`${id}-amount`}
        className="field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="numeric"
        autoComplete="off"
        dir="ltr"
        disabled={disabled}
        aria-invalid={amount === null}
        aria-describedby={breach ? `${id}-hint` : undefined}
        style={{ fontVariantNumeric: "tabular-nums", fontSize: 16 }}
      />
      {/* Only the limit what is typed breaks, and only while it breaks it. */}
      {breach && (
        <p
          id={`${id}-hint`}
          role="status"
          style={{ fontSize: 12.5, lineHeight: 1.5, margin: "6px 0 0", color: "var(--danger)" }}
        >
          {breach.bound === "min"
            ? t("amountBelowMin", { min: formatMoney(breach.value, currency) })
            : t("amountAboveMax", { max: formatMoney(breach.value, currency) })}
        </p>
      )}
      {amount !== null && (
        <p style={{ fontSize: 12.5, lineHeight: 1.5, margin: "2px 0 0", color: "var(--text-body)" }}>
          {t("cashLater", { amount: formatMoney(limits.total - amount, currency) })}
        </p>
      )}
    </div>
  );
}

/**
 * Why "pay part now" just went away. Shown only to a shopper who had chosen it:
 * while a shop has simply not opted in, the row is absent and nothing is said,
 * so no other checkout changes. An unknown reason is still "unavailable", and
 * `customer_restricted` names no shop and says where to ask, like cash on delivery.
 */
export function PartialPaymentNotice({ reason }: { reason: PartialRefusalReason }) {
  const t = useTranslations("shop.partialPayment.unavailable");
  return (
    <div
      role="status"
      style={{
        display: "flex",
        gap: 9,
        alignItems: "flex-start",
        border: "1px solid var(--border)",
        background: "var(--surface-2)",
        borderRadius: "var(--radius-md)",
        padding: "11px 13px",
        marginBottom: 12,
      }}
    >
      <Icon name="info" size={17} style={{ color: "var(--text-muted)", flexShrink: 0, marginTop: 1 }} />
      <p style={{ flex: 1, minWidth: 0, margin: 0, fontSize: 12.5, lineHeight: 1.55, color: "var(--text-body)" }}>
        {reason === "customer_restricted"
          ? t.rich("customer_restricted", {
              support: (chunks) => (
                <Link href={TICKET_NEW} style={{ fontWeight: 600, color: "var(--brand)" }}>
                  {chunks}
                </Link>
              ),
            })
          : t(reason)}
      </p>
    </div>
  );
}

/**
 * A refused amount in the shopper's terms, with the limits the server named —
 * `null` for any other refusal, which the shared ladder words.
 */
export function useRefusedAmount(currency: string): (error: unknown) => string | null {
  const t = useTranslations("shop.partialPayment");
  return useCallback(
    (error: unknown) => {
      const limits = refusedAmountLimits(error);
      if (!limits) return null;
      // The side the refused amount fell on. Both only when the server did not
      // say what it refused, which is the one case either could be the reason.
      if (limits.requested !== null && limits.requested > limits.maximum) {
        return t("amountAboveMax", { max: formatMoney(limits.maximum, currency) });
      }
      if (limits.requested !== null && limits.requested < limits.minimum) {
        return t("amountBelowMin", { min: formatMoney(limits.minimum, currency) });
      }
      return t("amountOutOfRange", {
        min: formatMoney(limits.minimum, currency),
        max: formatMoney(limits.maximum, currency),
      });
    },
    [currency, t],
  );
}
