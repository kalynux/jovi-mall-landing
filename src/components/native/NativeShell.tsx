"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { IS_NATIVE_BUILD, isNative, platform, withNative } from "@/lib/platform";
import { useTheme } from "@/lib/theme";
import { SHOP_ROOT, normalizePath } from "@/lib/shop/shop.routes";
import { resolveDeepLink, toInAppPath } from "@/lib/shop/deep-link";
import { installNavDepth, navDepth } from "@/lib/shop/nav-depth";
import { startNetworkWatch } from "@/lib/native/network";
import { startKeyboardWatch } from "@/lib/native/keyboard";

/**
 * The native shell's behaviour, in one mounted component.
 *
 * Renders nothing. It exists because a handful of things a phone expects — a
 * back button that goes back, a status bar that matches the theme, a keyboard
 * that does not shove the tab bar over the field being typed into — have no
 * equivalent on the web and no natural home in any single screen.
 *
 * It no longer owns the splash. Dismissing it is Android's job now
 * (`launchAutoHide`), and what the shopper sees next is
 * `components/native/AppLoading` — because anything that gates the UI on this
 * bundle having run can pin the app when the bundle does not. See session 6 of
 * MOBILE-APP-PLAN.md.
 *
 * ── It is inert everywhere but a device ──────────────────────────────────────
 *
 * Every effect returns early unless `IS_NATIVE_BUILD`, which is a compile-time
 * constant, so the whole body is dropped from the web bundle. `isNative()` then
 * guards again at runtime, because the native build is also what `dev:native`
 * serves to a desktop browser, where there is no bridge to call.
 *
 * Plugins are imported dynamically for the same reason `lib/platform` imports
 * nothing statically: this component is mounted from the locale layout, which
 * is a server component in the web build, and a static import would put the
 * Capacitor runtime in a bundle that has no use for it.
 */
