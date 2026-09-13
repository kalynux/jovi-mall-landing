/**
 * Presentation rules for order state.
 *
 * Kept out of the components because the same judgements are needed in two
 * places (the list and the detail) and getting one of them wrong is a
 * correctness bug, not a styling one — offering "confirm delivery" on a
 * cash-on-delivery shipment, or a cancel button on a paid order, sends the
 * customer into a guaranteed 422.
 */
import type { IconName } from "@/components/shop/ds";
import type {
  CustomerOrder,
  FulfillmentStatus,
  GroupPaymentStatus,
  OrderGroup,
  OrderPaymentStatus,
} from "./customer.types";

type Tone = "brand" | "neutral" | "success" | "warning" | "danger" | "info";

export interface StatusChip {
  /**
   * A full dotted message key — `shop.status.fulfillment.shipped` — never a
   * sentence.
   *
   * This module is not a React component, so it cannot call `useTranslations`:
   * hooks only run inside a render, and the maps below are module-level
   * constants evaluated once at import. Emitting the key and letting the
   * component translate it is the only shape that works, and it is the rule for
   * every non-React module in the shop tree — see LOCALISATION.md.
   *
   * Consume it with a ROOT-scoped translator, because the key is absolute:
   *
   *     const t = useTranslations();       // no namespace
   *     t(fulfillmentChip(status).labelKey)
   */
  labelKey: string;
  tone: Tone;
  /**
   * ⚠ `IconName`, not `string` — a type-only import from the design system, so
   * nothing is pulled into the bundle.
   *
   * This file is where the second batch of silent-dot icons lived: `undo-2` on
   * Returned and Refunded, `circle-dot` on Mixed and Unknown. Every order list
   * and every order detail draws these chips, so a name that is not in the
   * registry is a dot on a status the customer is trying to read. Typing it
   * here is what makes that a build failure.
   */
  icon: IconName;
}

const FULFILLMENT: Record<FulfillmentStatus, StatusChip> = {
  pending: { labelKey: "shop.status.fulfillment.pending", tone: "neutral", icon: "clock" },
  processing: { labelKey: "shop.status.fulfillment.processing", tone: "info", icon: "package" },
  partially_shipped: { labelKey: "shop.status.fulfillment.partially_shipped", tone: "info", icon: "truck" },
  shipped: { labelKey: "shop.status.fulfillment.shipped", tone: "info", icon: "truck" },
  partially_delivered: { labelKey: "shop.status.fulfillment.partially_delivered", tone: "info", icon: "package-check" },
  delivered: { labelKey: "shop.status.fulfillment.delivered", tone: "success", icon: "package-check" },
  fulfilled: { labelKey: "shop.status.fulfillment.fulfilled", tone: "success", icon: "circle-check-big" },
  cancelled: { labelKey: "shop.status.fulfillment.cancelled", tone: "danger", icon: "circle-x" },
  returned: { labelKey: "shop.status.fulfillment.returned", tone: "warning", icon: "undo-2" },
};

/**
 * Per-order payment state. Note `AWAITING_PAYMENT` is upper-case on the wire
 * while every sibling value is lower-case — that is the backend's enum, not a
 * typo here.
 */
const PAYMENT: Record<OrderPaymentStatus, StatusChip> = {
  pending: { labelKey: "shop.status.payment.pending", tone: "warning", icon: "clock" },
  AWAITING_PAYMENT: { labelKey: "shop.status.payment.AWAITING_PAYMENT", tone: "warning", icon: "clock" },
  partially_paid: { labelKey: "shop.status.payment.partially_paid", tone: "warning", icon: "wallet" },
  paid: { labelKey: "shop.status.payment.paid", tone: "success", icon: "circle-check-big" },
  disputed: { labelKey: "shop.status.payment.disputed", tone: "danger", icon: "circle-alert" },
  failed: { labelKey: "shop.status.payment.failed", tone: "danger", icon: "circle-x" },
  refunded: { labelKey: "shop.status.payment.refunded", tone: "neutral", icon: "undo-2" },
};

/**
 * Group-level aggregate — a different, lower-case set from the per-order one.
 *
 * All eight members the server's `aggregatePaymentStatus` can return are here.
 * Four of them were missing and fell through to `UNKNOWN`, so a fully refunded
 * group told the customer "Unknown" — the worst available answer to "what
 * happened to my money", and one this map was in a position to answer exactly.
 */
const GROUP_PAYMENT: Record<GroupPaymentStatus, StatusChip> = {
  paid: { labelKey: "shop.status.groupPayment.paid", tone: "success", icon: "circle-check-big" },
  awaiting_payment: { labelKey: "shop.status.groupPayment.awaiting_payment", tone: "warning", icon: "clock" },
  partially_paid: { labelKey: "shop.status.groupPayment.partially_paid", tone: "warning", icon: "wallet" },
  mixed: { labelKey: "shop.status.groupPayment.mixed", tone: "neutral", icon: "circle-dot" },
  refunded: { labelKey: "shop.status.groupPayment.refunded", tone: "neutral", icon: "undo-2" },
  failed: { labelKey: "shop.status.groupPayment.failed", tone: "danger", icon: "circle-x" },
  disputed: { labelKey: "shop.status.groupPayment.disputed", tone: "danger", icon: "circle-alert" },
  unknown: { labelKey: "shop.status.groupPayment.unknown", tone: "neutral", icon: "circle-dot" },
};

