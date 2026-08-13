/**
 * Presentation rules for order state.
 *
 * Kept out of the components because the same judgements are needed in two
 * places (the list and the detail) and getting one of them wrong is a
 * correctness bug, not a styling one — offering "confirm delivery" on a
 * cash-on-delivery shipment, or a cancel button on a paid order, sends the
 * customer into a guaranteed 422.
 */
import type {
  CustomerOrder,
  FulfillmentStatus,
  GroupPaymentStatus,
  OrderPaymentStatus,
} from "./customer.types";

type Tone = "brand" | "neutral" | "success" | "warning" | "danger" | "info";

export interface StatusChip {
  label: string;
  tone: Tone;
  icon: string;
}

const FULFILLMENT: Record<FulfillmentStatus, StatusChip> = {
  pending: { label: "Pending", tone: "neutral", icon: "clock" },
  processing: { label: "Being prepared", tone: "info", icon: "package" },
  partially_shipped: { label: "Partly shipped", tone: "info", icon: "truck" },
  shipped: { label: "Shipped", tone: "info", icon: "truck" },
  partially_delivered: { label: "Partly delivered", tone: "info", icon: "package-check" },
  delivered: { label: "Delivered", tone: "success", icon: "package-check" },
  fulfilled: { label: "Delivered", tone: "success", icon: "circle-check-big" },
  cancelled: { label: "Cancelled", tone: "danger", icon: "circle-x" },
  returned: { label: "Returned", tone: "warning", icon: "undo-2" },
};

/**
 * Per-order payment state. Note `AWAITING_PAYMENT` is upper-case on the wire
 * while every sibling value is lower-case — that is the backend's enum, not a
 * typo here.
 */
const PAYMENT: Record<OrderPaymentStatus, StatusChip> = {
  pending: { label: "Payment pending", tone: "warning", icon: "clock" },
  AWAITING_PAYMENT: { label: "Awaiting payment", tone: "warning", icon: "clock" },
  partially_paid: { label: "Partly paid", tone: "warning", icon: "wallet" },
  paid: { label: "Paid", tone: "success", icon: "circle-check-big" },
  disputed: { label: "Disputed", tone: "danger", icon: "circle-alert" },
  failed: { label: "Payment failed", tone: "danger", icon: "circle-x" },
  refunded: { label: "Refunded", tone: "neutral", icon: "undo-2" },
};

/** Group-level aggregate — a different, lower-case set from the per-order one. */
const GROUP_PAYMENT: Record<GroupPaymentStatus, StatusChip> = {
  paid: { label: "Paid", tone: "success", icon: "circle-check-big" },
  awaiting_payment: { label: "Awaiting payment", tone: "warning", icon: "clock" },
  partially_paid: { label: "Partly paid", tone: "warning", icon: "wallet" },
  mixed: { label: "Mixed", tone: "neutral", icon: "circle-dot" },
};

const UNKNOWN: StatusChip = { label: "Unknown", tone: "neutral", icon: "circle-dot" };

export const fulfillmentChip = (s: FulfillmentStatus): StatusChip => FULFILLMENT[s] ?? UNKNOWN;
export const paymentChip = (s: OrderPaymentStatus): StatusChip => PAYMENT[s] ?? UNKNOWN;
export const groupPaymentChip = (s: GroupPaymentStatus): StatusChip => GROUP_PAYMENT[s] ?? UNKNOWN;

export const isCod = (order: CustomerOrder): boolean =>
  order.paymentMethod === "cash_on_delivery";

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
 * Whether to offer "confirm delivery".
 *
 * **Never for cash on delivery.** There the delivery code is what records the
 * payment and marks the shipment delivered, in one step; calling the confirm
 * endpoint returns `422 SHIPMENT_CONFIRMATION_NOT_ALLOWED`. Show the code
 * instead.
 *
 * Otherwise it is the digital path: a `fulfilled` order is confirmable, while a
 * physical order completes automatically once its last shipment is confirmed.
 */
export function canConfirmDelivery(order: CustomerOrder): boolean {
  if (isCod(order)) return false;
  return order.fulfillmentStatus === "fulfilled";
}

/** A COD collection whose code is still live — the only state that shows one. */
export const pendingCollections = (order: CustomerOrder) =>
  (order.codCollections ?? []).filter((c) => c.status === "pending");
