"use client";

import { useCallback, useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  AccountCard,
  AccountShell,
  ResourceView,
} from "@/components/shop/account/AccountShell";
import { Avatar, Badge, Button, ConfirmDialog, Icon, type IconName } from "@/components/shop/ds";
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
import { isSettledFailure, verifyPayment } from "@/lib/shop/payments.api";
import { forgetPaymentAttempt, readPaymentAttempt } from "@/lib/shop/payment-attempts";
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
import { DeliveryTracking } from "@/components/shop/account/DeliveryTracking";
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
  const t = useTranslations("shop.orders");
  // Root-scoped: the screen title is `shop.nav`'s, shared with the header bar.
  const tKey = useTranslations();
  const group = useApiResource<OrderGroup>(() => getOrderGroup(cartId), [cartId]);

  return (
    <AccountShell title={tKey("shop.nav.titles.orderDetails")}>
      <ResourceView
        status={group.status}
        error={group.error}
        data={group.data}
        onRetry={group.reload}
        errorFallback={t("loadOneFailed")}
      >
        {(g) => (
          <>
            <GroupSummary group={g} onRefreshed={group.set} />

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
 *
 * ── Why there is a "check" beside the "pay" ──────────────────────────────────
 *
 * Mobile money settles asynchronously. The shopper approves the prompt on their
 * handset and the money moves some seconds — occasionally some minutes — later,
 * through the gateway's callback. Between those two moments this page says
 * "waiting to be paid" and offers a Pay button, which to someone who has just
 * paid reads as "that didn't work, do it again" — the one instruction we do not
 * want to give them. The check answers the question they actually have.
 *
 * `onRefreshed` replaces the loaded group rather than re-running the loader, so
 * the handler can *see* the new state and say what changed. `reload()` returns
 * nothing, and a check that silently re-renders is indistinguishable from a
 * check that did nothing.
 */
function GroupSummary({
  group,
  onRefreshed,
}: {
  group: OrderGroup;
  onRefreshed: (next: OrderGroup) => void;
}) {
  const format = useFormatter();
  const t = useTranslations("errors");
  const tOrders = useTranslations("shop.orders");
  const { flash } = useToast();
  const [paying, setPaying] = useState(false);
  const [checking, setChecking] = useState(false);
  /**
   * The last check's answer, kept inline rather than flashed.
   *
   * A toast is the wrong shape for "not through yet": it is the answer to a
   * question the shopper deliberately asked, it runs to a sentence or two, and
   * it sits above a Pay button it exists to talk them out of pressing. It has
   * to stay on screen. The one outcome that *is* a toast is success — the block
   * this note lives in unmounts the moment the order is paid.
   */
  const [checked, setChecked] = useState<{ tone: "info" | "danger"; message: string } | null>(null);

  // Root-scoped: the lib modules emit absolute keys (`shop.status.…`).
  const tKey = useTranslations();
  const payment = groupPaymentChip(group.paymentStatus);
  const payable = canPayGroup(group);
  const due = payableTotal(group);

  const check = useCallback(async () => {
    setChecking(true);
    setChecked(null);

    try {
      /*
       * 1. Force the gateway to be re-asked, when this device knows what to ask
       *    about. `verify` needs a transaction id and no order endpoint returns
       *    one, so this is the id written down at `initiate` — see
       *    `payment-attempts`. Absent for a shopper who paid on another device,
       *    which is why it is an enhancement to the check and not the check.
       */
      let refused = false;
      const transactionId = await readPaymentAttempt(group.cartId);
      if (transactionId) {
        try {
          refused = isSettledFailure((await verifyPayment(transactionId)).status);
        } catch {
          // A verify that errors is not a failed payment — the transaction may
          // still be settling, and the callback settles it without us. Fall
          // through to the order, which is the state the shopper is shown.
        }
      }

      /*
       * 2. Re-read the order either way. This is what makes the button work at
       *    all for the shopper who paid elsewhere, and it is also the authority:
       *    `verify` reports the transaction, the order reports whether the money
       *    landed against it.
       */
      const next = await getOrderGroup(group.cartId);
      onRefreshed(next);

      const remaining = payableTotal(next);

      if (remaining === 0) {
        await forgetPaymentAttempt(group.cartId);
        // The whole payable block — this note included — is gone on the next
        // render, so the good news has to be said somewhere that outlives it.
        flash(
          next.paymentStatus === "paid"
            ? tOrders("paymentReceived")
            : tOrders("nothingLeftToPay"),
        );
      } else if (remaining < due) {
        setChecked({
          tone: "info",
          // The amount goes in as a VALUE, keeping the bidi isolate marks
          // `formatMoney` wraps it in — never rebuilt from parts (§6).
          message: tOrders("partlyPaid", {
            amount: formatMoney(remaining, group.currency),
          }),
        });
      } else if (refused) {
        await forgetPaymentAttempt(group.cartId);
        setChecked({ tone: "danger", message: tOrders("paymentRefused") });
      } else {
        setChecked({ tone: "info", message: tOrders("paymentPending") });
      }
    } catch (err) {
      setChecked({
        tone: "danger",
        message: translateError(t, err, tOrders("checkFailed")),
      });
    } finally {
      setChecking(false);
    }
  }, [due, flash, group.cartId, group.currency, onRefreshed, t, tOrders]);

  return (
    <>
      <AccountCard style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: "var(--text-strong)" }}>
              {formatMoney(group.totalAmount, group.currency)}
            </div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>
              {tOrders("placedOn", {
                date: format.dateTime(new Date(group.createdAt), {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              })}
            </div>
          </div>
          <Badge tone={payment.tone} icon={payment.icon}>
            {tKey(payment.labelKey)}
          </Badge>
        </div>

        {group.orderCount > 1 && (
          <p className="muted" style={{ fontSize: 12.5, marginTop: 10, lineHeight: 1.5 }}>
            <Icon name="info" size={13} style={{ verticalAlign: "-2px" }} />{" "}
            {tOrders("multiVendorNote", { n: group.orderCount })}
          </p>
        )}

        {/* Unpaid, and payable. Checkout writes the orders before it charges
            anything, so this is the ordinary state after a declined prompt —
            not an error, and the copy says so.

            The copy used to open with "Nothing has been charged", which is a
            claim this screen is not in a position to make: an approved
            mobile-money prompt that has not settled yet looks identical from
            here, and telling that shopper their money is untouched is how they
            end up paying twice. */}
        {payable && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 12,
              borderTop: "1px solid var(--border-subtle)",
            }}
          >
            <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-body)", margin: "0 0 10px" }}>
              {tOrders("unpaidHeld")}
            </p>
            <Button
              block
              leadingIcon="wallet"
              disabled={checking}
              onClick={() => setPaying(true)}
            >
              {tOrders("payAmount", { amount: formatMoney(due, group.currency) })}
            </Button>

            {/* Secondary, and deliberately so: to a shopper who has not paid
                yet this is noise, and the one who has is looking for it. */}
            <Button
              block
              variant="secondary"
              leadingIcon="refresh-cw"
              disabled={checking}
              style={{ marginTop: 8 }}
              onClick={() => void check()}
            >
              {checking ? tOrders("checking") : tOrders("alreadyPaid")}
            </Button>

            {checked && (
              <div
                role="status"
                style={{
                  display: "flex",
                  gap: 9,
                  alignItems: "flex-start",
                  marginTop: 10,
                  border: `1px solid var(--${checked.tone === "danger" ? "danger-border" : "border"})`,
                  background:
                    checked.tone === "danger" ? "var(--danger-bg)" : "var(--surface-sunken)",
                  borderRadius: "var(--radius-md)",
                  padding: "11px 13px",
                }}
              >
                <Icon
                  name={checked.tone === "danger" ? "triangle-alert" : "hourglass"}
                  size={16}
                  style={{
                    color: checked.tone === "danger" ? "var(--danger)" : "var(--text-muted)",
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                />
                <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-body)", margin: 0 }}>
                  {checked.message}
                </p>
              </div>
            )}
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

/**
 * One seller's order: what is in it, what it cost, its parcels, and the actions
 * still open on it.
 *
 * Exported because two screens draw it. The group screen renders one per order
 * in a checkout group; `OrderDetail` renders exactly one, for the order a
 * notification named. Same card, so a shopper arriving from a push sees the
 * thing they already know from their order history rather than a second
 * rendering of it that drifts.
 */
export function VendorOrderCard({
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
  const tOrders = useTranslations("shop.orders");
  const format = useFormatter();

  // Root-scoped: the lib modules emit absolute keys (`shop.status.…`).
  const tKey = useTranslations();
  const fulfillment = fulfillmentChip(order.fulfillmentStatus);
  const confirmedAt = order.completion?.confirmedAt ?? null;

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
      flash(tOrders("orderCancelled"));
      onChanged();
    } catch (err) {
      // The vendor's cancellation policy and the paid-order rule both refuse
      // here with a specific reason. Showing that reason is the whole point —
      // "something went wrong" would leave the customer retrying a button that
      // can never succeed.
      flashError(translateError(t, err, tOrders("cancelFailed")));
    } finally {
      setBusy(false);
      setConfirmCancel(false);
    }
  }, [order.id, flash, flashError, onChanged, t, tOrders]);

  const onConfirm = useCallback(async () => {
    setBusy(true);
    try {
      await confirmDelivery(order.id);
      flash(tOrders("deliveryConfirmed"));
      onChanged();
    } catch (err) {
      flashError(translateError(t, err, tOrders("confirmFailed")));
    } finally {
      setBusy(false);
    }
  }, [order.id, flash, flashError, onChanged, t, tOrders]);

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
            {order.store.name ?? tOrders("seller")}
          </Link>
        ) : (
          <span style={{ fontWeight: 800, fontSize: 14.5, color: "var(--text-strong)" }}>
            {order.store?.name ?? tOrders("seller")}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <Badge size="sm" productType={order.orderType}>
          {tKey(`shop.ds.productType.${order.orderType}`)}
        </Badge>
      </div>
      <div className="muted" style={{ fontSize: 12, marginBottom: 10 }}>
        {order.orderNumber}
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        <Badge size="sm" tone={fulfillment.tone} icon={fulfillment.icon}>
          {tKey(fulfillment.labelKey)}
        </Badge>
        <Badge size="sm" tone={payment.tone} icon={payment.icon}>
          {tKey(payment.labelKey)}
        </Badge>
        {cod && (
          <Badge size="sm" tone="neutral" icon="banknote">
            {tOrders("cashOnDelivery")}
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
                    {tKey("shop.ds.freeDelivery")}
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
              label={tOrders("breakdown.items")}
              value={formatMoney(order.priceBreakdown.base, order.currency)}
            />
            {order.orderType === "physical" && (
              <BreakdownRow
                label={tOrders("breakdown.delivery")}
                value={
                  <span style={{ color: "var(--success)", fontWeight: 700 }}>
                    {tOrders("breakdown.included")}
                  </span>
                }
              />
            )}
            {order.priceBreakdown.discount > 0 && (
              <BreakdownRow
                label={tOrders("breakdown.discount")}
                value={tOrders("breakdown.discountAmount", {
                  amount: formatMoney(order.priceBreakdown.discount, order.currency),
                })}
              />
            )}
            {order.priceBreakdown.tax > 0 && (
              <BreakdownRow
                label={tOrders("breakdown.tax")}
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
          <span>{tOrders("breakdown.total")}</span>
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {formatMoney(order.total, order.currency)}
          </span>
        </div>
      </div>

      {/* Parcels. Physical orders only — a digital order has nothing to ship. */}
      {order.orderType === "physical" && (
        <Shipments
          orderId={order.id}
          isCod={cod}
          // Where this order is going, for the live map's second pin. It belongs
          // to the order, not the parcel — the shipment read has no address of
          // any kind — so it has to come from here.
          deliveryAddress={order.deliveryAddress}
          onChanged={onChanged}
        />
      )}

      {collections.map((c) => (
        <DeliveryCodeCard
          key={c.shipmentId}
          orderId={order.id}
          collection={c}
          onResent={onChanged}
        />
      ))}

      {/*
          Once the order is completed, say so where the button was.

          Not merely hiding it: a customer who confirms and watches the button
          vanish has no evidence the click landed, and confirmation is the act
          that starts the seller's payout — the one moment in an order where
          "did that work?" deserves an answer that survives a reload. The date
          comes from the server's own `completion`, so it is the same fact the
          escrow window is counted from.

          `auto` rather than `confirmedBy` decides the wording: COD completes as
          'customer' when the *agent* enters the delivery code, so `confirmedBy`
          would have us tell a shopper they confirmed something they never
          tapped. `auto` only ever means the window elapsed. */}
      {confirmedAt && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 7,
            marginTop: 12,
            paddingTop: 10,
            borderTop: "1px solid var(--border-subtle)",
            fontSize: 12.5,
            color: "var(--text-muted)",
          }}
        >
          <Icon
            name="circle-check-big"
            size={14}
            style={{ color: "var(--success)", flexShrink: 0 }}
          />
          <span>
            {tOrders(order.completion?.auto ? "confirmedAutoOn" : "confirmedOn", {
              date: format.dateTime(new Date(confirmedAt), {
                day: "numeric",
                month: "long",
                year: "numeric",
              }),
            })}
          </span>
        </div>
      )}

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
              {tOrders("confirmDelivery")}
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
              {tOrders("cancelOrder")}
            </Button>
          )}
        </div>
      )}

      {/* Cancelling cannot be undone from here — there is no un-cancel, only
          ordering again at whatever the price and stock are then. And the
          button sits beside "Confirm delivery", which is the opposite answer. */}
      <ConfirmDialog
        open={confirmCancel}
        title={tOrders("cancelTitle")}
        tone="danger"
        icon="circle-x"
        confirmLabel={tOrders("cancelOrder")}
        cancelLabel={tOrders("keepIt")}
        busy={busy}
        onConfirm={() => void onCancel()}
        onCancel={() => setConfirmCancel(false)}
      >
        {tOrders("cancelBody", { store: order.store?.name ?? tOrders("theSeller") })}
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

