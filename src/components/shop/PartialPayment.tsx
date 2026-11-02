"use client";

import { useCallback, useId, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@/components/shop/ds";
import { Link } from "@/i18n/navigation";
import { currencyLabel, formatMoney } from "@/lib/shop/format";
import {
  parsePartialAmount,
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
        aria-describedby={`${id}-hint`}
        style={{ fontVariantNumeric: "tabular-nums", fontSize: 16 }}
      />
      <p
        id={`${id}-hint`}
        style={{
          fontSize: 12.5,
          lineHeight: 1.5,
          margin: "6px 0 0",
          color: amount === null ? "var(--danger)" : "var(--text-muted)",
        }}
      >
        {t("amountHint", {
          min: formatMoney(limits.minimumAmount, currency),
          max: formatMoney(limits.maximumAmount, currency),
        })}
      </p>
      {amount !== null && (
        <p style={{ fontSize: 12.5, lineHeight: 1.5, margin: "2px 0 0", color: "var(--text-body)" }}>
          {t("cashLater", { amount: formatMoney(limits.total - amount, currency) })}
        </p>
      )}
    </div>
  );
}

/**
 * What is different from plain cash on delivery, where refusing a parcel costs
 * nothing. The brief is explicit that this is said on the payment screen, before
 * the customer pays — so it stays visible while the field is, not behind a link.
 */
export function PartialPaymentWarning({ style }: { style?: CSSProperties }) {
  const t = useTranslations("shop.partialPayment");
  return (
    <div
      role="note"
      style={{
        display: "flex",
        gap: 9,
        alignItems: "flex-start",
        border: "1px solid var(--border)",
        background: "var(--warning-bg)",
        borderRadius: "var(--radius-md)",
        padding: "11px 13px",
        ...style,
      }}
    >
      <Icon name="triangle-alert" size={17} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.55, color: "var(--text-body)" }}>
        <p style={{ margin: 0, fontWeight: 700, color: "var(--text-strong)" }}>{t("warningTitle")}</p>
        <p style={{ margin: "2px 0 0" }}>{t("warningBody")}</p>
        <p style={{ margin: "4px 0 0" }}>{t("warningReview")}</p>
      </div>
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
      return limits
        ? t("amountOutOfRange", {
            min: formatMoney(limits.minimum, currency),
            max: formatMoney(limits.maximum, currency),
          })
        : null;
    },
    [currency, t],
  );
}
