"use client";

import { isNative, withNative } from "@/lib/platform";

/**
 * Leaving the app, on purpose.
 *
 * ── Why `window.open` is not enough any more ─────────────────────────────────
 *
 * On the web, `window.open(href, "_blank")` opens a tab and the user closes it.
 * Inside a WebView there are no tabs: depending on the platform the call either
 * does nothing at all or navigates the app's own WebView to the target — and an
 * app that has left `https://localhost` has left its bundle, with no chrome, no
 * address bar and no back gesture that comes home. That is why
 * `capacitor.config.ts` sets `allowNavigation: []`: nothing may navigate away in
 * place, so everything outbound has to come through here.
 *
 * `@capacitor/browser` opens a Custom Tab on Android and an `SFSafariViewController`
 * on iOS. Both are real browsers with their own address bar and a Done button
 * that returns to the app — which also makes them the only acceptable place to
 * put a payment page, because a shopper who cannot see the URL cannot check who
 * they are paying.
 *
 * ── Two kinds of outbound link, and only one is a web page ───────────────────
 *
 * `openExternal` is for pages. `openApp` is for a URL that another app should
 * handle — `https://wa.me/…`, `tel:`, `mailto:`. Those must NOT go through the
 * in-app browser: handing WhatsApp's URL to a Custom Tab opens WhatsApp Web
 * inside our app instead of the WhatsApp the shopper already has installed.
 */

/** Open a web page the user should come back from. */
export async function openExternal(url: string): Promise<void> {
  const opened = await withNative(async () => {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url, presentationStyle: "popover" });
    return true;
  });

  if (opened) return;

  // Web, or a bridge that refused: the behaviour every one of these call sites
  // had before this module existed.
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * Hand a URL to whichever app owns it.
 *
 * `window.location.href` is right on both targets here, and deliberately so: on
 * a device the OS resolves the scheme and switches apps, and in a browser it
 * follows the link. The one thing that must not happen — a Custom Tab rendering
 * a web fallback for an app that is installed — is what this avoids by NOT
 * using the Browser plugin.
 */
export async function openApp(url: string): Promise<void> {
  if (isNative()) {
    window.location.href = url;
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/**
 * ── There is deliberately no `closeExternal` here ────────────────────────────
 *
 * `Browser.close()` is needed by exactly one flow: a hosted card payment, where
 * the gateway returns the shopper by deep link and wakes the app underneath a
 * Custom Tab that is still on screen. That flow does not exist — the frontend
 * has never consumed the `clientSecret` `initiatePayment` returns, on the web
 * either — and whether it should is an open product question, not a port.
 *
 * Adding the wrapper now would be capability ahead of the feature, which is the
 * thing this app is trying not to do. It is four lines when the flow lands.
 */
