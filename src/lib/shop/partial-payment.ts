/**
 * Part online now, the rest in cash at the door (backend 2026-11-01,
 * `api-doc/customer/FRONTEND-CHANGELOG-partial-payment.md`).
 *
 * ── It is a cash-on-delivery order with a prepaid part ───────────────────────
 *
 * `paymentMethod` reads `cash_on_delivery` on a partial order, so `partialPayment`
 * is the only thing that tells the two apart. Delivery codes and "no confirm
 * button on the parcel" stay exactly as cash on delivery, which is why `isCod`
 * keeps answering yes; what changes is anything that says how the order is PAID.
 * An order with `paidAt: null` owes money now, and "pay on delivery" is the one
 * thing it must never be labelled.
 *
 * ── Off until a vendor opts in ───────────────────────────────────────────────
 *
 * Every helper gates on the field being there and saying yes. An older API, and
 * every shop that never switched this on, reads as "nothing to offer" — so no
 * other checkout changes, and a shopper who never chose it is never told it is
 * unavailable. That sentence is only for someone it was just taken away from.
 *
 * Pure on purpose — no JSX, no `ApiError` import — so `npm test` can load it.
 */
import type {
  CartQuote,
  CustomerOrder,
  OrderGroup,
  PartialPaymentReason,
} from "./customer.types";

/** `unknown`: the rules could not be checked, or a reason this build predates. */
export type PartialRefusalReason = PartialPaymentReason | "unknown";

export interface PartialLimits {
  minimumAmount: number;
  maximumAmount: number;
  /** The basket priced as a partial order: what the amount is a part of. */
  total: number;
}

const KNOWN_REASONS: ReadonlySet<string> = new Set<PartialPaymentReason>([
  "digital_items",
  "customer_restricted",
  "vendor_not_accepted",
  "agency_not_supported",
  "order_amount_exceeds_limit",
  "order_too_small",
  "below_delivery_minimum",
]);

/** Checkout answers with a cash-on-delivery code when an agency or the account is what refuses. */
const REASON_BY_COD_CODE: Record<string, PartialPaymentReason> = {
  COD_AGENCY_NOT_SUPPORTED: "agency_not_supported",
  COD_ORDER_AMOUNT_EXCEEDS_LIMIT: "order_amount_exceeds_limit",
  COD_CUSTOMER_RESTRICTED: "customer_restricted",
};

const foldReason = (reason: unknown): PartialRefusalReason =>
  typeof reason === "string" && KNOWN_REASONS.has(reason) ? (reason as PartialPaymentReason) : "unknown";

const errorParts = (error: unknown): { code?: unknown; details?: unknown } =>
  error && typeof error === "object" ? (error as { code?: unknown; details?: unknown }) : {};

/** What the quote offers, or `null` while there is nothing to offer. */
export function partialOfferOf(quote: Pick<CartQuote, "partialPayment"> | null | undefined): PartialLimits | null {
  const verdict = quote?.partialPayment;
  if (verdict?.available !== true) return null;
  const { minimumAmount, maximumAmount, total } = verdict;
  if (!(minimumAmount > 0) || minimumAmount > maximumAmount) return null;
  return { minimumAmount, maximumAmount, total };
}

/** The quote's reason for not offering it, or `null` when it offers it or says nothing. */
export function partialRefusalOf(quote: Pick<CartQuote, "partialPayment"> | null | undefined): PartialRefusalReason | null {
  const verdict = quote?.partialPayment;
  if (!verdict || verdict.available !== false) return null;
  return foldReason(verdict.reason);
}

/**
 * A checkout refused as a partial order, or `null` for any other error. Nothing
 * was created: the basket is intact and the shopper chooses again.
 */
export function partialRefusalFromError(error: unknown): PartialRefusalReason | null {
  const { code, details } = errorParts(error);
  if (code === "PARTIAL_PAYMENT_NOT_AVAILABLE") {
    return foldReason((details as { reason?: unknown } | null | undefined)?.reason);
  }
  return typeof code === "string" ? (REASON_BY_COD_CODE[code] ?? null) : null;
}

/** The field's text as a chargeable amount, or `null`. Whole units: `amount` is an integer. */
export function parsePartialAmount(
  input: string,
  limits: Pick<PartialLimits, "minimumAmount" | "maximumAmount">,
): number | null {
  const text = input.replace(/[\s  ]/g, "");
  if (!/^\d+$/.test(text)) return null;
  const amount = Number(text);
  return amount >= limits.minimumAmount && amount <= limits.maximumAmount ? amount : null;
}

