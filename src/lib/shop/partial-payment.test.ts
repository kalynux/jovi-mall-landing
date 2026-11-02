import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isAlreadyPaid,
  ordersOwingOnline,
  owesOnlinePart,
  paidOnlinePart,
  parsePartialAmount,
  partialCashOf,
  partialLimitsOfOrders,
  partialOfferOf,
  partialRefusalFromError,
  partialRefusalOf,
  refusedAmountLimits,
} from "./partial-payment";
import { canCancel, canConfirmDelivery, canPayGroup, isCod } from "./order-status";
import type { CustomerOrder, OrderGroup, PartialPaymentQuote } from "./customer.types";

const offer = (over: Partial<PartialPaymentQuote> = {}): { partialPayment: PartialPaymentQuote } => ({
  partialPayment: {
    available: true,
    reason: null,
    vendorIds: [],
    minimumAmount: 6000,
    maximumAmount: 18000,
    total: 20000,
    ...over,
  },
});

const refused = (reason: string | null) =>
  offer({ available: false, reason, minimumAmount: 0, maximumAmount: 0, total: 0 });

const order = (over: Partial<CustomerOrder> = {}): CustomerOrder => ({
  id: "o1",
  orderNumber: "ORD-1",
  vendorId: "v1",
  orderType: "physical",
  total: 20000,
  currency: "XAF",
  paymentMethod: "cash_on_delivery",
  paymentStatus: "AWAITING_PAYMENT",
  fulfillmentStatus: "pending",
  partialPayment: { minimumAmount: 6000, maximumAmount: 18000, amountPaidOnline: 0, paidAt: null, balanceDue: 20000 },
  ...over,
});

const paid = (over: Partial<CustomerOrder> = {}): CustomerOrder =>
  order({
    paymentStatus: "partially_paid",
    partialPayment: {
      minimumAmount: 6000,
      maximumAmount: 18000,
      amountPaidOnline: 6000,
      paidAt: "2026-11-01T10:00:00.000Z",
      balanceDue: 14000,
    },
    ...over,
  });

const group = (orders: CustomerOrder[]): OrderGroup => ({
  cartId: "c1",
  createdAt: "2026-11-01T09:00:00.000Z",
  currency: "XAF",
  totalAmount: 20000,
  orderCount: orders.length,
  paymentStatus: "awaiting_payment",
  orders,
});

test("the offer is the quote's, and only while it says yes", () => {
  assert.deepEqual(partialOfferOf(offer()), { minimumAmount: 6000, maximumAmount: 18000, total: 20000 });
  assert.equal(partialOfferOf(refused("vendor_not_accepted")), null);
  // An older API sends no verdict: nothing to offer, nothing to explain.
  assert.equal(partialOfferOf({}), null);
  assert.equal(partialOfferOf(null), null);
  assert.equal(partialRefusalOf({}), null);
  // Limits with nothing between them cannot be paid, whatever `available` says.
  assert.equal(partialOfferOf(offer({ minimumAmount: 0 })), null);
  assert.equal(partialOfferOf(offer({ minimumAmount: 19000 })), null);
});

test("every documented reason is kept, anything else is unavailable and unknown", () => {
  for (const reason of [
    "digital_items",
    "customer_restricted",
    "vendor_not_accepted",
    "agency_not_supported",
    "order_amount_exceeds_limit",
    "order_too_small",
    "below_delivery_minimum",
  ]) {
    assert.equal(partialRefusalOf(refused(reason)), reason);
  }
  assert.equal(partialRefusalOf(refused("a_reason_from_next_year")), "unknown");
  // `null` with `available: false` means the rules could not be evaluated.
  assert.equal(partialRefusalOf(refused(null)), "unknown");
  assert.equal(partialRefusalOf(offer()), null);
});

test("a refused checkout folds its own code and the cash-on-delivery codes", () => {
  assert.equal(
    partialRefusalFromError({ code: "PARTIAL_PAYMENT_NOT_AVAILABLE", details: { reason: "order_too_small" } }),
    "order_too_small",
  );
  assert.equal(partialRefusalFromError({ code: "PARTIAL_PAYMENT_NOT_AVAILABLE" }), "unknown");
  assert.equal(partialRefusalFromError({ code: "COD_CUSTOMER_RESTRICTED" }), "customer_restricted");
  assert.equal(partialRefusalFromError({ code: "COD_AGENCY_NOT_SUPPORTED" }), "agency_not_supported");
  assert.equal(partialRefusalFromError({ code: "CATALOG_INSUFFICIENT_STOCK" }), null);
  assert.equal(partialRefusalFromError(new Error("network")), null);
  assert.equal(partialRefusalFromError(null), null);
});

test("the amount must be a whole number inside the limits", () => {
  const limits = { minimumAmount: 6000, maximumAmount: 18000 };
  assert.equal(parsePartialAmount("6000", limits), 6000);
  assert.equal(parsePartialAmount("18000", limits), 18000);
  assert.equal(parsePartialAmount("6 000", limits), 6000);
  assert.equal(parsePartialAmount("5999", limits), null);
  assert.equal(parsePartialAmount("18001", limits), null);
  assert.equal(parsePartialAmount("", limits), null);
  assert.equal(parsePartialAmount("6000.50", limits), null);
  assert.equal(parsePartialAmount("-6000", limits), null);
  assert.equal(parsePartialAmount("abc", limits), null);
});

