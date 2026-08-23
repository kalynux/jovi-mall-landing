/**
 * Customer orders — `/api/customer/orders`.
 *
 * A cart holding several sellers' items splits into **one order per vendor**,
 * all sharing a `cartId`, and the customer sees that group as a single logical
 * order that they pay for once. So the group is the primary read — but
 * `GET /orders/:id` exists now too, for the one seller's slice a push deep-link
 * or an email carries.
 */
import { apiFetch, apiFetchList } from "@/lib/api/client";
import type { ListMeta } from "@/lib/api/client";
import type {
  CheckoutResult,
  CustomerOrder,
  CustomerShipment,
  OrderGroup,
} from "./customer.types";

/**
 * POST /api/customer/orders/checkout — turn the cart into orders.
 *
 * **Atomic**: if any order fails to create, none are persisted and the cart is
 * left intact. Stock is held for 30 minutes at this point — a cart reserves
 * nothing, the hold starts here — so this is where a line can fail with
 * `422 CATALOG_INSUFFICIENT_STOCK` carrying
 * `details: { variantId, sku, requested, available }`.
 *
 * Send `deliveryAddressId`, and send it to `POST /cart/quote` first: a physical
 * checkout with no geocoded drop-off is refused with
 * `422 ORDER_DELIVERY_ADDRESS_REQUIRED`, and finding that out at the pay button
 * is much worse than finding it out on the cart.
 *
 * Online checkout continues at `POST /api/payments/initiate` with the returned
 * `cartId`. Cash on delivery needs no payment call.
 */
export async function checkout(input: {
  paymentMethod?: "online" | "cash_on_delivery";
  deliveryAddressId?: string;
}): Promise<CheckoutResult> {
  return apiFetch<CheckoutResult>("/api/customer/orders/checkout", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** GET /api/customer/orders — paginated by group. No sort parameter. */
export async function listOrderGroups(
  { page = 1, limit = 20 }: { page?: number; limit?: number } = {},
): Promise<{ data: OrderGroup[]; meta: ListMeta }> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  return apiFetchList<OrderGroup>(`/api/customer/orders?${params}`);
}

/** GET /api/customer/orders/groups/:cartId — the group with line items. */
export async function getOrderGroup(cartId: string): Promise<OrderGroup> {
  return apiFetch<OrderGroup>(
    `/api/customer/orders/groups/${encodeURIComponent(cartId)}`,
  );
}

/**
 * GET /api/customer/orders/:id — one seller's slice of a checkout group.
 *
 * New. This file used to state that it did not exist; it does, and it carries
 * what the group list cannot: the store, the price breakdown, the frozen
 * delivery address and per-line images.
 */
export async function getOrder(orderId: string): Promise<CustomerOrder> {
  return apiFetch<CustomerOrder>(`/api/customer/orders/${encodeURIComponent(orderId)}`);
}

/**
 * GET /api/customer/orders/:orderId/shipments — the parcels on an order.
 *
 * This is what makes `confirmShipmentDelivery` and `resendDeliveryCode` below
 * reachable at all: no customer-facing response returned a shipment id except
 * COD's `codCollections`, which is `undefined` for every online-paid order — so
 * a prepaid customer could never confirm a delivery, and the tracking number was
 * disclosed exactly once, by the confirm call, after delivery.
 *
 * Statuses are collapsed to the five a customer is shown; the internal dispatch
 * vocabulary (`assigned`, `handing_over`, …) never reaches here, and neither
 * does the agent's identity or the free-text note on a failed attempt.
 */
export async function listOrderShipments(orderId: string): Promise<CustomerShipment[]> {
  const { data } = await apiFetchList<CustomerShipment>(
    `/api/customer/orders/${encodeURIComponent(orderId)}/shipments`,
  );
  return data;
}

/**
 * POST /api/customer/orders/:id/cancel
 *
 * Only pre-shipment (`pending`/`processing`) **and** unpaid orders. A paid order
 * returns `422 ORDER_CANCEL_REQUIRES_REFUND` — this endpoint performs no refund.
 * The vendor's cancellation policy can also refuse it (`CANCELLATION_NOT_ALLOWED`).
 */
export async function cancelOrder(
  orderId: string,
  reason?: string,
): Promise<{ order_id: string; fulfillment_status: string }> {
  return apiFetch(`/api/customer/orders/${encodeURIComponent(orderId)}/cancel`, {
    method: "POST",
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

/**
 * PATCH /api/customer/orders/:id/confirm-delivery
 *
 * The primary path for **digital** orders (`fulfilled`). For physical orders it
 * is an idempotent fallback — confirming the last shipment already completes the
 * order, so this then answers `409 EARNINGS_ALREADY_COMPLETED`.
 */
export async function confirmDelivery(
  orderId: string,
): Promise<{ order_id: string; completed_at: string }> {
  return apiFetch(
    `/api/customer/orders/${encodeURIComponent(orderId)}/confirm-delivery`,
    { method: "PATCH" },
  );
}

/**
 * POST /api/customer/orders/:orderId/shipments/:shipmentId/confirm-delivery
 *
 * Confirms ONE shipment. A physical order split across several delivery agencies
 * has one shipment each, and they can arrive on different days. Once every
 * shipment is confirmed the order completes automatically.
 *
 * **Never offer this for a cash-on-delivery order** — there the delivery code
 * records payment and marks the shipment delivered in one step, and calling this
 * returns `422 SHIPMENT_CONFIRMATION_NOT_ALLOWED`.
 */
export async function confirmShipmentDelivery(
  orderId: string,
  shipmentId: string,
): Promise<{
  id: string;
  orderId: string;
  status: string;
  trackingNumber?: string;
  orderFulfillmentStatus: string;
}> {
  return apiFetch(
    `/api/customer/orders/${encodeURIComponent(orderId)}/shipments/${encodeURIComponent(shipmentId)}/confirm-delivery`,
    { method: "POST" },
  );
}

/**
 * POST /api/customer/orders/:orderId/shipments/:shipmentId/resend-delivery-code
 *
 * Regenerates and re-sends this shipment's COD code (lost, or locked after too
 * many wrong entries). Rate-limited to one per 60 s —
 * `429 COD_CODE_RESEND_TOO_SOON` carries `details.retryInSeconds`.
 */
export async function resendDeliveryCode(
  orderId: string,
  shipmentId: string,
): Promise<{
  shipmentId: string;
  deliveryCode: string;
  expectedAmount: number;
  currency: string;
}> {
  return apiFetch(
    `/api/customer/orders/${encodeURIComponent(orderId)}/shipments/${encodeURIComponent(shipmentId)}/resend-delivery-code`,
    { method: "POST" },
  );
}
