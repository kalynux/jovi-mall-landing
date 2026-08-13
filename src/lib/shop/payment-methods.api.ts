/**
 * Saved payment methods — the shared `/api/me/payment-methods` surface.
 *
 * Preferred over the customer-scoped `/api/customer/payment-methods` duplicate:
 * this one is the only surface with a list and a set-default route, and it keeps
 * the display fields (`brand`, `last4`, expiry, holder) that the profile's
 * sanitized copy drops.
 *
 * Nothing secret is stored here. Tokenization lives with the gateway; these
 * records hold only what is needed to render the method in the UI.
 */
import { apiFetch } from "@/lib/api/client";
import type {
  AddPaymentMethodPayload,
  SavedPaymentMethod,
} from "./customer.types";

/** GET /api/me/payment-methods */
export async function listPaymentMethods(): Promise<SavedPaymentMethod[]> {
  return apiFetch<SavedPaymentMethod[]>("/api/me/payment-methods");
}

/** GET /api/me/payment-methods/default */
export async function getDefaultPaymentMethod(): Promise<SavedPaymentMethod | null> {
  return apiFetch<SavedPaymentMethod | null>("/api/me/payment-methods/default");
}

/** POST /api/me/payment-methods */
export async function addPaymentMethod(
  payload: AddPaymentMethodPayload,
): Promise<SavedPaymentMethod> {
  return apiFetch<SavedPaymentMethod>("/api/me/payment-methods", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** PATCH /api/me/payment-methods/:id/default */
export async function setDefaultPaymentMethod(
  id: string,
): Promise<SavedPaymentMethod> {
  return apiFetch<SavedPaymentMethod>(
    `/api/me/payment-methods/${encodeURIComponent(id)}/default`,
    { method: "PATCH" },
  );
}

/**
 * DELETE /api/me/payment-methods/:id
 *
 * Answers `{ success, message }` with no `data` key, so there is nothing to
 * return — `apiFetch` hands back the whole body and we discard it.
 */
export async function removePaymentMethod(id: string): Promise<void> {
  await apiFetch<unknown>(
    `/api/me/payment-methods/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}