test("the charge's own refusals", () => {
  assert.equal(isAlreadyPaid({ code: "PAYMENT_ORDER_ALREADY_PAID" }), true);
  assert.equal(isAlreadyPaid({ code: "PARTIAL_PAYMENT_AMOUNT_REQUIRED" }), false);
  assert.equal(isAlreadyPaid(new Error("x")), false);
  assert.deepEqual(
    refusedAmountLimits({
      code: "PARTIAL_PAYMENT_AMOUNT_OUT_OF_RANGE",
      details: { minimum: 6000, maximum: 18000, requested: 500 },
    }),
    { minimum: 6000, maximum: 18000 },
  );
  assert.deepEqual(
    refusedAmountLimits({ code: "PARTIAL_PAYMENT_AMOUNT_REQUIRED", details: { minimum: 1, maximum: 2 } }),
    { minimum: 1, maximum: 2 },
  );
  // Details are optional on the way out, and not every refusal has limits.
  assert.equal(refusedAmountLimits({ code: "PARTIAL_PAYMENT_AMOUNT_OUT_OF_RANGE" }), null);
  assert.equal(refusedAmountLimits({ code: "PARTIAL_PAYMENT_NOT_APPLICABLE" }), null);
});

test("an unpaid partial order owes now; a paid or cancelled one does not", () => {
  assert.equal(owesOnlinePart(order()), true);
  // A list row carries only `paidAt`.
  assert.equal(owesOnlinePart({ partialPayment: { paidAt: null }, fulfillmentStatus: "pending" }), true);
  assert.equal(owesOnlinePart(paid()), false);
  assert.equal(owesOnlinePart(order({ fulfillmentStatus: "cancelled" })), false);
  assert.equal(owesOnlinePart(order({ partialPayment: null })), false);
  assert.equal(owesOnlinePart(order({ partialPayment: undefined })), false);
  assert.equal(paidOnlinePart(paid()), true);
  assert.equal(paidOnlinePart(order()), false);
});

test("a checkout's limits are its owing orders' added up", () => {
  const second = order({
    id: "o2",
    total: 10000,
    partialPayment: { minimumAmount: 1000, maximumAmount: 9000, amountPaidOnline: 0, paidAt: null, balanceDue: 10000 },
  });
  const cancelled = order({ id: "o3", fulfillmentStatus: "cancelled" });
  const owing = ordersOwingOnline(group([order(), second, cancelled]));
  assert.deepEqual(owing.map((o) => o.id), ["o1", "o2"]);
  assert.deepEqual(partialLimitsOfOrders(owing), { minimumAmount: 7000, maximumAmount: 27000, total: 30000 });
});

test("a group is payable while its online part is owed, though it reads cash on delivery", () => {
  assert.equal(canPayGroup(group([order()])), true);
  // Paid: the rest is cash, exactly like cash on delivery.
  assert.equal(canPayGroup(group([paid()])), false);
  // The plain rules are untouched.
  assert.equal(canPayGroup(group([order({ partialPayment: null })])), false);
  assert.equal(canPayGroup(group([order({ partialPayment: null, paymentMethod: "online" })])), true);
});

test("cancelling: an unpaid partial order may, a paid one never", () => {
  assert.equal(canCancel(order()), true);
  assert.equal(canCancel(paid()), false);
  // Even if a status read lags behind the payment.
  assert.equal(canCancel(paid({ paymentStatus: "AWAITING_PAYMENT" })), false);
});

test("it stays cash on delivery for the parcel: a delivery code, no confirm button", () => {
  assert.equal(isCod(paid()), true);
  assert.equal(canConfirmDelivery(paid({ fulfillmentStatus: "fulfilled" })), false);
});

test("the cash: what is left, what was collected, and nothing once it came back", () => {
  assert.deepEqual(partialCashOf(paid()), { kind: "due", amount: 14000 });
  assert.equal(partialCashOf(order()), null);
  assert.equal(partialCashOf(order({ partialPayment: null })), null);
  assert.deepEqual(partialCashOf(paid({ paymentStatus: "paid" })), { kind: "collected", amount: 14000 });
  assert.equal(partialCashOf(paid({ paymentStatus: "refunded" })), null);
  assert.equal(partialCashOf(paid({ fulfillmentStatus: "returned" })), null);

  const collection = (status: "pending" | "collected" | "cancelled", expectedAmount: number) => ({
    shipmentId: `s-${status}`,
    expectedAmount,
    currency: "XAF",
    status,
    collectedAt: null,
  });
  // One of two parcels collected: only the other is still owed.
  assert.deepEqual(
    partialCashOf(paid({ codCollections: [collection("collected", 9000), collection("pending", 5000)] })),
    { kind: "due", amount: 5000 },
  );
});
