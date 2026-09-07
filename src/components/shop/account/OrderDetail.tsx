"use client";

import { useFormatter } from "next-intl";
import {
  AccountCard,
  AccountShell,
  ResourceView,
} from "@/components/shop/account/AccountShell";
import { Badge, Button, EmptyState, Icon } from "@/components/shop/ds";
import { Link, useRouter } from "@/i18n/navigation";
import { getOrder } from "@/lib/shop/orders.api";
import { isCod, paymentChip } from "@/lib/shop/order-status";
import { orderGroupPath, orderPath, orderTrackingPath } from "@/lib/shop/shop.routes";
import { useApiResource } from "@/lib/shop/useApiResource";
import { Shipments, VendorOrderCard } from "@/components/shop/account/OrderGroupDetail";
import type { CustomerOrder } from "@/lib/shop/customer.types";

/**
 * ONE order — one seller's slice of a checkout basket.
 *
 * ── Why this exists beside the group screen ──────────────────────────────────
 *
 * A basket holding three shops' items becomes **three orders**, one per shop,
 * sharing one `cartId`. `/shop/account/orders/:cartId` shows that whole checkout
 * group, and it is the right screen to arrive at from order history — it is what
 * the shopper paid for, once.
 *
 * A notification is about **one** of those orders — *"your parcel from Shop B
 * has shipped"* — and carries that order's id. Handing an order id to the group
 * screen looks up a group that does not exist, so for months every "View order"
 * button in every email, WhatsApp message and inbox row was a 404. The
 * alternative on the table was to send the group id instead and land on the page
 * that already existed; it was offered and declined, because a message about one
 * parcel should land on that parcel.
 *
 * ── Two screens, one card ────────────────────────────────────────────────────
 *
 * The body is `VendorOrderCard`, imported from the group screen rather than
 * rewritten — a shopper arriving from a push sees the same card they know from
 * their order history, and there is no second rendering of an order to drift out
 * of step with the first. This file adds only what the group header gave and a
 * lone order has to give itself: where the order sits, and the way back up to
 * the basket it came from.
 *
 * ⚠ **Never cache what this renders.** The carrying agent's name and photo
 * (backend ADR-A06) are a window scoped to a live delivery — `delivered` answers
 * `null` deliberately — so this reads fresh and keeps nothing.
 */
export function OrderDetail({ orderId }: { orderId: string }) {
  const order = useApiResource<CustomerOrder>(() => getOrder(orderId), [orderId]);

  return (
    <AccountShell title="Order details">
      <ResourceView
        status={order.status}
        error={order.error}
        data={order.data}
        onRetry={order.reload}
        errorFallback="We couldn't load this order."
      >
        {(o) => (
          <>
            <OrderHeader order={o} />
            <VendorOrderCard order={o} onChanged={order.reload} />
          </>
        )}
      </ResourceView>
    </AccountShell>
  );
}

/**
 * What the group header used to say, for one order.
 *
 * Three things a lone order card cannot say about itself: when it was placed,
 * that it is part of a larger basket, and — while it is still unpaid — where
 * paying actually happens.
 */
