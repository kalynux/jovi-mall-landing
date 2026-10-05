"use client";

import type { CSSProperties } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Badge, Button, Icon } from "@/components/shop/ds";
import { LegalLink } from "@/components/legal/LegalLink";
import { useRouter } from "@/i18n/navigation";
import { isolateLtr } from "@/lib/bidi";
import { formatAmount, formatMoney } from "@/lib/shop/format";
import {
  REFUND_CHIP,
  refundHasFee,
  refundStatusOf,
  type CustomerRefund,
} from "@/lib/shop/refund";

/** The new-ticket form — a declined refund carries no reason, so this is the way forward. */
const SUPPORT_NEW = "/shop/account/support/new";

/**
 * Where a refund stands, on an order or a booking.
 *
 * Mounted only when the record's `refund` is non-null, and fed from that block
 * alone — not from `paymentStatus` (an order can stay `paid` with a completed
 * partial refund) and not from `deliveryFeeRefund` (the delivery-fee ledger,
 * which keeps its own rows). See `lib/shop/refund.ts`.
 *
 * The amount is `netAmount`: what reaches the customer. The fee line explains
 * why it is less than `grossAmount`, using the API's numbers verbatim — nothing
 * here subtracts or multiplies. A card refund has no fee and never mentions one.
 */
export function RefundPanel({ refund, style }: { refund: CustomerRefund; style?: CSSProperties }) {
  const t = useTranslations("shop.refund");
  const format = useFormatter();
  const router = useRouter();
  const status = refundStatusOf(refund);
  const chip = REFUND_CHIP[status];
  const toCard = refund.channel === "card_refund";
  // The masked number is Latin digits and bullets: isolated so an Arabic
  // sentence around it cannot reorder it, the same way money is.
  const masked = refund.destinationMasked ? isolateLtr(refund.destinationMasked) : null;

  const headline =
    status === "sending"
      ? masked
        ? t("status.sending", { destination: masked })
        : t("status.sendingNoDestination")
      : status === "completed" && refund.completedAt
        ? t("status.completedOn", {
            date: format.dateTime(new Date(refund.completedAt), {
              day: "numeric",
              month: "long",
              year: "numeric",
            }),
          })
        : t(`status.${status}`);

  // `sending` already names the number in its headline.
  const destination = toCard
    ? t("toCard")
    : masked && status !== "sending" && status !== "declined"
      ? t("toNumber", { destination: masked })
      : null;

  return (
    <section
      aria-label={t("title")}
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 14,
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Icon name="hand-coins" size={17} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        <span className="ds-overline" style={{ flex: 1, minWidth: 0 }}>
          {t("title")}
        </span>
        {status !== "declined" && (
          <span
            style={{
              fontWeight: 800,
              fontSize: 15,
              color: "var(--text-strong)",
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
            }}
          >
            {formatMoney(refund.netAmount, refund.currency)}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 7, marginTop: 8 }}>
        <Icon
          name={chip.icon}
          size={15}
          style={{ color: `var(--${chip.tone === "neutral" ? "text-muted" : chip.tone})`, flexShrink: 0, marginTop: 2 }}
        />
        <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: "var(--text-body)", fontWeight: 600 }}>
          {headline}
        </p>
      </div>

      {status !== "declined" && refundHasFee(refund) && (
        <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, margin: "6px 0 0" }}>
          {t("feeLine", {
            net: formatMoney(refund.netAmount, refund.currency),
            gross: formatAmount(refund.grossAmount),
            percent: String(refund.feePercent),
          })}
        </p>
      )}

      {destination && (
        <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, margin: "6px 0 0" }}>
          {destination}
        </p>
      )}

      {status === "declined" && (
        <div style={{ marginTop: 10 }}>
          <Button
            size="sm"
            variant="secondary"
            leadingIcon="life-buoy"
            onClick={() => router.push(SUPPORT_NEW)}
          >
            {t("contactSupport")}
          </Button>
        </div>
      )}

      <LegalLink
        doc="returns-refunds-policy"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          marginTop: 10,
          fontSize: 12.5,
          fontWeight: 600,
          color: "var(--brand)",
        }}
      >
        {t("howItWorks")}
        <Icon name="external-link" size={13} />
      </LegalLink>
    </section>
  );
}

/** The small chip for a list row. */
export function RefundBadge({ refund }: { refund: CustomerRefund }) {
  const t = useTranslations("shop.refund");
  const status = refundStatusOf(refund);
  const chip = REFUND_CHIP[status];
  return (
    <Badge size="sm" tone={chip.tone} icon="hand-coins">
      {t(`badge.${status}`)}
    </Badge>
  );
}
