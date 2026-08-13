/**
 * Customer orders — `/api/customer/orders`.
 *
 * Orders are read by **checkout group** (`cartId`), not by order id: a cart
 * holding several vendors' items splits into one order per vendor at checkout,
 * and the customer sees the group as a single logical order. There is no
 * `GET /api/customer/orders/:id`.
 */
import { apiFetch, apiFetchList } from "@/lib/api/client";
import type { ListMeta } from "@/lib/api/client";
import type { OrderGroup } from "./customer.types";

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
