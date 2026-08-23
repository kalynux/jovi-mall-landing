import { readFileSync } from "node:fs";

import type { CapacitorConfig } from "@capacitor/cli";
/**
 * Type-only, deliberately. Importing `@capacitor/keyboard` for the value would
 * pull `@capacitor/core` into the Node process that evaluates this file during
 * `cap sync`, for one string. The import is not decorative either: it is what
 * brings the plugin's `declare module "@capacitor/cli"` augmentation into
 * scope, so the `Keyboard` block below is typechecked at all rather than
 * landing in `PluginsConfig`'s index signature unread.
 */
import type { KeyboardResize } from "@capacitor/keyboard";

/**
 * The native shell's configuration.
 *
 * `webDir` is `out/`, which only exists after `npm run build:native` — the
 * static export of the shop plus the auth routes. `npx cap sync` copies that
 * directory into both platform projects, so a build always precedes a sync.
 *
 * ── The origin is a deliberate choice, not a default ─────────────────────────
 *
 * `androidScheme: "https"` makes the WebView origin `https://localhost` rather
 * than `http://localhost`. That is the production setting, and it is why the
 * API talks to this app over bearer tokens instead of cookies —
 * `https://localhost` is a different site to `api.wi-mall.com`, so a
 * `SameSite=Lax` cookie is never sent. See `src/lib/auth/token-store.ts`.
 *
 * Development against a cleartext API drops to `http://localhost`; the reason
 * is at the setting itself, below.
 *
 * All three origins must be listed in the API's `ALLOWED_ORIGINS`:
 *   https://localhost        (Android, production)
 *   http://localhost         (Android, cleartext dev API)
 *   capacitor://localhost    (iOS)
 */
/**
 * Is this build pointed at a plain-HTTP API?
 *
 * Reads the same `.env.mobile` the app build reads, rather than
 * `process.env`: `npx cap sync` is its own process and does not inherit what
 * `build:native` set. `.env.local` is the legacy fallback, for the same reason
 * `scripts/build-native.mjs` still checks it.
 */
