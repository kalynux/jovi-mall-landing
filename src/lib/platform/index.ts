/**
 * Where the code is running, and what it is allowed to assume.
 *
 * ── Why this file imports nothing from Capacitor ─────────────────────────────
 *
 * It would be natural to `import { Capacitor } from "@capacitor/core"` here. It
 * is also wrong, and the reason is a dependency chain: `lib/api/client.ts` needs
 * the token store, the token store needs to know whether it is native, and
 * `lib/shop/catalog.api.ts` imports `API_BASE` from that same client — and
 * `catalog.api.ts` is what the server-rendered catalog, store and product pages
 * call. A static import here therefore drags the whole Capacitor runtime into
 * the *server* bundle of the web build, which neither needs it nor can use it.
 *
 * So detection reads the bridge off the global object instead. On a device the
 * native shell injects `window.Capacitor` before any of our JavaScript runs; in
 * a browser nothing injects it and every check below answers "web". Plugins are
 * reached by `await import()` from inside a native-only branch, so no Capacitor
 * module is ever evaluated on a machine that has no bridge.
 *
 * ── Two different questions ──────────────────────────────────────────────────
 *
 * `APP_TARGET` is a **build-time** fact: which of the two builds produced this
 * bundle. It decides route shape and whether a page is server- or client-
 * rendered, and it is inlined by the compiler, so a `false` branch is dropped
 * from the web bundle entirely.
 *
 * `isNative()` is a **runtime** fact: is there a bridge here right now. The
 * native build is also what runs in a plain browser during `next dev`, so these
 * two disagree constantly and using the wrong one is the bug this comment
 * exists to prevent. Rule of thumb: choosing a *route* or a *render strategy*
 * asks `APP_TARGET`; calling a *device API* asks `isNative()`.
 */

export type AppTarget = "web" | "native";

export type PlatformName = "web" | "ios" | "android";

/**
 * Which build this is. Set by `scripts/build-native.mjs`; unset everywhere else,
 * so the web build and `next dev` both read "web" without configuring anything.
 */
export const APP_TARGET: AppTarget =
  process.env.NEXT_PUBLIC_APP_TARGET === "native" ? "native" : "web";

/** True in the bundle Capacitor wraps. Statically known — safe to branch on. */
export const IS_NATIVE_BUILD = APP_TARGET === "native";

/** The shape of the bridge the native shell injects. Only what we call. */
interface CapacitorBridge {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
}

function bridge(): CapacitorBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorBridge }).Capacitor;
}

/**
 * Is there a native shell around this WebView right now?
 *
 * False during SSR, false in a desktop browser, false when the native build is
 * served by `next dev` — and true only on a real device or simulator. Every
 * device API call must be behind this.
 */
export function isNative(): boolean {
  return bridge()?.isNativePlatform?.() === true;
}

/** `"ios"`, `"android"`, or `"web"` for everything else including SSR. */
export function platform(): PlatformName {
  const name = bridge()?.getPlatform?.();
  return name === "ios" || name === "android" ? name : "web";
}

export function isIOS(): boolean {
  return platform() === "ios";
}

export function isAndroid(): boolean {
  return platform() === "android";
}

/**
 * Run `fn` only when a bridge is present, and never let a plugin failure reach
 * the caller.
 *
 * Every native call in this app is an enhancement over something the web
 * already does — a share sheet instead of a clipboard write, haptics instead of
 * nothing. A plugin that is missing, denied or throwing must degrade to the web
 * behaviour rather than break the screen, so this returns `undefined` on any
 * failure and the caller falls back.
 *
 * It deliberately does not swallow the error silently in development, where a
 * misconfigured plugin is something you want to see.
 */
export async function withNative<T>(fn: () => Promise<T>): Promise<T | undefined> {
  if (!isNative()) return undefined;
  try {
    return await fn();
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[platform] native call failed, falling back to web:", err);
    }
    return undefined;
  }
}
