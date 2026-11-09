"use client";

import { isNative, withNative } from "@/lib/platform";

/**
 * Sharing a link, and the honest report of what happened.
 *
 * ── Three paths, in order ────────────────────────────────────────────────────
 *
 * 1. Inside the Capacitor app: the `@capacitor/share` plugin's system sheet.
 * 2. In a browser with the Web Share API (`navigator.share` — every phone
 *    browser that matters, and Chrome/Edge/Safari on desktop): the same system
 *    sheet, opened by the browser.
 * 3. Neither: copy the URL to the clipboard and let the caller say so.
 *
 * Until 2026-11 path 2 did not exist — the web went straight to the copy — so a
 * shopper on a phone browser tapping Share on a store or product got "Link
 * copied" instead of the sheet they expected.
 *
 * ── Why the return value matters ─────────────────────────────────────────────
 *
 * After a share sheet a "Link copied" toast is wrong — nothing was copied, and
 * the shopper has already sent the link to their sister. Two different things
 * happened, so this returns which one, and the caller words its toast from that
 * rather than assuming.
 *
 * `"dismissed"` is a third outcome and not a failure: a shopper who opens the
 * share sheet and changes their mind should get silence, not "Link copied" and
 * not an error — and not a copy either.
 */

export type ShareOutcome = "shared" | "copied" | "dismissed" | "failed";

export interface ShareRequest {
  /** The thing being shared. A product title, a store name. */
  title?: string;
  text?: string;
  url: string;
  /** The sheet's own header on Android. */
  dialogTitle?: string;
}

export async function shareLink(request: ShareRequest): Promise<ShareOutcome> {
  // Not behind an `await`: on the web the share sheet needs the tap's user
  // activation, so `navigator.share` is called in the same task as the click.
  if (!isNative()) return shareOnWeb(request);

  const native = await withNative(async () => {
    const { Share } = await import("@capacitor/share");

    // `canShare` reports whether the platform has a sheet at all. It has one on
    // both targets we ship, but a false here would otherwise surface as a throw
    // that reads like a permission problem.
    const { value } = await Share.canShare();
    if (!value) return "unavailable" as const;

    try {
      await Share.share({
        title: request.title,
        text: request.text,
        url: request.url,
        dialogTitle: request.dialogTitle ?? request.title,
      });
      return "shared" as const;
    } catch {
      /**
       * The sheet throws on cancel — it does not resolve with a flag — so a
       * dismissal and a real failure arrive identically. Reported as a
       * dismissal, which is overwhelmingly what it is, and the cost of being
       * wrong is silence rather than a false success message.
       */
      return "dismissed" as const;
    }
  });

  if (native === "shared" || native === "dismissed") return native;

  // A device with no sheet, or a plugin that failed: copy instead.
  return copyLink(request.url);
}

/**
 * The browser's own share sheet, falling back to a copy only when there is no
 * sheet to open.
 *
 * - `AbortError` is the shopper closing the sheet: silent, and no copy.
 * - `InvalidStateError` is a second tap while a sheet is already open: the
 *   first sheet is still there, so also silent.
 * - Anything else (`NotAllowedError` when the tap's activation has lapsed —
 *   e.g. a caller that awaited the network first — or a permissions policy in
 *   an iframe; `TypeError` for data the platform refuses) means no sheet was
 *   shown, which is "unavailable", so it copies as before.
 */
async function shareOnWeb(request: ShareRequest): Promise<ShareOutcome> {
  const data: ShareData = { url: request.url };
  if (request.title) data.title = request.title;
  if (request.text) data.text = request.text;

  const canShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    (typeof navigator.canShare !== "function" || navigator.canShare(data));

  if (canShare) {
    try {
      await navigator.share(data);
      return "shared";
    } catch (err) {
      // A DOMException; read `name` structurally rather than trusting its
      // prototype chain in every WebView.
      const name = (err as { name?: unknown } | null)?.name;
      if (name === "AbortError" || name === "InvalidStateError") return "dismissed";
    }
  }

  return copyLink(request.url);
}

/**
 * Copy to the clipboard — the fallback for a platform with no share sheet.
 *
 * `shareLink` is the entry point: a caller that reached for this directly would
 * be choosing the web behaviour on a device that has the better one. Exported
 * for what genuinely wants a copy button *beside* a share button.
 *
 * The Capacitor plugin is preferred on a device because `navigator.clipboard`
 * needs a secure context and a user gesture the WebView does not always agree
 * it had. On the web it is the plugin's own fallback anyway.
 */
export async function copyLink(url: string): Promise<ShareOutcome> {
  const native = await withNative(async () => {
    const { Clipboard } = await import("@capacitor/clipboard");
    await Clipboard.write({ url });
    return true;
  });

  if (native) return "copied";

  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    // Denied, or no clipboard API at all. The caller says so rather than
    // claiming a copy that did not happen.
    return "failed";
  }
}