function usesCleartextApi(): boolean {
  for (const file of [".env.mobile", ".env.local"]) {
    try {
      const match = readFileSync(file, "utf8").match(/^\s*NATIVE_API_URL\s*=\s*(.*)$/m);
      const url = match?.[1].replace(/\s+#.*$/, "").trim().replace(/^["']|["']$/g, "");
      if (url) return url.startsWith("http://");
    } catch {
      // No such file — try the next one.
    }
  }
  return false;
}

const config: CapacitorConfig = {
  appId: "com.wimall.shop",
  appName: "Wi-Mall",
  webDir: "out",

  android: {
    // See the note above — this is a security setting, not cosmetics.
    buildOptions: {},

    /**
     * ── Cleartext API in development only ───────────────────────────────────
     *
     * The page is served from `https://localhost` (above), so a request to a
     * `http://` API is MIXED CONTENT and Chromium blocks it outright — the
     * request never leaves the device and `fetch` rejects with a bare
     * "Failed to fetch". Android's network security config does not help:
     * that permits cleartext at the OS layer, and this block happens a layer
     * above it, inside the WebView.
     *
     * That is not a hypothetical either — it is why the shop could not load a
     * single product on a real device while the API was on a tailnet.
     *
     * So the exception is tied to its own cause rather than left on: it is
     * enabled only when the app is actually pointed at a cleartext API, which
     * is only ever true in development. Point `NATIVE_API_URL` at
     * `https://api.wi-mall.com` and this turns itself off — there is no
     * separate production switch to forget.
     */
    allowMixedContent: usesCleartextApi(),
  },

  server: {
    /**
     * ── https in production, http against a cleartext dev API ────────────────
     *
     * Production is `https://localhost` and nothing below changes that.
     *
     * A development build talking to a plain-HTTP API is a different problem.
     * `allowMixedContent` (above) buys back `fetch`, but it does NOT stop
     * Chrome AUTO-UPGRADING mixed images: an `<img src="http://...">` on an
     * https page is silently re-requested as https, and when the dev API has
     * no TLS that fails and the image is simply gone. Every product photo in
     * the shop disappeared this way, while `fetch` to the same host returned
     * 200 — which is what makes it confusing to diagnose.
     *
     * Matching the page scheme to the API scheme removes the mismatch at its
     * source rather than fighting it. `http://localhost` is still a SECURE
     * CONTEXT by specification — trustworthy-origin rules exempt loopback — so
     * geolocation and the clipboard keep working, which is the reason https
     * was chosen in the first place.
     *
     * The cost is a dev/production parity gap in the origin, and one entry in
     * the API's ALLOWED_ORIGINS (`http://localhost`). Both are deliberate.
     */
    androidScheme: usesCleartextApi() ? "http" : "https",
    /**
     * Hosts the WebView may navigate to **in place** rather than handing to the
     * system browser.
     *
     * Empty on purpose. Everything outbound — Stripe's hosted checkout, a
     * WhatsApp deep link, the marketing pages the Account screen links to —
     * goes through `@capacitor/browser`, so the app never navigates away from
     * its own origin. A WebView that has left `https://localhost` has also left
     * the bundle, and the back gesture out of it is not ours to control.
     */
    allowNavigation: [],
  },

  plugins: {
    SplashScreen: {
      /**
       * ── The splash leaves on ANDROID's timer, not on ours ──────────────────
       *
       * This used to be `launchAutoHide: false`, with `NativeShell` calling
       * `SplashScreen.hide()` once the session resolved. The reasoning was
       * sound — hiding earlier flashes a signed-out storefront that then swaps
       * under the shopper — but it put the only exit from the launch screen
       * inside the JavaScript bundle, and so did the 25s "failsafe" added next
       * to it, which was a `setTimeout`.
       *
       * A bundle that never runs therefore had no way out. Observed exactly
       * that on an API-29 emulator: the WebView failed to get a GL surface
       * ("eglChooseConfig failed"), never requested a single path, and the app
       * held its logo indefinitely with no error and no recovery.
       *
       * `launchAutoHide` is enforced by the plugin's own Android code, which a
       * broken WebView cannot take down. The signed-out flash it was avoiding
       * is now covered properly by `components/native/AppLoading` — a real
       * loading screen with an animation, which is also what a person expects
       * to see while an app starts, rather than a logo that looks frozen.
       *
       * `launchShowDuration` is short on purpose. It is not a brand moment; it
       * only has to outlast the WebView's first paint so the handoff does not
       * flicker.
       */
      launchAutoHide: true,
      launchShowDuration: 200,
      launchFadeOutDuration: 200,
      backgroundColor: "#068554",
      androidSpinnerStyle: "small",
      spinnerColor: "#FFFFFF",
    },

    /**
     * ── The keyboard resizes the viewport, and the app gets out of its way ───
     *
     * This used to say `resize: "body"`, to stop the viewport shrinking at all.
     * The reasoning was sound — the tab bar is the last flex item of a `100dvh`
     * shell, so a viewport that shrinks re-lays-out the whole column into the
     * strip above the keyboard and leaves the bar sitting on the field — but
     * neither half of the setting could deliver it:
     *
     *   `resize` is iOS-ONLY. The plugin's own docs say so; it was never doing
     *   anything on Android, which is where this app is tested.
     *
     *   `resizeOnFullScreen` is dead on Capacitor 8. Its workaround bails the
     *   moment the built-in `SystemBars` plugin is present, and that plugin
     *   ships inside `@capacitor/android` — so it is ALWAYS present. SystemBars
     *   then pads the WebView's parent by the IME inset itself, which shrinks
     *   the viewport regardless of anything set here.
     *
     * So the viewport shrinks on Android whatever this file says, and `"body"`
     * only made iOS behave differently from it — the shell overflowing a
     * shortened `body` instead, with the field left under the keys.
     *
     * `native` matches iOS to what Android already does: one shrinking
     * viewport, one layout rule. The bar's own problem is then solved where it
     * belongs — it leaves the column while the keyboard is up, the way a native
     * tab bar does. See `src/lib/native/keyboard.ts`.
     *
     * `resizeOnFullScreen` stays true: it costs nothing while SystemBars is
     * handling this, and it is the correct fallback if that ever stops.
     */
    Keyboard: {
      resize: "native" as KeyboardResize,
      resizeOnFullScreen: true,
    },

    StatusBar: {
      // The shop header paints its own surface and the shell already applies
      // `env(safe-area-inset-*)`, so the status bar sits over the page rather
      // than stealing a strip of it.
      overlaysWebView: true,
      style: "DEFAULT",
    },
  },
};

export default config;
