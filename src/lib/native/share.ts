"use client";

import { withNative } from "@/lib/platform";

/**
 * Sharing a link, and the honest report of what happened.
 *
 * ── Why the return value matters ─────────────────────────────────────────────
 *
 * The web has no share sheet worth relying on, so the store page copies the URL
 * to the clipboard and toasts "Link copied". A device does have one, and after
 * it the toast is wrong — nothing was copied, and the shopper has already sent
 * the link to their sister. Two different things happened, so this returns which
 * one, and the caller words its toast from that rather than assuming.
 *
 * `"dismissed"` is a third outcome and not a failure: a shopper who opens the
 * share sheet and changes their mind should get silence, not "Link copied" and
 * not an error.
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

  // Web, or a device with no sheet: copy instead, which is what the store page
  // has always done.
  return copyLink(request.url);
}

/**
 * Copy to the clipboard — the fallback for a platform with no share sheet.
 *
 * Module-private: `shareLink` is the entry point, and a caller that reached for
 * this directly would be choosing the web behaviour on a device that has the
 * better one. Export it when something genuinely wants a copy button *beside* a
 * share button.
 *
 * The Capacitor plugin is preferred on a device because `navigator.clipboard`
 * needs a secure context and a user gesture the WebView does not always agree
 * it had. On the web it is the plugin's own fallback anyway.
 */
async function copyLink(url: string): Promise<ShareOutcome> {
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
