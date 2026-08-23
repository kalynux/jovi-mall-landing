"use client";

import { useEffect, useRef } from "react";
import { IS_NATIVE_BUILD, isNative } from "@/lib/platform";

/**
 * Run something each time the app comes back to the foreground.
 *
 * ── The case this exists for ─────────────────────────────────────────────────
 *
 * Mobile money is the dominant payment method here, and it is asynchronous by
 * design: `POST /payments/initiate` returns once the USSD prompt has been
 * *sent*, not once the money has moved. So the shopper leaves — to the dialer,
 * or to whatever their operator pushes — approves, and comes back.
 *
 * Meanwhile the success screen is polling `POST /payments/verify` fifteen times
 * at four-second intervals: one minute, total. On a phone that minute is spent
 * in the background, where a WebView's timers are throttled and eventually
 * stopped altogether. The shopper returns to a screen that has given up and
 * says "pending" about a payment that completed while they were looking at it.
 *
 * On the web there is no equivalent problem — a tab that loses focus keeps its
 * timers well enough — so this compiles away entirely there.
 *
 * ── Why the handler lives in a ref ───────────────────────────────────────────
 *
 * Callers pass an inline closure that reads current state. Listing it as a
 * dependency would tear down and re-register the native listener on every
 * render; capturing it once would run a stale closure a minute later. The ref
 * is what lets the listener be registered exactly once and still call the
 * newest handler.
 */
export function useAppResume(onResume: () => void): void {
  const handler = useRef(onResume);
  handler.current = onResume;

  useEffect(() => {
    if (!IS_NATIVE_BUILD || !isNative()) return;

    let remove: (() => void) | undefined;

    void (async () => {
      const { App } = await import("@capacitor/app");
      const listener = await App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) handler.current();
      });
      remove = () => void listener.remove();
    })();

    return () => remove?.();
  }, []);
}
