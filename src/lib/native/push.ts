"use client";

import { isNative, isAndroid, withNative } from "@/lib/platform";
import * as storage from "@/lib/platform/storage";
import { registerDevice, unregisterDevice, type DevicePlatform } from "@/lib/shop/devices.api";

/**
 * Push notifications — the device half.
 *
 * ── What this module is and is not ───────────────────────────────────────────
 *
 * It talks to the plugin and to the device registry, and nothing else. Deciding
 * *where* a tapped notification goes is a fact about the shop's URLs, so it
 * lives in `lib/shop/notification-routing.ts` instead — same split as every
 * other file in this folder, and what keeps the routing testable without a
 * device.
 *
 * ── Why the permission is not requested here at launch ───────────────────────
 *
 * `NativeShell` does not call this. The prompt belongs after the first order is
 * placed, where the shopper has just been given a reason to want order updates;
 * asked at launch it is a dialog in front of a stranger, and Android 13+ only
 * offers it once — a denial is effectively permanent.
 *
 * ── The unread badge ─────────────────────────────────────────────────────────
 *
 * The badge deliberately does not poll, to protect the rate limit. A foreground
 * push is the event that should refresh it, which is why `onReceived` exists
 * separately from `onOpen`.
 */

/**
 * The registered token, kept so sign-out can withdraw it.
 *
 * Persisted rather than held in memory alone: the shopper who signs out has
 * usually relaunched the app since the order that registered it, and a token we
 * cannot name is a token we cannot withdraw — leaving the next person to hold
 * the phone receiving someone else's order updates.
 */
const TOKEN_KEY = "push.token";

let listenersBound = false;

/** What `enablePush` actually achieved, so the caller can say something true. */
export type PushOutcome =
  | "enabled"
  /** The OS prompt was refused, or was already refused and will not be shown again. */
  | "denied"
  /** Not a device build, or the plugin/Firebase is not there. Say nothing to the shopper. */
  | "unavailable";

export interface PushHandlers {
  /** A notification arrived while the app was in the foreground. */
  onReceived?: () => void;
  /** The shopper tapped a notification. `data` is FCM's data block, all strings. */
  onOpen?: (data: Record<string, string>) => void;
}

/**
 * Bind the notification listeners. Idempotent, and safe before permission.
 *
 * Called by `NativeShell` on mount. Binding early matters for `onOpen`: a
 * notification tapped while the app was killed delivers its event during
 * startup, and a listener registered after that point never hears it.
 */
export async function startPushListeners(handlers: PushHandlers): Promise<void> {
  if (listenersBound || !isNative()) return;
  listenersBound = true;

  await withNative(async () => {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    // The token arrives asynchronously after `register()`, and again whenever
    // FCM rotates it — which it does on its own schedule, with no way for the
    // client to tell a rotation from a first issue. Registering is an upsert on
    // the backend precisely so this can fire as often as it likes.
    await PushNotifications.addListener("registration", (token) => {
      void persistAndRegister(token.value);
    });

    await PushNotifications.addListener("registrationError", (err) => {
      // Almost always a missing `google-services.json` or a Firebase project
      // that does not know this package name. Not worth a toast: the shopper
      // did not ask for this and cannot fix it.
      if (process.env.NODE_ENV !== "production") {
        console.warn("[push] registration failed:", err);
      }
    });

    if (handlers.onReceived) {
      await PushNotifications.addListener("pushNotificationReceived", () => {
        handlers.onReceived?.();
      });
    }

    if (handlers.onOpen) {
      await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
        const data = (action.notification.data ?? {}) as Record<string, string>;
        handlers.onOpen?.(data);
      });
    }
  });
}

/**
 * Ask for permission, and register this device if it is given.
 *
 * Returns what happened rather than a boolean, because "denied" and
 * "unavailable" call for different behaviour: the first is the shopper's
 * decision and should be respected silently, the second is our problem.
 */
export async function enablePush(): Promise<PushOutcome> {
  if (!isNative()) return "unavailable";

  const outcome = await withNative(async (): Promise<PushOutcome> => {
    const { PushNotifications } = await import("@capacitor/push-notifications");

    // Check before requesting: on Android 13+ the system dialog is shown once
    // and never again, so re-requesting a denial is a silent no-op that would
    // otherwise read as a failure.
    let status = await PushNotifications.checkPermissions();
    if (status.receive === "prompt" || status.receive === "prompt-with-rationale") {
      status = await PushNotifications.requestPermissions();
    }
    if (status.receive !== "granted") return "denied";

    // Hands the token to the `registration` listener bound above — there is no
    // return value here to wait on.
    await PushNotifications.register();
    return "enabled";
  });

  return outcome ?? "unavailable";
}

/**
 * Withdraw this device from push. Call on sign-out and on account closure.
 *
 * Best-effort on the network, absolute locally: the stored token is dropped
 * whatever the request does, because the alternative is an app that believes it
 * is still registered under an account it has left.
 */
export async function disablePush(): Promise<void> {
  const token = await storage.get(TOKEN_KEY);
  await storage.remove(TOKEN_KEY);

  if (!token) return;

  try {
    await unregisterDevice(token);
  } catch {
    // The backend prunes tokens FCM rejects, so a token we failed to withdraw
    // dies on its next send anyway. Not worth surfacing to someone signing out.
  }

  await withNative(async () => {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.removeAllDeliveredNotifications();
  });
}

/** Store the token and hand it to the backend registry. */
async function persistAndRegister(token: string): Promise<void> {
  await storage.set(TOKEN_KEY, token);

  const devicePlatform: DevicePlatform = isAndroid() ? "android" : "ios";

  try {
    await registerDevice(token, devicePlatform, navigator?.userAgent?.slice(0, 512));
  } catch {
    // A registration that fails leaves the token stored, so the next launch —
    // FCM re-fires `registration` on every one — tries again. Nothing here is
    // worth interrupting the shopper for.
  }
}
