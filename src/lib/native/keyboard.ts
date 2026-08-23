"use client";

import { isNative, withNative } from "@/lib/platform";

/**
 * Tell the stylesheet when the soft keyboard is up.
 *
 * ── Why the app has to know at all ───────────────────────────────────────────
 *
 * Below `md` the shop is an app shell, not a document: `.shop-shell` is exactly
 * one viewport tall with `overflow: hidden`, and the tab bar is its last flex
 * item. Both platforms shrink the WebView when the keyboard opens — on Android
 * that is Capacitor's own `SystemBars`, which pads the WebView's parent by the
 * IME inset; on iOS it is `Keyboard.resize` (see capacitor.config.ts). Either
 * way `100dvh` becomes the strip above the keys, the whole column is re-laid-out
 * inside it, and the tab bar — still the last item — comes to rest **on top of
 * the field being typed into**.
 *
 * Resizing is the right behaviour; the bar being in the column while it happens
 * is not. So the bar leaves the column for as long as the keyboard is up, the
 * way a native tab bar does, and the shell gives its height back to the pane.
 *
 * All of that is one attribute:
 *
 *     <html data-keyboard="open">
 *
 * consumed by `globals.css` — the tab bar hides, the toast drops to sit just
 * above the keys. Nothing reads a keyboard HEIGHT, and nothing should: the
 * viewport already ends at the top of the keyboard, so subtracting the height
 * again would count it twice.
 *
 * ── Events, not a heuristic ──────────────────────────────────────────────────
 *
 * The alternative — watching `visualViewport.resize` — cannot tell a keyboard
 * from a collapsing browser toolbar or a rotation, and fires for both. The
 * plugin reports the platform's own IME state, including the animation's start,
 * which is what lets the bar be gone before the keys have finished arriving.
 */

/** Set on `<html>` for exactly as long as the keyboard is on screen. */
const OPEN_ATTR = "data-keyboard";

let watching = false;

/**
 * Begin reflecting the keyboard's state onto `<html>`.
 *
 * Called once by `NativeShell`. Idempotent, and a no-op on the web, where there
 * is no plugin to ask and the browser handles its own keyboard.
 */
export async function startKeyboardWatch(): Promise<void> {
  if (watching || !isNative()) return;
  watching = true;

  await withNative(async () => {
    const { Keyboard } = await import("@capacitor/keyboard");
    const root = document.documentElement;

    const opened = () => root.setAttribute(OPEN_ATTR, "open");
    const closed = () => root.removeAttribute(OPEN_ATTR);

    /**
     * `will` rather than `did`, so the bar is out of the column while the
     * keyboard is still animating in and the two moves read as one. Both are
     * listened to anyway: on Android the pair is driven by the inset animation
     * callback, and a keyboard swapped for another (an IME switch, a password
     * field) can produce a `did` without a matching `will`.
     */
    await Keyboard.addListener("keyboardWillShow", opened);
    await Keyboard.addListener("keyboardDidShow", opened);
    await Keyboard.addListener("keyboardWillHide", closed);
    await Keyboard.addListener("keyboardDidHide", closed);

    /**
     * Bring the field back into view once the shell has been re-laid-out.
     *
     * Both platforms scroll the focused element into the visible area by
     * themselves, but they do it against the viewport as it was when focus
     * landed — before the tab bar left the column and gave ~60px back to the
     * pane. `block: "nearest"` makes this a correction rather than a second
     * scroll: an element already in view is not touched, so a field the
     * platform placed well does not jump.
     */
    await Keyboard.addListener("keyboardDidShow", () => {
      requestAnimationFrame(() => {
        const el = document.activeElement;
        if (!(el instanceof HTMLElement) || !isEditable(el)) return;
        el.scrollIntoView({ block: "nearest" });
      });
    });
  });
}

/** Is this the kind of element a keyboard was opened for? */
function isEditable(el: HTMLElement): boolean {
  return (
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    el.isContentEditable
  );
}
