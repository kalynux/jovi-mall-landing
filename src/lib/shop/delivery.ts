/**
 * Customer-paid delivery (ADR-A11, 2026-10-04) — the few rules the screens share.
 *
 * Until ADR-A11 every shop paid delivery, so the storefront could say "Delivery
 * included" everywhere. Now free delivery is the shop's setting (`always`,
 * `never`, `above` an amount of its own items), and where the customer pays,
 * the fee is the delivery company's posted price, added to the order total.
 *
 * 🔴 **The backend computes every amount.** Nothing here adds, subtracts or sums
 * a fee, a total or a difference — the screens render the quote's and the
 * order's own figures. These helpers only decide WHICH figure, or whether there
 * is anything to say at all.
 */
import type { CustomerOrder, OrderDeliveryFee } from "./customer.types";
import type { DeliveryTerms } from "./shop.types";

/**
 * The shop's terms for a product row, a product page or a store.
 *
 * `deliveryTerms` is the truth. An API from before ADR-A11 sends only the
 * boolean `freeDelivery`, and `true` there was a real promise, so it maps to
 * `always`; `false` maps to nothing rather than to `never` — that API said
 * nothing about who pays.
 */
export function deliveryTermsOf(item: {
  deliveryTerms?: DeliveryTerms | null;
  freeDelivery?: boolean;
}): DeliveryTerms | null {
  if (item.deliveryTerms) return item.deliveryTerms;
  return item.freeDelivery ? { mode: "always", freeAboveAmount: null } : null;
}

/**
 * Whether the terms promise free delivery at all — `always`, or `above` with a
 * threshold to quote. `never` (and an `above` with no amount, which the API
 * should not send) promise nothing, so a card says nothing.
 */
export function promisesFreeDelivery(terms: DeliveryTerms | null): terms is DeliveryTerms {
  if (!terms) return false;
  if (terms.mode === "always") return true;
  return terms.mode === "above" && typeof terms.freeAboveAmount === "number";
}

/**
 * The parcel's own delivery-fee entry on an order, if the API sent one.
 * `deliveryFees[]` is keyed by `shipmentId`, the same id the shipments read uses.
 */
export function parcelFee(order: Pick<CustomerOrder, "deliveryFees">, shipmentId: string): OrderDeliveryFee | null {
  return order.deliveryFees?.find((fee) => fee.shipmentId === shipmentId) ?? null;
}

/**
 * Whether the fee-change reads apply to this order at all: only a physical order
 * whose delivery the CUSTOMER pays. A vendor-paid fee is between the shop and the
 * delivery company and never appears on the customer surface. An older API sends
 * no `deliveryPayer`, which reads as "no".
 */
export const customerPaysDelivery = (order: Pick<CustomerOrder, "orderType" | "deliveryPayer">): boolean =>
  order.orderType === "physical" && order.deliveryPayer === "customer";
