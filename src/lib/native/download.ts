"use client";

import { isNative, withNative } from "@/lib/platform";

/**
 * Taking delivery of a purchased file.
 *
 * ── What was broken ──────────────────────────────────────────────────────────
 *
 * The downloads page assigned `window.location.href` to a freshly minted,
 * single-use link. In a browser that starts a download and leaves the page
 * where it is. In a WebView it navigates the app itself to the file — off its
 * own origin, out of the bundle, with no way back — and the token is spent
 * either way, so a shopper who did that lost the download and the app in one
 * tap.
 *
 * ── Why this hands the URL to the system browser rather than saving it here ──
 *
 * The obvious native implementation is `@capacitor/filesystem`: fetch the file,
 * write it, then offer it to the share sheet. It is the wrong one here. Writing
 * through the plugin means holding the whole file in memory as base64 — four
 * bytes for every three — with no progress, no resume, and no notification, on
 * the cheap phones and thin connections this product is explicitly built for. A
 * 300 MB course video is not a thing to buffer in a WebView.
 *
 * A Custom Tab on Android and `SFSafariViewController` on iOS both hand the URL
 * to the platform's own download manager, which streams it to disk, shows
 * progress in the notification shade, survives the app being backgrounded, and
 * files the result where the OS keeps downloads. That is a better version of
 * every part of it, and it is why `@capacitor/filesystem` is deliberately not a
 * dependency of this app.
 *
 * The link needs no session — the token in it is the authentication — so it
 * works in a browser that has none of our headers. That is what makes this
 * possible at all.
 */
export async function startDownload(url: string): Promise<void> {
  const handed = await withNative(async () => {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
    return true;
  });

  if (handed) return;

  if (isNative()) {
    // A bridge that refused. Anything is better than navigating the app away,
    // and there is nothing else to try, so report rather than break the shell.
    throw new Error("Could not open the download");
  }

  // Web: unchanged. The browser sees Content-Disposition and downloads.
  window.location.href = url;
}
