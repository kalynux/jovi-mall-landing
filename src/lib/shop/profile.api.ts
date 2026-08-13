/**
 * Customer profile — `GET`/`PATCH /api/customer/profile`.
 *
 * Every route resolves the customer from the JWT; there is no customer-id path
 * parameter, so a caller can only ever read or write their own record.
 */
import { apiFetch } from "@/lib/api/client";
import type { CustomerProfile, UpdateProfilePayload } from "./customer.types";

/** GET /api/customer/profile */
export async function getProfile(): Promise<CustomerProfile> {
  return apiFetch<CustomerProfile>("/api/customer/profile");
}

/**
 * PATCH /api/customer/profile
 *
 * Only the keys you send change. `bio`, `avatarFileId` and `recentProductCode`
 * are *clearable*: send `null` (or `""`) to clear them, omit them to leave the
 * stored value alone.
 */
export async function updateProfile(
  payload: UpdateProfilePayload,
): Promise<CustomerProfile> {
  return apiFetch<CustomerProfile>("/api/customer/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}
