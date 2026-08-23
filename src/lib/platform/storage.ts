/**
 * One key/value store, two implementations.
 *
 * On the web this is `localStorage`, which the app already uses for the
 * anonymous cart, the theme and the preferred country. On a device it is
 * Capacitor Preferences, which is `SharedPreferences` on Android and
 * `UserDefaults` on iOS — storage the OS backs up and does not clear when the
 * WebView's site data is purged. A WebView's `localStorage` is not a safe place
 * for a session that has to survive an OS storage sweep.
 *
 * ── Async, even on the web ───────────────────────────────────────────────────
 *
 * `localStorage` is synchronous and Preferences is not, so the shared interface
 * has to be the async one. That is why `getSync` exists beside `get`: the
 * places that already read `localStorage` during a render — the cart's first
 * paint, the theme bootstrap — cannot become async without introducing a flash,
 * and on the web they do not need to. `getSync` answers `null` on native rather
 * than pretending, so a caller that must work on both awaits `get`.
 *
 * ── Why the plugin is imported dynamically ───────────────────────────────────
 *
 * Same reason as `platform/index.ts` imports nothing: this module is reachable
 * from `lib/api/client.ts`, which is reachable from the server-rendered catalog
 * pages. A static import would put the Capacitor runtime in the web build's
 * server bundle. The `import()` below only ever evaluates on a device.
 */
import { isNative } from "./index";

type PreferencesPlugin = {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
};

/**
 * ── The plugin is BOXED, and that is not a style choice ──────────────────────
 *
 * This used to be `Promise<PreferencesPlugin>`, resolved with the plugin itself:
 *
 *     import("@capacitor/preferences").then((m) => m.Preferences)   // broken
 *
 * Resolving a promise WITH an object makes JavaScript probe that object for a
 * `.then` property, to decide whether it is a thenable to be assimilated.
 * Capacitor's plugin objects are Proxies that answer *every* property access by
 * returning a callable that forwards to native — so the probe found a `then`,
 * JavaScript called it, and Capacitor dutifully asked Android to run a plugin
 * method named `then`:
 *
 *     Preferences.then() is not implemented on android
 *
 * The promise then never settled correctly, so `get`/`set`/`remove` rejected —
 * every one of them, on every device. That took out session persistence
 * (`token-store.hydrate()`), and through it the splash screen, which waits on
 * the session and therefore waited forever.
 *
 * Boxing the plugin in a plain object hides it from the thenable check. Do not
 * "simplify" this back into returning the plugin directly, and do not make this
 * an `async` function that returns it either — an async return is assimilated
 * exactly the same way.
 */
let preferencesPromise: Promise<{ plugin: PreferencesPlugin }> | null = null;

/** Loaded once, then reused — `import()` caches, but the promise makes it explicit. */
function preferences(): Promise<{ plugin: PreferencesPlugin }> {
  preferencesPromise ??= import("@capacitor/preferences").then((m) => ({ plugin: m.Preferences }));
  return preferencesPromise;
}

export async function get(key: string): Promise<string | null> {
  if (isNative()) {
    const { plugin } = await preferences();
    const { value } = await plugin.get({ key });
    return value;
  }
  return getSync(key);
}

export async function set(key: string, value: string): Promise<void> {
  if (isNative()) {
    const { plugin } = await preferences();
    await plugin.set({ key, value });
    return;
  }
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private browsing, or a quota that is already full. A preference that
    // cannot be written is not worth failing the action that triggered it.
  }
}

export async function remove(key: string): Promise<void> {
  if (isNative()) {
    const { plugin } = await preferences();
    await plugin.remove({ key });
    return;
  }
  try {
    window.localStorage.removeItem(key);
  } catch {
    // As above.
  }
}

/**
 * The synchronous read, for first-paint code that cannot await.
 *
 * Returns `null` on native and during SSR — both of which mean "ask `get`
 * instead". Never treat a `null` from here as "no stored value".
 */
export function getSync(key: string): string | null {
  if (typeof window === "undefined" || isNative()) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
