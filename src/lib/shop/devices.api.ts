/**
 * Push-notification device registry — `POST`/`DELETE /api/customer/devices`.
 *
 * The backend half of push already exists and predates the app: tokens are
 * keyed by **user**, not by customer, so the same registry serves the vendor
 * dashboard and an agent's phone. `FcmPushService` degrades to a no-op unless
 * `FCM_ENABLED` and the service-account credentials are all present, which is
 * why registering from a build with no Firebase project behind it is harmless
 * rather than an error.
 *
 * Note the plural: `/api/customer/devices` is this registry. `/api/agent/device`
 * (singular) is a different thing entirely — an agent's device *location* — and
 * the two have been confused before.
 */
import { apiFetch } from "@/lib/api/client";

/** Matches the backend's `RegisterDeviceTokenSchema` enum exactly. */
export type DevicePlatform = "web" | "android" | "ios";

export interface RegisteredDevice {
  id: string;
  platform: DevicePlatform;
  lastUsedAt: string;
}

/**
 * Register or refresh this device's FCM token.
 *
 * An upsert on the backend, so calling it again with the same token is the
 * intended way to refresh `lastUsedAt` — FCM rotates tokens on its own schedule
 * and the client cannot tell a rotation from a first registration.
 */
export async function registerDevice(
  token: string,
  platform: DevicePlatform,
  userAgent?: string,
): Promise<RegisteredDevice> {
  return apiFetch<RegisteredDevice>("/api/customer/devices", {
    method: "POST",
    body: JSON.stringify({ token, platform, userAgent }),
  });
}

/**
 * Drop this device's token — on sign-out, and on account closure.
 *
 * Without this the next person to hold the phone keeps receiving the previous
 * shopper's order updates, which is a privacy leak rather than an annoyance.
 * It takes the token in the body rather than an id because that is the only
 * handle the client is guaranteed to still have.
 */
export async function unregisterDevice(token: string): Promise<void> {
  await apiFetch<{ success: boolean }>("/api/customer/devices", {
    method: "DELETE",
    body: JSON.stringify({ token }),
  });
}
