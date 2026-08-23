"use client";

import { isNative, withNative } from "@/lib/platform";
import { setOfflineProbe } from "@/lib/errors/is-network-error";

/**
 * Whether there is a connection, answered by the OS rather than guessed.
 *
 * ── Why `navigator.onLine` is not good enough on a phone ─────────────────────
 *
 * `is-network-error.ts` believes `navigator.onLine === false` before inspecting
 * anything else, and on a desktop browser that is sound. In an Android WebView
 * it is close to useless: it reports `true` whenever any network interface is
 * up, including Wi-Fi that is connected to a router with no internet behind it
 * and a mobile connection with no data allowance left — both of which are
 * ordinary here, not edge cases. The result is a shopper on a dead connection
 * being told "an unexpected error occurred" instead of "check your connection".
 *
 * `@capacitor/network` reports what the platform's own connectivity manager
 * knows. This keeps that answer in a module-level flag, updated by a listener,
 * so the check stays synchronous — `isNetworkError` is called from `catch`
 * blocks that cannot await.
 */

/** Last known state. `true` until the plugin says otherwise. */
let connected = true;
let watching = false;

/**
 * Begin tracking connectivity, and hand the answer to `isNetworkError`.
 *
 * Called once by `NativeShell`. Idempotent, and a no-op on the web, where
 * `navigator.onLine` is already the right answer and the probe stays unset.
 */
export async function startNetworkWatch(): Promise<void> {
  if (watching || !isNative()) return;
  watching = true;

  await withNative(async () => {
    const { Network } = await import("@capacitor/network");

    const status = await Network.getStatus();
    connected = status.connected;

    await Network.addListener("networkStatusChange", (next) => {
      connected = next.connected;
    });

    // Only registered once the plugin has actually answered, so a failed import
    // leaves `isNetworkError` on its `navigator.onLine` path rather than on a
    // flag nothing updates.
    setOfflineProbe(() => !connected);
  });
}

/**
 * ── No `isOffline()` export, deliberately ────────────────────────────────────
 *
 * The obvious companion would be a synchronous `isOffline()` for components to
 * read. Nothing needs one: the single consumer of this state is
 * `isNetworkError`, and it gets the answer through the probe registered above
 * rather than by importing anything from here. A second public reading of the
 * same flag would be a second thing to keep in step, and the first UI that
 * genuinely wants an offline banner should take a subscription — a snapshot
 * read would not re-render when connectivity changed.
 */
