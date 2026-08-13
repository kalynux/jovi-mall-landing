"use client";

import { use, useCallback, useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  AccountCard,
  AccountShell,
  ResourceView,
} from "@/components/shop/account/AccountShell";
import { Badge, Button, Icon } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { ApiError } from "@/lib/auth/auth.types";
import { translateError } from "@/lib/auth/error-translator";
import { formatMoney } from "@/lib/shop/format";
import {
  cancelOrder,
  confirmDelivery,
  getOrderGroup,
  resendDeliveryCode,
} from "@/lib/shop/orders.api";
import {
  canCancel,
  canConfirmDelivery,
  fulfillmentChip,
  groupPaymentChip,
  isCod,
  paymentChip,
  pendingCollections,
} from "@/lib/shop/order-status";
import { useApiResource } from "@/lib/shop/useApiResource";
import type { CodCollection, CustomerOrder, OrderGroup } from "@/lib/shop/customer.types";

export default function OrderGroupPage({
  params,
}: {
  params: Promise<{ cartId: string }>;
}) {
  const { cartId } = use(params);
  const group = useApiResource<OrderGroup>(() => getOrderGroup(cartId), [cartId]);
  const format = useFormatter();

  return (
    <AccountShell title="Order details">
      <ResourceView
        status={group.status}
        error={group.error}
        data={group.data}
        onRetry={group.reload}
        errorFallback="We couldn't load this order."
      >
        {(g) => {
          const payment = groupPaymentChip(g.paymentStatus);
          return (
            <>
              <AccountCard style={{ marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-strong)" }}>
                      {formatMoney(g.totalAmount, g.currency)}
                    </div>
                    <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
                      Placed{" "}
                      {format.dateTime(new Date(g.createdAt), {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <Badge tone={payment.tone} icon={payment.icon}>
                    {payment.label}
                  </Badge>
                </div>
                {g.orderCount > 1 && (
                  <p className="muted" style={{ fontSize: 12.5, marginTop: 10, lineHeight: 1.5 }}>
                    <Icon name="info" size={13} style={{ verticalAlign: "-2px" }} /> This order
                    covers {g.orderCount} vendors. Each ships independently, so they can arrive on
                    different days — you were charged once for the whole order.
                  </p>
                )}
              </AccountCard>

              {g.orders.map((order) => (
                <VendorOrderCard
                  key={order.id}
                  order={order}
                  onChanged={group.reload}
                />
              ))}
            </>
          );
        }}
      </ResourceView>
    </AccountShell>
  );
}

function VendorOrderCard({
  order,
  onChanged,
}: {
  order: CustomerOrder;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const { flash, flashError } = useToast();
  const t = useTranslations("errors");

  const fulfillment = fulfillmentChip(order.fulfillmentStatus);
  const payment = paymentChip(order.paymentStatus);
  const cod = isCod(order);
  const collections = pendingCollections(order);

  const onCancel = useCallback(async () => {
    setBusy(true);
    try {
      await cancelOrder(order.id);
      flash("Order cancelled");
      onChanged();
    } catch (err) {
      // The vendor's cancellation policy and the paid-order rule both refuse
      // here with a specific reason. Showing that reason is the whole point —
      // "something went wrong" would leave the customer retrying a button that
      // can never succeed.
      flashError(translateError(t, err, "We couldn't cancel this order."));
    } finally {
      setBusy(false);
    }
  }, [order.id, flash, flashError, onChanged, t]);

  const onConfirm = useCallback(async () => {
    setBusy(true);
    try {
      await confirmDelivery(order.id);
      flash("Thanks — delivery confirmed");
      onChanged();
    } catch (err) {
      flashError(translateError(t, err, "We couldn't confirm this delivery."));
    } finally {
      setBusy(false);
    }
  }, [order.id, flash, flashError, onChanged, t]);

  return (
    <AccountCard style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontWeight: 800, fontSize: 14, color: "var(--text-strong)" }}>
          {order.orderNumber}
        </span>
        <div style={{ flex: 1 }} />
        <Badge size="sm" productType={order.orderType}>
          {order.orderType}
        </Badge>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <Badge size="sm" tone={fulfillment.tone} icon={fulfillment.icon}>
          {fulfillment.label}
        </Badge>
        <Badge size="sm" tone={payment.tone} icon={payment.icon}>
          {payment.label}
        </Badge>
        {cod && (
          <Badge size="sm" tone="neutral" icon="banknote">
            Cash on delivery
          </Badge>
        )}
      </div>

      {/* Line items */}
      {order.items && order.items.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {order.items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                fontSize: 13.5,
                color: "var(--text-body)",
                padding: "5px 0",
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ fontWeight: 700 }}>{item.quantity}×</span> {item.title}
                {item.variantTitle && (
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    {" "}
                    · {item.variantTitle}
                  </span>
                )}
                {item.freeDelivery && (
                  <span
                    className="muted"
                    style={{ fontSize: 11.5, display: "block", marginTop: 1 }}
                  >
                    Free delivery
                  </span>
                )}
              </span>
              <span style={{ fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {formatMoney(item.price * item.quantity, item.currency)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontSize: 14,
          fontWeight: 800,
          borderTop: "1px solid var(--border-subtle)",
          paddingTop: 9,
          color: "var(--text-strong)",
        }}
      >
        <span>Order total</span>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatMoney(order.total, order.currency)}
        </span>
      </div>

      {collections.map((c) => (
        <DeliveryCodeCard
          key={c.shipmentId}
          orderId={order.id}
          collection={c}
          onResent={onChanged}
        />
      ))}

      {(canCancel(order) || canConfirmDelivery(order)) && (
        <div
          style={{
            display: "flex",
            gap: 8,
            marginTop: 12,
            paddingTop: 10,
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          {canConfirmDelivery(order) && (
            <Button size="sm" leadingIcon="circle-check-big" disabled={busy} onClick={onConfirm}>
              Confirm delivery
            </Button>
          )}
          <div style={{ flex: 1 }} />
          {canCancel(order) && (
            <Button
              variant="ghost"
              size="sm"
              leadingIcon="circle-x"
              disabled={busy}
              onClick={onCancel}
              style={{ color: "var(--danger)" }}
            >
              Cancel order
            </Button>
          )}
        </div>
      )}
    </AccountCard>
  );
}

/**
 * The customer's secret 6-digit COD code for one shipment.
 *
 * This is the customer's proof-of-payment lever: handing it over early is the
 * equivalent of signing a receipt before being paid, which is why the warning
 * sits beside the digits rather than in a tooltip. There is deliberately no
 * confirm-delivery button on a COD shipment — verifying the code is what records
 * the payment and marks it delivered, in the same step.
 */
function DeliveryCodeCard({
  orderId,
  collection,
  onResent,
}: {
  orderId: string;
  collection: CodCollection;
  onResent: () => void;
}) {
  const [code, setCode] = useState(collection.deliveryCode);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { flash, flashError } = useToast();
  const t = useTranslations("errors");

  // Tick the resend cooldown down to zero. Without this the button would show
  // "Wait 43s" and stay disabled forever, because nothing else re-renders this
  // card — locking a customer out of a code they may genuinely need.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const resend = useCallback(async () => {
    setBusy(true);
    try {
      const next = await resendDeliveryCode(orderId, collection.shipmentId);
      setCode(next.deliveryCode);
      flash("A new code was generated");
      onResent();
    } catch (err) {
      // Regeneration is capped at one per 60 s. Telling someone to wait 43
      // seconds is actionable; "too many requests" is not.
      if (err instanceof ApiError && err.code === "COD_CODE_RESEND_TOO_SOON") {
        const retry = Number(
          (err.details as { retryInSeconds?: number } | undefined)?.retryInSeconds ?? 60,
        );
        setCooldown(retry);
        flashError(`Please wait ${retry}s before requesting another code.`);
      } else {
        flashError(translateError(t, err, "We couldn't send a new code."));
      }
    } finally {
      setBusy(false);
    }
  }, [orderId, collection.shipmentId, flash, flashError, onResent, t]);

  if (!code) return null;

  return (
    <div
      style={{
        marginTop: 12,
        border: "1.5px solid var(--brand)",
        background: "var(--brand-subtle)",
        borderRadius: "var(--radius-md)",
        padding: 13,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Icon name="banknote" size={18} style={{ color: "var(--brand-hover)" }} />
        <span style={{ fontWeight: 800, fontSize: 13.5, color: "var(--text-strong)" }}>
          Pay {formatMoney(collection.expectedAmount, collection.currency)} in cash
        </span>
      </div>

      <div
        style={{
          fontSize: 30,
          fontWeight: 800,
          letterSpacing: "0.22em",
          color: "var(--brand-hover)",
          fontVariantNumeric: "tabular-nums",
          textAlign: "center",
          padding: "8px 0",
        }}
      >
        {code}
      </div>

      <p
        style={{
          fontSize: 12.5,
          lineHeight: 1.55,
          color: "var(--text-body)",
          margin: "4px 0 0",
          display: "flex",
          gap: 6,
        }}
      >
        <Icon name="triangle-alert" size={15} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 1 }} />
        <span>
          Only give this code to the delivery agent <strong>after</strong> you have received your
          package and paid. It is what records your payment.
        </span>
      </p>

      <div style={{ display: "flex", marginTop: 8 }}>
        <div style={{ flex: 1 }} />
        <Button
          variant="ghost"
          size="sm"
          leadingIcon="refresh-cw"
          disabled={busy || cooldown > 0}
          onClick={resend}
        >
          {cooldown > 0 ? `Wait ${cooldown}s` : "Send a new code"}
        </Button>
      </div>
    </div>
  );
}
