"use client";

import { useState } from "react";
import { useFormatter } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  AccountCard,
  AccountShell,
  ResourceView,
} from "@/components/shop/account/AccountShell";
import { Badge, Button, EmptyState, Icon } from "@/components/shop/ds";
import { formatMoney } from "@/lib/shop/format";
import { listOrderGroups } from "@/lib/shop/orders.api";
import { groupPaymentChip, fulfillmentChip, isCod } from "@/lib/shop/order-status";
import { useApiResource } from "@/lib/shop/useApiResource";
import type { ListMeta } from "@/lib/api/client";
import type { OrderGroup } from "@/lib/shop/customer.types";

const PAGE_SIZE = 20;

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const orders = useApiResource<{ data: OrderGroup[]; meta: ListMeta }>(
    () => listOrderGroups({ page, limit: PAGE_SIZE }),
    [page],
  );

  return (
    <AccountShell
      title="My orders"
      description="Each entry is one checkout. An order containing items from several vendors is split into one delivery per vendor — you paid once."
    >
      <ResourceView
        status={orders.status}
        error={orders.error}
        data={orders.data}
        onRetry={orders.reload}
        errorFallback="We couldn't load your orders."
      >
        {({ data, meta }) =>
          data.length === 0 ? (
            <EmptyState
              icon="package"
              title="No orders yet"
              description="When you buy something it will show up here, with its delivery progress."
            />
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.map((g) => (
                  <OrderGroupRow key={g.cartId} group={g} />
                ))}
              </div>

              {meta.pages > 1 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 12,
                    marginTop: 20,
                  }}
                >
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon="chevron-left"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    Page {meta.page} of {meta.pages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    trailingIcon="chevron-right"
                    disabled={page >= meta.pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )
        }
      </ResourceView>
    </AccountShell>
  );
}

function OrderGroupRow({ group }: { group: OrderGroup }) {
  const format = useFormatter();
  const payment = groupPaymentChip(group.paymentStatus);
  const hasCod = group.orders.some(isCod);

  return (
    <Link href={`/shop/account/orders/${group.cartId}`} style={{ textDecoration: "none" }}>
      <AccountCard style={{ cursor: "pointer" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 9 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text-strong)" }}>
              {formatMoney(group.totalAmount, group.currency)}
            </div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
              {format.dateTime(new Date(group.createdAt), {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}{" "}
              · {group.orderCount} {group.orderCount === 1 ? "vendor" : "vendors"}
            </div>
          </div>
          <Icon name="chevron-right" size={18} style={{ color: "var(--text-subtle)" }} />
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Badge size="sm" tone={payment.tone} icon={payment.icon}>
            {payment.label}
          </Badge>
          {hasCod && (
            <Badge size="sm" tone="neutral" icon="banknote">
              Cash on delivery
            </Badge>
          )}
          {/* One chip per distinct fulfilment state across the group's orders —
              a two-vendor order where one shipped and one has not should say so
              rather than pick a winner. */}
          {[...new Set(group.orders.map((o) => o.fulfillmentStatus))].map((s) => {
            const chip = fulfillmentChip(s);
            return (
              <Badge key={s} size="sm" tone={chip.tone} icon={chip.icon}>
                {chip.label}
              </Badge>
            );
          })}
        </div>
      </AccountCard>
    </Link>
  );
}
