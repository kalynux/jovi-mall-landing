/**
 * Saved delivery addresses — `/api/customer/addresses`, plus the geocoding
 * search that backs the address picker.
 *
 * All three mutations return the **whole updated profile**, not the address, so
 * the caller should replace its cached profile rather than patching one field.
 */
import { apiFetch } from "@/lib/api/client";
import type {
  AddAddressPayload,
  CustomerProfile,
  GeoCandidate,
} from "./customer.types";

/**
 * POST /api/customer/addresses
 *
 * `country` defaults to `CM` server-side. `address_line2` and `state` are
 * clearable — send `null` to clear, omit to leave alone.
 */
export async function addAddress(
  payload: AddAddressPayload,
): Promise<CustomerProfile> {
  return apiFetch<CustomerProfile>("/api/customer/addresses", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** DELETE /api/customer/addresses/:id */
export async function removeAddress(id: string): Promise<CustomerProfile> {
  return apiFetch<CustomerProfile>(
    `/api/customer/addresses/${encodeURIComponent(id)}`,
    { method: "DELETE" },
  );
}

/** PATCH /api/customer/addresses/:id/default — unsets the previous default. */
export async function setDefaultAddress(id: string): Promise<CustomerProfile> {
  return apiFetch<CustomerProfile>(
    `/api/customer/addresses/${encodeURIComponent(id)}/default`,
    { method: "PATCH" },
  );
}

/**
 * GET /api/geo/search — address autocomplete.
 *
 * Any signed-in user may search. Restricted to Cameroon by default, which is the
 * only country the platform serves (`core/constants/locations.json`). Pass the
 * chosen candidate back as the address's `geo`, together with the text the user
 * typed as `raw_input`.
 */
export async function searchAddresses(
  query: string,
  { limit = 6, country = "cm" }: { limit?: number; country?: string } = {},
): Promise<GeoCandidate[]> {
  const params = new URLSearchParams({
    q: query,
    limit: String(limit),
    country,
  });
  const data = await apiFetch<{ results?: GeoCandidate[] } | GeoCandidate[]>(
    `/api/geo/search?${params}`,
  );
  // The route wraps its candidates as `{ provider, query, results }`; tolerate a
  // bare array too rather than blanking the picker if that ever changes.
  return Array.isArray(data) ? data : (data.results ?? []);
}
