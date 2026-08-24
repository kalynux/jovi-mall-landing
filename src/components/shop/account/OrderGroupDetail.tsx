"use client";

import { useCallback, useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  AccountCard,
  AccountShell,
  ResourceView,
} from "@/components/shop/account/AccountShell";
import { Avatar, Badge, Button, ConfirmDialog, Icon } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { ApiError } from "@/lib/auth/auth.types";
import { translateError } from "@/lib/auth/error-translator";
import { formatMoney } from "@/lib/shop/format";
import { Link } from "@/i18n/navigation";
import { storePath } from "@/lib/shop/shop.routes";
import {
  cancelOrder,
  confirmDelivery,
  confirmShipmentDelivery,
  getOrderGroup,
  listOrderShipments,
  resendDeliveryCode,
} from "@/lib/shop/orders.api";
import { PayGroupSheet } from "@/components/shop/account/PayGroupSheet";
import {
  canCancel,
  canConfirmDelivery,
  canPayGroup,
  fulfillmentChip,
  groupPaymentChip,
  isCod,
  paymentChip,
  payableTotal,
  pendingCollections,
  type StatusChip,
} from "@/lib/shop/order-status";
import { publicUrl } from "@/lib/shop/shop.types";
import { ReviewDisclosure } from "@/components/shop/account/ReviewForm";
import { useApiResource } from "@/lib/shop/useApiResource";
import type {
  CodCollection,
  CustomerOrder,
  CustomerShipment,
  CustomerShipmentAgent,
  CustomerShipmentAgency,
  CustomerShipmentStatus,
  OrderGroup,
} from "@/lib/shop/customer.types";

/**
 * One checkout group: every order it produced, their shipments, and the actions
 * still open on them.
 *
 * Lives in `components/` rather than in the route because two routes render it.
 * The web addresses an order group by path — `/shop/account/orders/:cartId` —
 * and the app by query, `/shop/account/order?id=:cartId`, since a static export
 * has no server to resolve a path segment against. Both hand the same id to
 * this component; see `shop.routes.ts`.
 */
export function OrderGroupDetail({ cartId }: { cartId: string }) {
  const group = useApiResource<OrderGroup>(() => getOrderGroup(cartId), [cartId]);

  return (
    <AccountShell title="Order details">
      <ResourceView
        status={group.status}
        error={group.error}
        data={group.data}
        onRetry={group.reload}
        errorFallback="We couldn't load this order."
      >
        {(g) => (
          <>
            <GroupSummary group={g} />

            {g.orders.map((order) => (
              <VendorOrderCard
                key={order.id}
                order={order}
                onChanged={group.reload}
              />
            ))}
          </>
        )}
      </ResourceView>
    </AccountShell>
  );
}

/**
 * The group header: what was ordered, when, and — when it is still unpaid —
 * how to pay for it.
 *
 * The pay call-to-action is the reason this is a component rather than markup
 * inside the render prop: it owns the sheet's open state, and `ResourceView`'s
 * children are a function, so a hook could not live there.
 */
