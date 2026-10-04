"use client";

import { useTranslations } from "next-intl";
import { fromShop } from "@/components/shop/DeliveryMinimumNotice";
import { formatMoney } from "@/lib/shop/format";
import type { CartLine } from "@/lib/shop/shop.types";
import type { CartQuote } from "@/lib/shop/customer.types";

/**
 * One delivery line per shop, from the cart quote (ADR-A11).
 *
 * Replaces the blanket "Delivery included", which was true only while every shop
 * paid delivery. Each shop that ships gets its own line: the quote's
 * `perVendor[].delivery`, or "Free" when it is 0. Under it, when the shop
 * delivers free above an amount and the basket is short of it, a NON-blocking
 * hint says how much more from THAT shop makes it free — items from another
 * shop are another order and do not count.
 *
 * 🔴 Nothing is added up here. The quote's `total` already includes every line
 * drawn below, and it is the figure checkout charges.
 *
 * A digital-only shop (`deliveryPayer: null`) ships nothing and gets no line.
 * An API from before ADR-A11 sends no `deliveryPayer` at all — that shop still
 * gets a line, from its `delivery`, which was 0 then and meant exactly that.
 */
export function DeliveryQuoteLines({
  quote,
  lines,
  compact = false,
}: {
  quote: CartQuote;
  lines: CartLine[];
  /** The checkout summary's tighter rhythm. */
  compact?: boolean;
}) {
  const t = useTranslations("shop.delivery");
  const tMinimum = useTranslations("shop.deliveryMinimum");

  const shops = quote.perVendor.filter((shop) => shop.deliveryPayer !== null);
  if (shops.length === 0) return null;
  const several = shops.length > 1;

  return (
    <>
      {shops.map((shop) => {
        const shortfall = shop.freeDelivery?.shortfall;
        return (
          <div key={shop.vendorId}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                fontSize: compact ? 13 : 13.5,
                padding: compact ? "3px 0" : "5px 0",
                color: "var(--text-body)",
              }}
            >
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {several ? t("lineShop", { shop: shopName(t, shop.vendorId, lines) }) : t("line")}
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
                {shop.delivery > 0 ? (
                  formatMoney(shop.delivery, quote.currency)
                ) : (
                  <span style={{ color: "var(--success)", fontWeight: 700 }}>{t("free")}</span>
                )}
              </span>
            </div>
            {typeof shortfall === "number" && shortfall > 0 && (
              <p
                style={{
                  fontSize: 12,
                  lineHeight: 1.5,
                  color: "var(--brand-hover)",
                  fontWeight: 600,
                  margin: "0 0 4px",
                }}
              >
                {t("addForFree", {
                  amount: formatMoney(shortfall, quote.currency),
                  from: fromShop(tMinimum, shop.vendorId, lines),
                })}
              </p>
            )}
          </div>
        );
      })}

      {/* Priced in-region because no drop-off region was readable — the
          out-of-region part can only be added once an address is chosen. */}
      {quote.regionKnown === false && quote.delivery > 0 && (
        <p className="muted" style={{ fontSize: 11.5, lineHeight: 1.5, margin: "2px 0 6px" }}>
          {t("regionUnknown")}
        </p>
      )}
    </>
  );
}

type Translator = (key: string, values?: Record<string, string>) => string;

/**
 * A shop's name for a label. The cart lines carry it when the line was added on
 * this device; a line restored from the server may not, and then one of the
 * shop's own items names it.
 */
function shopName(t: Translator, vendorId: string, lines: CartLine[]): string {
  const own = lines.filter((l) => l.vendorId === vendorId);
  const named = own.find((l) => l.storeName)?.storeName;
  if (named) return named;
  return own[0] ? t("sellerOf", { item: `“${own[0].title}”` }) : t("thisSeller");
}