export function NativeShell() {
  const router = useRouter();
  const pathname = usePathname();
  const { theme } = useTheme();

  // ── Splash ─────────────────────────────────────────────────────────────────
  /**
   * A fast path, not the mechanism.
   *
   * The splash is dismissed by the native layer on its own short timer —
   * `launchAutoHide` in capacitor.config.ts, which is Android code and does not
   * depend on this bundle running. That is the guarantee, and the long comment
   * explaining why lives at the setting itself.
   *
   * This call only shortens the wait when JavaScript happens to be ready first,
   * so that the handoff to `AppLoading` is immediate rather than sitting out
   * the remainder of the timer. It runs once, on mount, and is deliberately NOT
   * gated on the session: gating the only exit on state is precisely what
   * pinned this screen twice before.
   */
  useEffect(() => {
    if (!IS_NATIVE_BUILD) return;

    void withNative(async () => {
      const { SplashScreen } = await import("@capacitor/splash-screen");
      await SplashScreen.hide();
    });
  }, []);

  // ── Status bar ─────────────────────────────────────────────────────────────
  /**
   * The bar overlays the WebView (see capacitor.config.ts), so the page paints
   * underneath it. All that is set here is the content colour, which has to
   * follow the app's own theme rather than the OS's — the shop has a theme
   * toggle, and a shopper who picks dark inside a phone set to light would
   * otherwise get black icons on the dark header.
   *
   * `overlaysWebView: true` needs the stylesheet to reserve the strip itself,
   * and it does: `.shop-header` and `.auth-frame` both pad by `--sa-top`, which
   * is `env(safe-area-inset-top)` and Capacitor's injected inset, whichever is
   * reporting. See the note on it in globals.css — on Android `env()` alone is
   * not enough to rely on.
   *
   * `Style.Dark` means light content for a dark background, which reads
   * backwards and is the plugin's naming, not ours.
   */
  useEffect(() => {
    if (!IS_NATIVE_BUILD) return;

    void withNative(async () => {
      const { StatusBar, Style } = await import("@capacitor/status-bar");
      await StatusBar.setStyle({ style: theme === "dark" ? Style.Dark : Style.Light });
    });
  }, [theme]);

  // ── Connectivity ───────────────────────────────────────────────────────────
  /**
   * Give `isNetworkError` the platform's own answer instead of
   * `navigator.onLine`, which in an Android WebView reports `true` for Wi-Fi
   * with no internet behind it and for a mobile connection out of data — both
   * ordinary here. Registered once; the module ignores repeat calls.
   */
  useEffect(() => {
    if (!IS_NATIVE_BUILD) return;
    void startNetworkWatch();
  }, []);

  // ── Which device this is ───────────────────────────────────────────────────
  /**
   * `<html data-platform="android">`, so the stylesheet can carry a rule that
   * is only true on one platform without any component having to branch.
   *
   * There is exactly one such rule today and it is the reason this exists: the
   * tab bar's minimum clearance for Android's gesture pill. Android does not
   * always report that strip to the WebView as an inset — see the note on
   * `--sa-bottom` in globals.css — and iOS always does, so a floor that is
   * right on one is dead space on the other (an iPhone SE has no home
   * indicator and no inset, and would get a 24px band under the tabs for
   * nothing).
   */
  useEffect(() => {
    if (!IS_NATIVE_BUILD || !isNative()) return;

    const root = document.documentElement;
    root.setAttribute("data-platform", platform());
    return () => root.removeAttribute("data-platform");
  }, []);

  // ── Keyboard ───────────────────────────────────────────────────────────────
  /**
   * Puts `data-keyboard="open"` on `<html>` while the keyboard is up, which is
   * what takes the tab bar out of the shell column before it can settle over
   * the field being typed into. See `lib/native/keyboard.ts` — the whole
   * reason the shell cannot simply be left to the platform's resize is there.
   */
  useEffect(() => {
    if (!IS_NATIVE_BUILD) return;
    void startKeyboardWatch();
  }, []);

  // ── Hardware back ──────────────────────────────────────────────────────────
  /**
   * Android's back button closes the app from any screen unless something
   * claims it. Three behaviours, in order:
   *
   *   1. There is history — go back, which is what the gesture means.
   *   2. There is no history but we are deeper than the storefront — go to the
   *      storefront. This is the case that matters: a deep link from a push
   *      notification opens a product page with an empty history, and exiting
   *      from there feels like a crash.
   *   3. We are at the storefront with nothing behind us — leave.
   *
   * The plugin's own `canGoBack` cannot answer step 1: it reports the
   * WebView's navigation stack, which a client-side router never touches. So
   * the count comes from `lib/shop/nav-depth`, which the shop's own back arrow
   * also reads — that file explains why it is maintained by hand at all.
   */
  useEffect(() => {
    if (!IS_NATIVE_BUILD) return;
    return installNavDepth();
  }, []);

  useEffect(() => {
    if (!IS_NATIVE_BUILD || !isNative()) return;

    let remove: (() => void) | undefined;

    void (async () => {
      const { App } = await import("@capacitor/app");
      const handle = await App.addListener("backButton", () => {
        // 1. Somewhere to step back to.
        if (navDepth() > 0) {
          window.history.back();
          return;
        }
        // 2. Opened straight onto a deep link — exiting from a product page
        //    the shopper never navigated to reads as a crash.
        if (normalizePath(pathname) !== SHOP_ROOT) {
          router.replace(SHOP_ROOT);
          return;
        }
        // 3. At the storefront with nothing behind us.
        void App.exitApp();
      });
      remove = () => void handle.remove();
    })();

    return () => remove?.();
  }, [pathname, router]);

  // ── Deep links ─────────────────────────────────────────────────────────────
  /**
   * Everything that opens the app from outside it lands here: the magic sign-in
   * link a customer taps in WhatsApp, an order notification, a shared product
   * URL.
   *
   * Both forms are accepted. `https://wi-mall.com/...` arrives when Android App
   * Links or iOS Universal Links are verified for the domain; `wimall://...` is
   * the custom scheme that works without that verification and is what the
   * payment return uses. Either way only the path and query survive the hop —
   * the host is discarded, so a link to another site cannot steer the app.
   *
   * The path is then re-shaped for this build before it is followed, because
   * the links are the website's: `/shop/account/support/<id>` is a page on the
   * web and a file the static export never wrote, so following it as it came
   * opened "Webpage not available" in place of the app. `resolveDeepLink`
   * translates it to the app's own shape (`/shop/account/ticket?id=<id>`)
   * through the same table the notification inbox uses, and drops any locale
   * the link carries.
   *
   * The result goes to the locale-aware router, which prefixes it for the
   * language in use. A magic link minted for a French customer therefore opens
   * `/fr/login/magic?t=…` even though the link itself carries no locale.
   */
  useEffect(() => {
    if (!IS_NATIVE_BUILD || !isNative()) return;

    let remove: (() => void) | undefined;

    void (async () => {
      const { App } = await import("@capacitor/app");
      const handle = await App.addListener("appUrlOpen", ({ url }) => {
        const path = toInAppPath(url);
        if (path) router.replace(resolveDeepLink(path));
      });
      remove = () => void handle.remove();
    })();

    return () => remove?.();
  }, [router]);

  return null;
}