function GroupSummary({ group }: { group: OrderGroup }) {
  const format = useFormatter();
  const [paying, setPaying] = useState(false);

  const payment = groupPaymentChip(group.paymentStatus);
  const payable = canPayGroup(group);
  const due = payableTotal(group);

  return (
    <>
      <AccountCard style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-strong)" }}>
              {formatMoney(group.totalAmount, group.currency)}
            </div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
              Placed{" "}
              {format.dateTime(new Date(group.createdAt), {
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

        {group.orderCount > 1 && (
          <p className="muted" style={{ fontSize: 12.5, marginTop: 10, lineHeight: 1.5 }}>
            <Icon name="info" size={13} style={{ verticalAlign: "-2px" }} /> This order covers{" "}
            {group.orderCount} vendors. Each ships independently, so they can arrive on different
            days — you were charged once for the whole order.
          </p>
        )}

        {/* Unpaid, and payable. Checkout writes the orders before it charges
            anything, so this is the ordinary state after a declined prompt —
            not an error, and the copy says so. */}
        {payable && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-body)", margin: "0 0 10px" }}>
              This order is waiting to be paid. Nothing has been charged and your items are held —
              pay now to have the seller start on it.
            </p>
            <Button
              block
              leadingIcon="wallet"
              onClick={() => setPaying(true)}
            >
              Pay {formatMoney(due, group.currency)}
            </Button>
          </div>
        )}
      </AccountCard>

      {/* Mounted whenever the order is payable rather than only while open, so
          the sheet's close animation has something to run on — but not at all
          on a paid order, where it would drag in the phone field and its
          country list for a control that can never be reached. */}
      {payable && (
        <PayGroupSheet group={group} open={paying} onClose={() => setPaying(false)} />
      )}
    </>
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
  const [confirmCancel, setConfirmCancel] = useState(false);
  const { flash, flashError } = useToast();
  const t = useTranslations("errors");

  const fulfillment = fulfillmentChip(order.fulfillmentStatus);

  /**
   * A cheap pre-filter for "has this arrived at all".
   *
   * Deliberately not the real test — completion is `completion.confirmed_at`
   * server-side, set by the customer confirming delivery, the COD cash handover
   * or the auto-confirm sweep, and none of those is visible from here. The
   * eligibility endpoint is the authority; this only avoids drawing a rate
   * button on an order that is still being packed.
   */
  const reviewable =
    order.fulfillmentStatus === "delivered" ||
    order.fulfillmentStatus === "fulfilled" ||
    order.fulfillmentStatus === "partially_delivered";
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
      setConfirmCancel(false);
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
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
        {/* The seller, not the vendor id. "Order from 507f1f77bcf86cd799439aaa"
            is not a receipt — the store name is what a customer recognises. */}
        {order.store?.slug ? (
          <Link
            href={storePath(order.store.slug)}
            style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text-strong)" }}
          >
            {order.store.name ?? "Seller"}
          </Link>
        ) : (
          <span style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text-strong)" }}>
            {order.store?.name ?? "Seller"}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <Badge size="sm" productType={order.orderType}>
          {order.orderType}
        </Badge>
      </div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
        {order.orderNumber}
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

      {/* Line items. With thumbnails — order history without pictures is close
          to unreadable on a phone, which is why the image was asked for. */}
      {order.items && order.items.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {order.items.map((item) => (
            <div
              key={item.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                fontSize: 13.5,
                color: "var(--text-body)",
                padding: "6px 0",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={publicUrl(item.image) ?? "/no_product_image.png"}
                alt=""
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: "var(--radius-sm)",
                  objectFit: "cover",
                  flexShrink: 0,
                  background: "var(--surface-2)",
                }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
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

          {/* Rating is earned by a *completed* order, which server-side means
              `completion.confirmed_at` rather than `fulfillment_status`. This
              only pre-filters the obviously-too-early cases so the page does not
              offer a button that leads straight to a 422; the eligibility read
              inside the form is what actually decides, and it is the authority. */}
          {reviewable && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginTop: 4,
                paddingTop: 8,
                borderTop: "1px solid var(--border-subtle)",
              }}
            >
              {order.items.map((item) => (
                <ReviewDisclosure
                  key={`review-${item.id}`}
                  subjectType="product"
                  subjectId={item.productId}
                  label={item.title}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* The receipt. `tax` and `discount` are pinned zeros server-side, so they
          are shown only if either ever becomes real — printing "Tax 0" on every
          order is noise, but the shape is ready for the day it is not. */}
      <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: 9 }}>
        {order.priceBreakdown && (
          <>
            <BreakdownRow
              label="Items"
              value={formatMoney(order.priceBreakdown.base, order.currency)}
            />
            {order.orderType === "physical" && (
              <BreakdownRow
                label="Delivery"
                value={<span style={{ color: "var(--success)", fontWeight: 700 }}>Included</span>}
              />
            )}
            {order.priceBreakdown.discount > 0 && (
              <BreakdownRow
                label="Discount"
                value={`− ${formatMoney(order.priceBreakdown.discount, order.currency)}`}
              />
            )}
            {order.priceBreakdown.tax > 0 && (
              <BreakdownRow
                label="Tax"
                value={formatMoney(order.priceBreakdown.tax, order.currency)}
              />
            )}
          </>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 14,
            fontWeight: 800,
            color: "var(--text-strong)",
            paddingTop: order.priceBreakdown ? 6 : 0,
          }}
        >
          <span>Order total</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatMoney(order.total, order.currency)}
          </span>
        </div>
      </div>

      {/* Parcels. Physical orders only — a digital order has nothing to ship. */}
      {order.orderType === "physical" && (
        <Shipments orderId={order.id} isCod={cod} onChanged={onChanged} />
      )}

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
              onClick={() => setConfirmCancel(true)}
              style={{ color: "var(--danger)" }}
            >
              Cancel order
            </Button>
          )}
        </div>
      )}

      {/* Cancelling cannot be undone from here — there is no un-cancel, only
          ordering again at whatever the price and stock are then. And the
          button sits beside "Confirm delivery", which is the opposite answer. */}
      <ConfirmDialog
        open={confirmCancel}
        title="Cancel this order?"
        tone="danger"
        icon="circle-x"
        confirmLabel="Cancel order"
        cancelLabel="Keep it"
        busy={busy}
        onConfirm={() => void onCancel()}
        onCancel={() => setConfirmCancel(false)}
      >
        This tells {order.store?.name ?? "the seller"} to stop preparing it. It cannot be
        un-cancelled — you would have to order again. Anything already paid is refunded under the
        seller&apos;s policy.
      </ConfirmDialog>
    </AccountCard>
  );
}

function BreakdownRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 13,
        color: "var(--text-body)",
        padding: "2px 0",
      }}
    >
      <span>{label}</span>
      <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

/** The five words a customer is shown, and nothing from the dispatch machinery. */
const SHIPMENT_LABEL: Record<
  CustomerShipmentStatus,
  { label: string; icon: string; tone: StatusChip["tone"] }
> = {
  preparing: { label: "Preparing", icon: "package", tone: "neutral" },
  shipped: { label: "On its way", icon: "truck", tone: "brand" },
  out_for_delivery: { label: "Out for delivery", icon: "map-pin", tone: "brand" },
  delivered: { label: "Delivered", icon: "circle-check-big", tone: "success" },
  delivery_failed: { label: "Delivery failed", icon: "triangle-alert", tone: "danger" },
};

/**
 * The parcels on an order.
 *
 * This read is what makes `confirmShipmentDelivery` reachable at all. Before it
 * existed, **no customer-facing response returned a shipment id** except COD's
 * `codCollections` — which is `undefined` for every online-paid order — so a
 * prepaid customer could never confirm a delivery, and the tracking number was
 * disclosed exactly once, by the confirm call itself, after delivery, when it is
 * useless.
 *
 * There is deliberately no confirm button on a **COD** shipment: there, giving
 * the courier the delivery code records the payment and marks it delivered in
 * one step, and calling confirm returns `422 SHIPMENT_CONFIRMATION_NOT_ALLOWED`.
 */