/**
 * The one limit what is typed breaks, or `null` while it can be charged.
 *
 * Only one side at a time, so the field names the figure to move towards
 * rather than the whole range. An empty or non-numeric entry is "below the
 * minimum": there is nothing to pay yet, and the minimum is what to type.
 */
export function partialAmountBreach(
  input: string,
  limits: Pick<PartialLimits, "minimumAmount" | "maximumAmount">,
): { bound: "min" | "max"; value: number } | null {
  if (parsePartialAmount(input, limits) !== null) return null;
  const text = input.replace(/[\s  ]/g, "");
  if (/^\d+$/.test(text) && Number(text) > limits.maximumAmount) {
    return { bound: "max", value: limits.maximumAmount };
  }
  return { bound: "min", value: limits.minimumAmount };
}

/** The online part went through. On `initiate` this is good news, never a refusal. */
export const isAlreadyPaid = (error: unknown): boolean =>
  errorParts(error).code === "PAYMENT_ORDER_ALREADY_PAID";

/**
 * The limits a refused amount carries, for saying what would pass.
 *
 * `requested` is the amount the server refused, when it says so, which tells
 * the caller which one of the two limits to name.
 */
export function refusedAmountLimits(
  error: unknown,
): { minimum: number; maximum: number; requested: number | null } | null {
  const { code, details } = errorParts(error);
  if (code !== "PARTIAL_PAYMENT_AMOUNT_OUT_OF_RANGE" && code !== "PARTIAL_PAYMENT_AMOUNT_REQUIRED") return null;
  const { minimum, maximum, requested } = (details ?? {}) as {
    minimum?: unknown;
    maximum?: unknown;
    requested?: unknown;
  };
  return typeof minimum === "number" && typeof maximum === "number"
    ? { minimum, maximum, requested: typeof requested === "number" ? requested : null }
    : null;
}

/**
 * This order's online part is owed now.
 *
 * Mirrors the `prepaying` filter in `initiatePaymentForCart`: a cancelled order
 * still reads `paidAt: null`, and it owes nothing. Works on a list row, which
 * carries only `{ paidAt }`.
 */
export const owesOnlinePart = (order: Pick<CustomerOrder, "partialPayment" | "fulfillmentStatus">): boolean =>
  Boolean(order.partialPayment) && !order.partialPayment?.paidAt && order.fulfillmentStatus !== "cancelled";

export const paidOnlinePart = (order: Pick<CustomerOrder, "partialPayment">): boolean =>
  Boolean(order.partialPayment?.paidAt);

/** The orders a charge would cover. Empty on every group that is not partial. */
export const ordersOwingOnline = (group: Pick<OrderGroup, "orders">): CustomerOrder[] =>
  group.orders.filter(owesOnlinePart);

/**
 * One amount covers the whole checkout, and its limits are the orders' own added
 * up: `groupPrepaymentLimitsOf` on the server. Read from the group and single
 * reads; a list row does not carry them.
 */
export function partialLimitsOfOrders(orders: readonly CustomerOrder[]): PartialLimits {
  return orders.reduce<PartialLimits>(
    (sum, o) => ({
      minimumAmount: sum.minimumAmount + (o.partialPayment?.minimumAmount ?? 0),
      maximumAmount: sum.maximumAmount + (o.partialPayment?.maximumAmount ?? 0),
      total: sum.total + o.total,
    }),
    { minimumAmount: 0, maximumAmount: 0, total: 0 },
  );
}

export type PartialCash = { kind: "due" | "collected"; amount: number };

/**
 * The order's cash, once its online part is paid.
 *
 * `balanceDue` stays `total − paid online` for the order's whole life, so it is
 * not "still due" by itself. A parcel already collected comes off it (an order
 * can ride with several delivery companies), everything collected reads as paid,
 * and an order that came back or was refunded has no cash to ask for.
 */
export function partialCashOf(
  order: Pick<CustomerOrder, "partialPayment" | "paymentStatus" | "fulfillmentStatus" | "codCollections">,
): PartialCash | null {
  const partial = order.partialPayment;
  if (!partial?.paidAt || typeof partial.balanceDue !== "number") return null;
  if (order.paymentStatus === "paid") return { kind: "collected", amount: partial.balanceDue };
  if (order.paymentStatus === "refunded" || order.paymentStatus === "failed") return null;
  if (order.fulfillmentStatus === "cancelled" || order.fulfillmentStatus === "returned") return null;
  const collected = (order.codCollections ?? [])
    .filter((c) => c.status === "collected")
    .reduce((sum, c) => sum + c.expectedAmount, 0);
  return { kind: "due", amount: Math.max(0, partial.balanceDue - collected) };
}
