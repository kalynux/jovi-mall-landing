/**
 * Paying for a checkout group.
 *
 * ⚠️ **`/api/payments/*` answers flat — no `data` key.** It is one of the three
 * endpoint families the backend builds by hand rather than through the response
 * interceptor, so `apiFetch` returns the whole body and every type here is the
 * *full response*, not a payload. See the note on `apiFetch`.
 *
 * One payment settles the whole group. A cart with two sellers becomes two
 * orders sharing one `cartId`, and `initiatePayment({ cartId })` pays for both
 * in a single transaction that fans out at settlement — which is why the cart id
 * and not an order id is what the storefront sends.
 *
 * Both calls are **idempotent**: initiating twice returns the existing
 * transaction rather than charging twice, so a double-tapped pay button is safe.
 */
import { apiFetch } from "@/lib/api/client";

/**
 * The gateways the backend implements.
 *
 * Only Stripe supports refunds today — NotchPay and MyCoolPay raise
 * `REFUND_GATEWAY_NOT_SUPPORTED` — which matters when a cancellation needs money
 * returned, not at the point of paying.
 */
export type PaymentGateway = "NOTCHPAY" | "MYCOOLPAY" | "STRIPE";

export type PhoneOperator = "MTN" | "ORANGE" | "MOOV";

export interface PaymentChannel {
  /** E.164. Mobile money debits this number. */
  phoneNumber?: string;
  phoneOperator?: PhoneOperator;
  cardToken?: string;
  customerEmail?: string;
  customerName?: string;
}

export interface InitiatePaymentResponse {
  success: boolean;
  transactionId: string;
  status: string;
  /**
   * How the shopper completes the payment, and it differs per gateway: a USSD
   * string to dial for mobile money, a Stripe `clientSecret` for a card. Show
   * `message` when neither is present rather than a blank screen.
   */
  instructions?: { ussdCode?: string; clientSecret?: string; message?: string };
  message?: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  transactionId: string;
  status: string;
  message?: string;
}

/**
 * A transaction status that will never change again.
 *
 * `initiate` can answer with one: the gateway is called synchronously, and a
 * refusal comes back on that same response rather than through the webhook. The
 * success screen otherwise treats every fresh transaction as pending and polls
 * `verify` for a minute — so without this check a shopper whose payment was
 * already declined watches "Waiting for your payment" for sixty seconds before
 * being told what the server said immediately.
 */
export const isSettledFailure = (status: string): boolean =>
  status === "FAILED" || status === "CANCELLED";

/**
 * Pay for a checkout group.
 *
 * The backend also accepts `{ orderId }` for a single order, and the storefront
 * deliberately does not use it: a group is charged once, the shopper was told
 * so at checkout, and `initiatePaymentForCart` already filters to the orders
 * that are still payable — so one cancelled order inside a group does not need
 * a per-order call to avoid being re-charged.
 */
export async function initiatePayment(input: {
  cartId: string;
  gateway: PaymentGateway;
  channel: PaymentChannel;
}): Promise<InitiatePaymentResponse> {
  return apiFetch<InitiatePaymentResponse>("/api/payments/initiate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * Poll after the shopper approves on their handset.
 *
 * Mobile money is asynchronous — `initiate` returns with the prompt sent, not
 * with the money taken — so the success screen verifies rather than assuming.
 */
export async function verifyPayment(transactionId: string): Promise<VerifyPaymentResponse> {
  return apiFetch<VerifyPaymentResponse>("/api/payments/verify", {
    method: "POST",
    body: JSON.stringify({ transactionId }),
  });
}
