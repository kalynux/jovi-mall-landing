"use client";

import { useTranslations } from "next-intl";
import { Icon } from "@/components/shop/ds";
import { fromShop } from "@/components/shop/DeliveryMinimumNotice";
import { Link } from "@/i18n/navigation";
import { codRemovableShops, type CodRefusal } from "@/lib/shop/cash-on-delivery";
import { TICKET_NEW } from "@/lib/shop/shop.routes";
import type { CartLine } from "@/lib/shop/shop.types";

/**
 * Why cash on delivery is not among the ways to pay — said above the rows that
 * are, in place of its own.
 *
 * One line per reason the quote can give (`cashOnDelivery.reason`), and a
 * generic one for a reason this build does not know: unknown is still
 * "unavailable", never a guess.
 *
 * ⚠ `customer_restricted` gets no basket advice. An administrator switched
 * cash on delivery off for the account, so removing items or changing shop
 * changes nothing — and the administrator's reason is never sent, so the line
 * says where to ask (support) rather than why.
 *
 * For a shop's or a delivery company's refusal the shop is named only while
 * taking its items out would leave something to pay on delivery.
 */
export function CodUnavailableNotice({ refused, lines }: { refused: CodRefusal; lines: CartLine[] }) {
  const t = useTranslations("shop.codUnavailable");
  const tShop = useTranslations("shop.deliveryMinimum");
  const removable = codRemovableShops(
    refused,
    lines.map((l) => l.vendorId),
  );

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
      <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, lineHeight: 1.55, color: "var(--text-body)" }}>
        <p style={{ margin: 0 }}>
          {refused.reason === "customer_restricted"
            ? t.rich("customer_restricted", {
                support: (chunks) => (
                  <Link href={TICKET_NEW} style={{ fontWeight: 600, color: "var(--brand)" }}>
                    {chunks}
                  </Link>
                ),
              })
            : t(refused.reason)}
        </p>
        {removable.map((vendorId) => (
          <p key={vendorId} style={{ margin: "4px 0 0" }}>
            {t("removeToKeep", { from: fromShop(tShop, vendorId, lines) })}
          </p>
        ))}
      </div>
    </div>
  );
}
