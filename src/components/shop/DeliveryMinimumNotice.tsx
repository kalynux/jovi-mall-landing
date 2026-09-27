"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/shop/ds";
import { formatMoney } from "@/lib/shop/format";
import type { CartLine } from "@/lib/shop/shop.types";
import type { CartQuote, CartQuoteVendorLine } from "@/lib/shop/customer.types";

/**
 * "Add X more from this shop" — the delivery minimum, before the pay button.
 *
 * The vendor pays the delivery fee, so checkout refuses a shop's part of the
 * basket that is too small to carry it (`422 ORDER_BELOW_DELIVERY_MINIMUM`,
 * ADR-A07). The quote reports the same verdict per shop, and this renders it:
 * one line per failing shop, saying how much more to add FROM THAT SHOP —
 * items from another shop become a separate order and do not help.
 *
 * ⚠ Test `met`, never `shortfall > 0`. A unit with `minimumSubtotal: null`
 * cannot pass at any basket size and reports `shortfall: 0` while failing; for
 * cash on delivery the way out is paying online, not adding items.
 *
 * Deliberately nothing about fees or commission: the API does not return them,
 * and they are the vendor's terms, not the shopper's business.
 */
export function DeliveryMinimumNotice({
  quote,
  lines,
}: {
  quote: CartQuote | null;
  lines: CartLine[];
}) {
  const t = useTranslations("shop.deliveryMinimum");

  const failing = shortShops(quote);
  if (!quote || failing.length === 0) return null;

  return (
    <div
      role="status"
      className="mb-4"
      style={{
        display: "flex",
        gap: 9,
        alignItems: "flex-start",
        border: "1px solid var(--warning-border)",
        background: "var(--warning-bg)",
        borderRadius: "var(--radius-md)",
        padding: "11px 13px",
      }}
    >
      <Icon name="triangle-alert" size={17} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 1 }} />
      <div style={{ flex: 1 }}>
        <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-body)", margin: 0 }}>
          <strong>{t("title", { n: failing.length })}</strong>
        </p>
        <ul style={{ margin: "6px 0 0", paddingLeft: 16, fontSize: 12.5, lineHeight: 1.55, color: "var(--text-body)" }}>
          {failing.map((shop) => (
            <li key={shop.vendorId}>{shopSentence(t, shop, lines, quote.currency)}</li>
          ))}
        </ul>
        {quote.paymentMethod === "cash_on_delivery" && (
          <p className="muted" style={{ fontSize: 12, lineHeight: 1.5, margin: "6px 0 0" }}>
            {t("codHint")}
          </p>
        )}
      </div>
    </div>
  );
}

/** The shops whose items checkout will refuse. A `null` verdict is not one. */
export function shortShops(quote: CartQuote | null): CartQuoteVendorLine[] {
  return quote?.perVendor.filter((v) => v.deliveryMinimum?.met === false) ?? [];
}

type Translator = (key: string, values?: Record<string, string>) => string;

/**
 * "From <this shop>", for a sentence — the preposition included.
 *
 * The store name comes from the local snapshot, and a line restored from the
 * server may not have one — then one of the shop's own items names it: "from
 * the seller of “Blue cap”" points at the right rows as well as a name would.
 *
 * ⚠ The preposition lives in the phrase, not the sentence, because fr/es/pt
 * contract it with the fallback's article ("du", "del", "do") and a template
 * reading "de {shop}" printed "de le vendeur".
 */
export function fromShop(t: Translator, vendorId: string, lines: CartLine[]): string {
  const own = lines.filter((l) => l.vendorId === vendorId);
  const named = own.find((l) => l.storeName)?.storeName;
  if (named) return t("from", { name: named });
  return own[0] ? t("fromSellerOf", { item: `“${own[0].title}”` }) : t("fromThisSeller");
}

function shopSentence(t: Translator, shop: CartQuoteVendorLine, lines: CartLine[], currency: string): string {
  const minimum = shop.deliveryMinimum!;
  const from = fromShop(t, shop.vendorId, lines);
  const unreachable = minimum.units.some((u) => !u.met && u.minimumSubtotal === null);

  if (unreachable) {
    return minimum.checkedPer === "shipment"
      ? t("codUnreachable", { from })
      : t("unreachable", { from });
  }
  return t("addMore", { from, amount: formatMoney(minimum.shortfall, currency) });
}
