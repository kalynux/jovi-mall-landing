"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/lib/auth/useAuth";

/**
 * The thin progress line the app shows while it works out who the shopper is.
 *
 * ── What it is for, and what it deliberately is NOT ──────────────────────────
 *
 * There is exactly one thing between the splash and a usable storefront:
 * `AuthProvider` hydrating the stored bearer pair and answering `GET /auth/me`.
 * Fetching products is not part of it — the catalogue loads afterwards behind
 * the shop's own skeletons, which are a better loading state than anything a
 * shell can draw because they are the shape of the content.
 *
 * So this covers that one gap and nothing else, and it covers it with a 3px
 * line rather than a screen. An earlier version was a full-bleed green field
 * with pulsing dots; it worked, but it hid a storefront that was already
 * painted and ready underneath, which is a worse trade than the flash it was
 * avoiding.
 *
 * ── Why the splash cannot do this job ────────────────────────────────────────
 *
 * It used to. `launchAutoHide` was off and the splash stayed until the session
 * resolved, which put the only exit from the launch screen inside the
 * JavaScript bundle — as was the 25s "failsafe" beside it, a `setTimeout`.
 *
 * A bundle that never runs therefore had no way out. Observed exactly that on
 * an API-29 emulator whose WebView never got a GL surface: it never requested a
 * single path, and the app held its logo indefinitely with no error and no
 * recovery. The splash is now dismissed by Android on a 200ms timer
 * (capacitor.config.ts) and this takes over.
 *
 * ── It gets out of the way even if nothing else works ────────────────────────
 *
 * Three independent exits, and the third is the point:
 *
 *   1. `status` leaves "loading" — the normal case, usually well under a second.
 *   2. `MAX_VISIBLE_MS`, in case the session never resolves.
 *   3. The `app-loading-giveup` animation in globals.css, which runs in the CSS
 *      engine and so survives a bundle that never executes. Without it a broken
 *      WebView would just trade a stuck splash for a stuck progress bar.
 *
 * It also does not appear at all for a fast restore: the entrance animation is
 * delayed ~150ms, so a session that resolves before then is never accompanied
 * by a flash of chrome.
 */
const MAX_VISIBLE_MS = 8_000;

export function AppLoading() {
  const { status } = useAuth();
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setExpired(true), MAX_VISIBLE_MS);
    return () => clearTimeout(timer);
  }, []);

  // Rendered by the locale layout, so this markup is in the exported HTML and
  // is painted with the WebView's first frame rather than after hydration.
  // `status` starts at "loading" on the server too, so the initial state here
  // is "showing" and there is no gap where the line is missing.
  const done = status !== "loading" || expired;

  return (
    // Decorative and non-interactive: the storefront underneath is the content,
    // and it is already usable while this is up.
    <div className="app-loading" data-done={done ? "true" : "false"} aria-hidden="true">
      <span className="app-loading__bar" />
    </div>
  );
}
