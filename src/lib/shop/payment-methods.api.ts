/**
 * Saved payment methods — the shared `/api/me/payment-methods` surface.
 *
 * Preferred over the customer-scoped `/api/customer/payment-methods` aliases:
 * this is the only surface with a list and a set-default route. Since
 * 2026-09-30 every surface returns the same object (`SavedPaymentMethod`).
 *
 * Wallets only: a save is `{ provider: MTN|ORANGE|MOOV, phoneNumber, label?,
 * isDefault? }`, strict, and names no payment company. The full number is
 * never returned — `lib/shop/wallet-numbers` keeps this device's copy.
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