const UNKNOWN: StatusChip = { labelKey: "shop.status.unknown", tone: "neutral", icon: "circle-dot" };

export const fulfillmentChip = (s: FulfillmentStatus): StatusChip => FULFILLMENT[s] ?? UNKNOWN;
export const paymentChip = (s: OrderPaymentStatus): StatusChip => PAYMENT[s] ?? UNKNOWN;
export const groupPaymentChip = (s: GroupPaymentStatus): StatusChip => GROUP_PAYMENT[s] ?? UNKNOWN;

export const isCod = (order: CustomerOrder): boolean =>
  order.paymentMethod === "cash_on_delivery";

/**
 * The orders in a group that a payment would actually cover.
 *
 * Mirrors the `payable` filter in `payment-orchestrator.initiatePaymentForCart`
 * exactly — `AWAITING_PAYMENT` or `pending`, nothing else. Two consequences
 * worth knowing:
 *
 *   - **A cancelled order is excluded for free.** `cancelOrder` moves an unpaid
 *     order to `failed`, so it drops out of this filter without the storefront
 *     having to reason about fulfilment state at all.
 *   - **A failed *payment* does not.** Nothing on the gateway path writes
 *     `failed` to the order; only cancellation does. So a declined mobile-money
 *     prompt leaves the order right here, payable, which is what makes retrying
 *     possible in the first place.
 */
export const payableOrders = (group: OrderGroup): CustomerOrder[] =>
  group.orders.filter(
    (o) => o.paymentStatus === "AWAITING_PAYMENT" || o.paymentStatus === "pending",
  );

/**
 * What paying this group would cost — the sum of the payable orders, not the
 * group's own `totalAmount`.
 *
 * The server charges `payable.reduce(...)`, so on a group where one vendor's
 * order was cancelled the two numbers differ, and `totalAmount` would be a
 * button that promises one figure and takes another.
 */
export const payableTotal = (group: OrderGroup): number =>
  payableOrders(group).reduce((sum, o) => sum + o.total, 0);

/**
 * Whether to offer "pay for this order".
 *
 * Same discipline as `canCancel`: mirror the server's gate so the button is
 * never shown into a guaranteed failure. Both refusals below are ones the
 * orchestrator makes for the whole group at once —
 *
 *   - any COD order in the group → `422 PAYMENT_ORDER_IS_COD`. The payment
 *     method is chosen for the whole checkout, and cash is settled at handoff.
 *   - nothing payable left → `409 PAYMENT_CART_NO_PAYABLE_ORDERS`.
 *
 * Note the COD test runs over *every* order rather than the payable ones, which
 * is what the server does — a group is COD or it is not.
 */
export function canPayGroup(group: OrderGroup): boolean {
  if (group.orders.some(isCod)) return false;
  return payableOrders(group).length > 0;
}

/**
 * Whether to offer the customer-facing cancel action.
 *
 * Mirrors the server's gate so the button is not shown into a 422: pre-shipment
 * only, and unpaid only. A *paid* order needs the vendor refund flow instead —
 * this endpoint performs no refund. The vendor's own cancellation policy can
 * still refuse, which is why the failure is surfaced rather than swallowed.
 */
export function canCancel(order: CustomerOrder): boolean {
  const preShipment =
    order.fulfillmentStatus === "pending" || order.fulfillmentStatus === "processing";
  const unpaid =
    order.paymentStatus === "pending" || order.paymentStatus === "AWAITING_PAYMENT";
  return preShipment && unpaid;
}

/**
 * Has this order already been confirmed?
 *
 * `completion.confirmedAt` is the server's own escrow-release gate, and it is the
 * only field that answers this — see `OrderCompletion`. A backend older than that
 * field sends nothing, which reads here as "not confirmed": the previous
 * behaviour, unchanged, rather than a crash.
 */
export const isCompleted = (order: CustomerOrder): boolean =>
  Boolean(order.completion?.confirmedAt);

/**
 * Whether to offer "confirm delivery".
 *
 * **Never for cash on delivery.** There the delivery code is what records the
 * payment and marks the shipment delivered, in one step; calling the confirm
 * endpoint returns `422 SHIPMENT_CONFIRMATION_NOT_ALLOWED`. Show the code
 * instead.
 *
 * 🔴 **Never once the order is completed** — and completion is invisible in
 * `fulfillmentStatus`, which is why this was wrong for so long. Confirming stamps
 * `completion.confirmed_at` and leaves fulfilment untouched, so the reload that
 * follows a successful confirm returns a body identical to the one before it and
 * the button came straight back, pointing at a guaranteed
 * `409 EARNINGS_ALREADY_COMPLETED`. The customer had already done the one thing
 * the button asks for and was still being asked.
 *
 * Otherwise it is the digital path: a `fulfilled` order is confirmable, while a
 * physical order completes automatically once its last shipment is confirmed.
 */
export function canConfirmDelivery(order: CustomerOrder): boolean {
  if (isCod(order)) return false;
  if (isCompleted(order)) return false;
  return order.fulfillmentStatus === "fulfilled";
}

/** A COD collection whose code is still live — the only state that shows one. */
export const pendingCollections = (order: CustomerOrder) =>
  (order.codCollections ?? []).filter((c) => c.status === "pending");