/**
 * The five words a customer is shown, and nothing from the dispatch machinery.
 *
 * These are the *shipment* vocabulary — a different enum from the order
 * fulfilment statuses Phase 1 put in `shop.status`, and deliberately worded
 * for a parcel rather than an order.
 */
const SHIPMENT_LABEL: Record<
  CustomerShipmentStatus,
  { labelKey: string; icon: IconName; tone: StatusChip["tone"] }
> = {
  preparing: {
    labelKey: "shop.orders.shipmentStatus.preparing",
    icon: "package",
    tone: "neutral",
  },
  shipped: { labelKey: "shop.orders.shipmentStatus.shipped", icon: "truck", tone: "brand" },
  out_for_delivery: {
    labelKey: "shop.orders.shipmentStatus.out_for_delivery",
    icon: "map-pin",
    tone: "brand",
  },
  delivered: {
    labelKey: "shop.orders.shipmentStatus.delivered",
    icon: "circle-check-big",
    tone: "success",
  },
  delivery_failed: {
    labelKey: "shop.orders.shipmentStatus.delivery_failed",
    icon: "triangle-alert",
    tone: "danger",
  },
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
export function Shipments({
  orderId,
  isCod: cod,
  deliveryAddress,
  onChanged,
  whenEmpty = null,
}: {
  orderId: string;
  isCod: boolean;
  deliveryAddress?: unknown;
  onChanged: () => void;
  /**
   * What to draw when the order has no parcels yet.
   *
   * `null` inside an order card, which is the right answer there: the card has
   * plenty else on it and a "no parcels" line under a receipt is noise. The
   * tracking page is nothing but this component, so a `null` there is a blank
   * screen — it passes an explanation instead.
   */
  whenEmpty?: React.ReactNode;
}) {
  const [shipments, setShipments] = useState<CustomerShipment[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { flash, flashError } = useToast();
  const t = useTranslations("errors");
  const tOrders = useTranslations("shop.orders");
  // Root-scoped: `SHIPMENT_LABEL` emits absolute keys, as the lib modules do.
  const tKey = useTranslations();
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
        flash(tOrders("deliveryConfirmed"));
        load();
        onChanged();
      } catch (err) {
        flashError(translateError(t, err, tOrders("confirmParcelFailed")));
      } finally {
        setBusy(null);
      }
    },
    [orderId, flash, flashError, load, onChanged, t, tOrders]
  );

  // `null` while the read is still in flight either way: a flash of "no parcels"
  // before the list lands reads as an answer, and it is not one yet.
  if (!shipments) return null;
  if (shipments.length === 0) return <>{whenEmpty}</>;

  return (
    <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--border-subtle)" }}>
      <p className="ds-overline" style={{ marginBottom: 8 }}>
        {tOrders("parcelCount", { n: shipments.length })}
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
                {tKey(view.labelKey)}
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

            {/* Live position, once the carrying agent is disclosed. The panel
                asks jovi-mall who this customer may watch before it opens a
                socket, and renders nothing when the answer is nobody — which is
                the resting state, and is expected for a while after an order
                ships because a grant is not pushed. */}
            <DeliveryTracking
              shipmentId={shipment.id}
              hasAgent={Boolean(shipment.agent)}
              deliveryAddress={deliveryAddress}
              agentName={shipment.agent?.displayName}
            />

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
                    <span style={{ fontWeight: 600 }}>
                      {tKey(SHIPMENT_LABEL[step.status].labelKey)}
                    </span>
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
                {tOrders("failedAttempts", { n: shipment.failedAttempts })}
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
                  label={tOrders("thisDelivery")}
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
                  {tOrders("receivedParcel")}
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
  const t = useTranslations("shop.orders.carrier");
  const name = agency?.name || agencyName || null;
  const contacts = [
    agency?.supportPhone && { icon: "phone", key: "call", href: `tel:${agency.supportPhone}` },
    agency?.supportWhatsapp && {
      icon: "message-circle",
      key: "whatsapp",
      href: `https://wa.me/${agency.supportWhatsapp.replace(/D/g, "")}`,
    },
    agency?.supportEmail && { icon: "mail", key: "email", href: `mailto:${agency.supportEmail}` },
  ].filter(Boolean) as { icon: IconName; key: string; href: string }[];

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
              {t("company")}
            </p>
          </div>
          {contacts.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginLeft: "auto" }}>
              {contacts.map((c) => (
                <a
                  key={c.icon}
                  href={c.href}
                  aria-label={t(c.key, { name })}
                  title={t(c.key, { name })}
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
              {t("carrying")}
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
  const tCod = useTranslations("shop.orders.cod");

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
      flash(tCod("newCode"));
      onResent();
    } catch (err) {
      // Regeneration is capped at one per 60 s. Telling someone to wait 43
      // seconds is actionable; "too many requests" is not.
      if (err instanceof ApiError && err.code === "COD_CODE_RESEND_TOO_SOON") {
        /*
           From the header, not from `details`.

           The service raises this with `{ retryInSeconds }`, but a 429 is in the
           `rate_limit` category, whose `details` is filtered to
           `retryAfterSeconds` / `limit` / `windowSeconds` — and "in" is not
           "after", so nothing survives and `details` is omitted entirely. The
           old read here therefore always fell through to its default and told
           every customer to wait exactly 60 seconds, whatever the server
           thought. `Retry-After` is the channel that carries it; 60 stays as the
           last resort, since it is the documented cap. */
        const retry = err.retryAfterSeconds ?? 60;
        setCooldown(retry);
        flashError(tCod("waitBeforeResend", { seconds: retry }));
      } else {
        flashError(translateError(t, err, tCod("resendFailed")));
      }
    } finally {
      setBusy(false);
    }
  }, [orderId, collection.shipmentId, flash, flashError, onResent, t, tCod]);

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
          {tCod("payInCash", {
            amount: formatMoney(collection.expectedAmount, collection.currency),
          })}
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
          {tCod.rich("warning", { strong: (chunks) => <strong>{chunks}</strong> })}
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
          {cooldown > 0 ? tCod("waitSeconds", { seconds: cooldown }) : tCod("sendNewCode")}
        </Button>
      </div>
    </div>
  );
}