function OrderHeader({ order }: { order: CustomerOrder }) {
  const format = useFormatter();
  const router = useRouter();
  const payment = paymentChip(order.paymentStatus);

  /**
   * Unpaid, and payable by a route this screen does not own.
   *
   * A checkout group is charged **once**, with `initiatePayment({ cartId })` —
   * the `orderId` form exists on the API and the storefront deliberately does
   * not use it, because a group containing one cancelled order would otherwise
   * need a per-order call to avoid re-charging it. So the pay sheet lives on the
   * group screen and this sends the shopper there, rather than growing a second,
   * subtly different way to pay.
   *
   * COD is excluded for the reason the group screen excludes it: cash is settled
   * at the door, and `initiate` refuses with `422 PAYMENT_ORDER_IS_COD`.
   */
  const unpaid =
    !isCod(order) &&
    (order.paymentStatus === "AWAITING_PAYMENT" || order.paymentStatus === "pending");

  // Resolved once, so the two places that need it are not each re-proving that
  // `cartId` is present. Null is a legitimate answer — see the note below.
  const groupHref = order.cartId ? orderGroupPath(order.cartId) : null;

  return (
    <AccountCard style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="ds-overline">{order.orderNumber}</div>
          {order.createdAt && (
            <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
              Placed{" "}
              {format.dateTime(new Date(order.createdAt), {
                day: "numeric",
                month: "long",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          )}
        </div>
        <Badge tone={payment.tone} icon={payment.icon}>
          {payment.label}
        </Badge>
      </div>

      {/* The way back up. `cartId` is nullable on the wire, and an order without
          one is not an error — it simply has no group to return to. */}
      {groupHref && (
        <p className="muted" style={{ fontSize: 12.5, marginTop: 10, lineHeight: 1.5 }}>
          <Icon name="info" size={13} style={{ verticalAlign: "-2px" }} /> This is one
          seller&apos;s part of a larger order.{" "}
          <Link href={groupHref} style={{ fontWeight: 700 }}>
            See everything you bought
          </Link>
        </p>
      )}

      {unpaid && groupHref && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
          <p
            style={{
              fontSize: 12.5,
              lineHeight: 1.55,
              color: "var(--text-body)",
              margin: "0 0 10px",
            }}
          >
            This order is waiting to be paid and your items are held. One payment covers the whole
            basket, so it happens on the order this one belongs to.
          </p>
          <Button block leadingIcon="wallet" onClick={() => router.push(groupHref)}>
            Go to payment
          </Button>
        </div>
      )}

      {order.orderType === "physical" && (
        <div style={{ marginTop: 12 }}>
          <Button
            block
            variant="secondary"
            leadingIcon="map-pin"
            onClick={() => router.push(orderTrackingPath(order.id))}
          >
            Track delivery
          </Button>
        </div>
      )}
    </AccountCard>
  );
}

/**
 * Where one order's parcels are, live.
 *
 * ── Why it hangs off one order rather than a group ───────────────────────────
 *
 * A customer tracks **one parcel**. A checkout group can be several parcels,
 * going to several places, on different days, carried by different agencies —
 * "track my order" has no single answer there. So this nests under the order the
 * notification named.
 *
 * ── The socket rule that matters most ────────────────────────────────────────
 *
 * The live position comes from **geo-tracker**, a separate service, over a
 * WebSocket signed with the same access token this API uses. All of that lives
 * in `DeliveryTracking`, which `Shipments` mounts per parcel — including the one
 * rule worth repeating anywhere it is reachable from:
 *
 * 🔴 **`permission_revoked` fires in three situations and only ONE of them means
 * the delivery finished.** `shipment_completed` is that one.
 * `authorization_expired` and `authorization_unavailable` say nothing at all
 * about the parcel — reporting an outcome from either tells a customer their
 * parcel arrived because their token aged out, which is exactly what shipped
 * once and had to be fixed on both sides.
 *
 * ── A digital order has nothing to track ─────────────────────────────────────
 *
 * `Shipments` is mounted for physical orders only, the same condition the order
 * card applies. A digital order reaching this URL is told so, rather than shown
 * an empty parcel list for something that was never coming.
 */
export function OrderTracking({ orderId }: { orderId: string }) {
  const router = useRouter();
  const order = useApiResource<CustomerOrder>(() => getOrder(orderId), [orderId]);

  return (
    <AccountShell title="Track delivery">
      <ResourceView
        status={order.status}
        error={order.error}
        data={order.data}
        onRetry={order.reload}
        errorFallback="We couldn't load this delivery."
      >
        {(o) => (
          <>
            <AccountCard style={{ marginBottom: 16 }}>
              <div className="ds-overline">{o.orderNumber}</div>
              <p className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
                {o.store?.name ? `From ${o.store.name}` : "Your parcel"}
              </p>
              <div style={{ marginTop: 12 }}>
                <Button
                  block
                  variant="secondary"
                  leadingIcon="receipt-text"
                  onClick={() => router.push(orderPath(o.id))}
                >
                  See the order
                </Button>
              </div>
            </AccountCard>

            {o.orderType === "physical" ? (
              <AccountCard>
                <Shipments
                  orderId={o.id}
                  isCod={isCod(o)}
                  // The drop-off, geocoded and frozen at checkout, for the map's
                  // second pin. It belongs to the order — the shipment read
                  // carries no address of any kind — so it comes from here.
                  deliveryAddress={o.deliveryAddress}
                  onChanged={order.reload}
                  whenEmpty={
                    <EmptyState
                      icon="package"
                      title="Nothing on the road yet"
                      description="The seller is still preparing this order. As soon as it is handed to a courier you'll be able to follow it here."
                    />
                  }
                />
              </AccountCard>
            ) : (
              <EmptyState
                icon="cloud-download"
                title="Nothing to deliver"
                description="This is a digital order — there is no parcel on the way. Your files are in your downloads."
              />
            )}
          </>
        )}
      </ResourceView>
    </AccountShell>
  );
}