function Shipments({
  orderId,
  isCod: cod,
  onChanged,
}: {
  orderId: string;
  isCod: boolean;
  onChanged: () => void;
}) {
  const [shipments, setShipments] = useState<CustomerShipment[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { flash, flashError } = useToast();
  const t = useTranslations("errors");
  const format = useFormatter();

  const load = useCallback(() => {
    listOrderShipments(orderId)
      .then(setShipments)
      // An order with no parcels yet is a 200 with an empty array; a failure
      // here should not take the whole order card down with it.
      .catch(() => setShipments([]));
  }, [orderId]);

  useEffect(load, [load]);

  const confirm = useCallback(
    async (shipmentId: string) => {
      setBusy(shipmentId);
      try {
        await confirmShipmentDelivery(orderId, shipmentId);
        flash("Thanks — delivery confirmed");
        load();
        onChanged();
      } catch (err) {
        flashError(translateError(t, err, "We couldn't confirm this parcel."));
      } finally {
        setBusy(null);
      }
    },
    [orderId, flash, flashError, load, onChanged, t]
  );

  if (!shipments || shipments.length === 0) return null;

  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
      <p className="ds-overline" style={{ marginBottom: 8 }}>
        {shipments.length === 1 ? "Parcel" : `${shipments.length} parcels`}
      </p>

      {shipments.map((shipment) => {
        const view = SHIPMENT_LABEL[shipment.status];
        return (
          <div
            key={shipment.id}
            style={{
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-md)",
              padding: 11,
              marginBottom: 8,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Badge size="sm" tone={view.tone} icon={view.icon}>
                {view.label}
              </Badge>
              {shipment.trackingNumber && (
                <span
                  className="muted"
                  style={{ fontSize: 11.5, fontFamily: "monospace", marginLeft: "auto" }}
                >
                  {shipment.trackingNumber}
                </span>
              )}
            </div>

            <Carrier agency={shipment.agency} agencyName={shipment.agencyName} agent={shipment.agent} />

            {shipment.statusHistory.length > 0 && (
              <ol style={{ listStyle: "none", margin: "10px 0 0", padding: 0 }}>
                {shipment.statusHistory.map((step, i) => (
                  <li
                    key={`${step.status}-${step.at}`}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "baseline",
                      fontSize: 12.5,
                      color: i === shipment.statusHistory.length - 1 ? "var(--text-strong)" : "var(--text-muted)",
                      padding: "3px 0",
                    }}
                  >
                    <Icon
                      name={SHIPMENT_LABEL[step.status].icon}
                      size={13}
                      style={{ color: "var(--brand)", flexShrink: 0 }}
                    />
                    <span style={{ fontWeight: 600 }}>{SHIPMENT_LABEL[step.status].label}</span>
                    <span style={{ marginLeft: "auto" }}>
                      {format.dateTime(new Date(step.at), {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {shipment.failedAttempts > 0 && (
              <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
                {shipment.failedAttempts} delivery attempt
                {shipment.failedAttempts === 1 ? "" : "s"} did not succeed. The courier will try
                again.
              </p>
            )}

            {/* A delivered parcel can be rated. The review names no agent and
                must not: attribution happens server-side, and the carrier block
                above is a separate disclosure that does not license naming one
                here. */}
            {shipment.status === "delivered" && (
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
                <ReviewDisclosure
                  subjectType="delivery"
                  subjectId={shipment.id}
                  label="this delivery"
                />
              </div>
            )}

            {!cod && shipment.status === "out_for_delivery" && (
              <div style={{ display: "flex", marginTop: 8 }}>
                <div style={{ flex: 1 }} />
                <Button
                  size="sm"
                  leadingIcon="circle-check-big"
                  disabled={busy === shipment.id}
                  onClick={() => void confirm(shipment.id)}
                >
                  I received this parcel
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Who is delivering this parcel, and — while they are holding it — who is
 * carrying it.
 *
 * Two disclosures with very different rules, drawn together because that is how
 * a recipient reads them, and separated in the code because conflating them is
 * the mistake this block exists to avoid.
 *
 * ── The agency is a company ──────────────────────────────────────────────────
 *
 * Its name, logo and support lines are business details its owner published.
 * They are always shown when present, and the support lines are the answer to
 * "who do I contact about my parcel".
 *
 * ── The courier is a person ──────────────────────────────────────────────────
 *
 * `agent` is a narrow, revocable window (backend ADR-A06), not a field that
 * happens to be nullable, and three rules follow from that:
 *
 *   1. **Render from the field, never from the status.** `delivery_failed`
 *      carries an agent when the attempt is retryable and `null` when the
 *      parcel was returned, and the customer vocabulary spells both the same.
 *   2. **Never persist it.** `delivered` answers `null` deliberately; caching
 *      the block into a local order record would re-serve a worker's face on a
 *      six-month-old order, which is the exact thing the ADR declined to do.
 *      Nothing here caches — the parent refetches — and nothing should start.
 *   3. **No call affordance, ever.** There is no phone number in this block and
 *      there will not be one; `agency.supportPhone` above is the contact path.
 *
 * There is deliberately no placeholder while `agent` is null. Before pickup the
 * usual reason is that no agent is bound yet, and naming a wait for someone the
 * customer may never meet is worse than saying nothing.
 */
function Carrier({
  agency,
  agencyName,
  agent,
}: {
  agency: CustomerShipmentAgency | null;
  agencyName: string | null;
  agent: CustomerShipmentAgent | null;
}) {
  // `agency.name` and `agencyName` are the same string from the same block, so
  // this is a belt-and-braces fallback rather than a real disagreement — and it
  // tolerates the one case the API documents, a magazin that exists but has not
  // been filled in, whose `name` is `""`.
  const name = agency?.name || agencyName || null;
  const contacts = [
    agency?.supportPhone && { icon: "phone", label: "Call", href: `tel:${agency.supportPhone}` },
    agency?.supportWhatsapp && {
      icon: "message-circle",
      label: "WhatsApp",
      href: `https://wa.me/${agency.supportWhatsapp.replace(/D/g, "")}`,
    },
    agency?.supportEmail && { icon: "mail", label: "Email", href: `mailto:${agency.supportEmail}` },
  ].filter(Boolean) as { icon: string; label: string; href: string }[];

  if (!name && !agent) return null;

  return (
    <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 9 }}>
      {name && (
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
          <Avatar name={name} src={publicUrl(agency?.logo) ?? undefined} size={28} shape="squircle" />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
              {name}
            </p>
            <p className="muted" style={{ fontSize: 11, margin: 0 }}>
              Delivery company
            </p>
          </div>
          {contacts.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
              {contacts.map((c) => (
                <a
                  key={c.icon}
                  href={c.href}
                  aria-label={`${c.label} ${name}`}
                  title={`${c.label} ${name}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 28,
                    height: 28,
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-body)",
                  }}
                >
                  <Icon name={c.icon} size={14} />
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      {agent && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 9,
            background: "var(--surface-2)",
            borderRadius: "var(--radius-sm)",
            padding: "7px 9px",
          }}
        >
          <Avatar name={agent.displayName} src={publicUrl(agent.photo) ?? undefined} size={28} />
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
              {agent.displayName}
            </p>
            <p className="muted" style={{ fontSize: 11, margin: 0 }}>
              Carrying your parcel
            </p>
          </div>
        </div>
      )}
    </div>
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
