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

/**
 * PATCH /api/customer/addresses/:id — edit in place.
 *
 * Editing used to mean delete + re-add, which mints a **new** `_id` while past
 * orders still reference the old one through `deliveryAddressId`. Editing in
 * place is what keeps that reference meaningful, so prefer this over the pair.
 *
 * Note this does **not** change which address is the default —
 * `PATCH /addresses/:id/default` owns that.
 */
export async function updateAddress(
  id: string,
  payload: Partial<AddAddressPayload>,
): Promise<CustomerProfile> {
  return apiFetch<CustomerProfile>(
    `/api/customer/addresses/${encodeURIComponent(id)}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
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

/**
 * GET /api/geo/reverse — a coordinate to the address at it.
 *
 * The other half of the picker, and what makes "use my current location"
 * possible: it returns the **same `GeoCandidate`** shape `searchAddresses`
 * produces, so an address obtained from the handset's GPS is stored, validated
 * and priced by exactly the same code as one typed and picked from a list.
 * There is no second path to keep in step.
 *
 * Answers `null` when the geocoder has nothing at that point — which is a real
 * outcome rather than a failure, and the caller should say so and offer the
 * search box. Same auth as the search route: any signed-in user.
 */
export async function reverseGeocode(
  lat: number,
  lng: number,
): Promise<GeoCandidate | null> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  const data = await apiFetch<{ result?: GeoCandidate | null }>(
    `/api/geo/reverse?${params}`,
  );
  return data?.result ?? null;
}
