/**
 * Delivery-fee changes after checkout — `api-doc/customer/delivery-fee-changes.md`
 * (ADR-A11 W-E, 2026-10-04).
 *
 * Only a **customer-paid** parcel's fee can change here, and only before pickup:
 *
 *   - a delivery company LOWERS a fee → applied at once; the difference is
 *     refunded (online) or the cash to hand over drops (COD / cash to rider);
 *   - a delivery company RAISES a fee, or the shop moves the parcel to a dearer
 *     company → it waits for the customer: approve or decline. An approved
 *     ONLINE increase is a top-up payment, and the parcel waits for it;
 *   - the customer asks for a COMBINED price on several parcels one company
 *     carries → the company may only lower fees, applied like any decrease.
 *
 * Every figure is the server's. Nothing here computes a fee, a difference or a
 * total — the screens render what these reads return.
 */
import { apiFetch } from "@/lib/api/client";
import type {
  CombinedDeliveryRequest,
  DeliveryFeeProposal,
  DeliveryFeeTopupPayment,
  OrderDeliveryFees,
} from "./customer.types";
import type { ChargeRequest } from "./payments.api";

const orderBase = (orderId: string) =>
  `/api/customer/orders/${encodeURIComponent(orderId)}/delivery-fee-proposals`;

const groupBase = (cartId: string) =>
  `/api/customer/orders/groups/${encodeURIComponent(cartId)}/combined-delivery-requests`;

/**
 * GET /api/customer/orders/:id/delivery-fee-proposals — one vendor order's
 * proposals, its parcels' fees, and the delivery money owed back.
 */
export async function getOrderDeliveryFees(orderId: string): Promise<OrderDeliveryFees> {
  return apiFetch<OrderDeliveryFees>(orderBase(orderId));
}

/**
 * Accept a fee change. `version` is the one on screen: an edited figure answers
 * `409 DELIVERY_FEE_PROPOSAL_VERSION_MISMATCH` — re-read and re-show, never
 * retry blind. COD applies at once; online freezes the figure and returns a
 * `topup` to pay.
 */
export async function approveDeliveryFee(
  orderId: string,
  proposalId: string,
  version: number,
): Promise<DeliveryFeeProposal> {
  return apiFetch<DeliveryFeeProposal>(
    `${orderBase(orderId)}/${encodeURIComponent(proposalId)}/approve`,
    { method: "POST", body: JSON.stringify({ version }) },
  );
}

/** Decline a fee change. Same `version` rule as approve. */
export async function rejectDeliveryFee(
  orderId: string,
  proposalId: string,
  version: number,
  note?: string,
): Promise<DeliveryFeeProposal> {
  return apiFetch<DeliveryFeeProposal>(
    `${orderBase(orderId)}/${encodeURIComponent(proposalId)}/reject`,
    { method: "POST", body: JSON.stringify(note ? { version, note } : { version }) },
  );
}

/**
 * Pay an approved ONLINE increase — the same `{ provider, channel }` body and
 * the same answer as `POST /payments/initiate`, then `POST /payments/verify` or
 * the webhook confirms it.
 *
 * ⚠ Unlike `/payments/initiate`, this door answers in the standard envelope,
 * and a refused charge comes back as a `200` with `success: false` and the
 * transaction still in `data` — so both shapes are unwrapped here.
 */
export async function payDeliveryFeeTopup(
  orderId: string,
  proposalId: string,
  charge: ChargeRequest,
): Promise<DeliveryFeeTopupPayment> {
  const body = await apiFetch<DeliveryFeeTopupPayment | { success: false; data: DeliveryFeeTopupPayment }>(
    `${orderBase(orderId)}/${encodeURIComponent(proposalId)}/pay`,
    { method: "POST", body: JSON.stringify(charge) },
  );
  return "data" in body && body.success === false ? body.data : (body as DeliveryFeeTopupPayment);
}

/** GET …/groups/:cartId/combined-delivery-requests — newest first. */
export async function listCombinedDeliveryRequests(cartId: string): Promise<CombinedDeliveryRequest[]> {
  const data = await apiFetch<CombinedDeliveryRequest[]>(groupBase(cartId));
  return Array.isArray(data) ? data : [];
}

/**
 * Ask one delivery company for a combined price on this checkout's parcels.
 * Without `shipmentIds` the server takes every eligible parcel that company
 * carries; at least two must be eligible (`422 COMBINED_DELIVERY_REQUEST_INELIGIBLE`).
 */
export async function requestCombinedDelivery(
  cartId: string,
  input: { agencyId: string; shipmentIds?: string[]; note?: string },
): Promise<CombinedDeliveryRequest> {
  return apiFetch<CombinedDeliveryRequest>(groupBase(cartId), {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Withdraw an `open` request. `409 COMBINED_DELIVERY_REQUEST_NOT_OPEN` otherwise. */
export async function cancelCombinedDelivery(
  cartId: string,
  requestId: string,
): Promise<CombinedDeliveryRequest> {
  return apiFetch<CombinedDeliveryRequest>(
    `${groupBase(cartId)}/${encodeURIComponent(requestId)}/cancel`,
    { method: "POST" },
  );
}
