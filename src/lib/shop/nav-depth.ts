/**
 * How many steps back the shopper can take *inside this app*.
 *
 * The header's back arrow and Android's hardware back button ask the same
 * question — "is there anywhere to go back to?" — and the browser will not
 * answer it. `window.history.length` counts entries and never decreases, so
 * after shop → product → back it still reads 2; anything relying on it
 * concludes there is history when the stack is already rewound.
 *
 * There is no read-only signal for *position*, so the count is maintained here.
 *
 * ── Why this hooks `pushState` rather than watching `usePathname()` ──────────
 *
 * Counting pathname changes misses an entire class of navigation: **filters**.
 * `ShopBrowser` does `router.push("/shop?category=…")`, which pushes a real
 * history entry while leaving the pathname identical. Hooking the history
 * methods counts what actually happened — `pushState` adds an entry, `popstate`
 * consumes one, and `replaceState` does neither, which is exactly right: a
 * replace is not a step you can go back through.
 *
 * One installation, reference-counted, because two callers want it (the shop
 * chrome on every target, `NativeShell` on the app) and two independent patches
 * of `history.pushState` can restore each other's wrapper on unmount.
 */

let depth = 0;
let installs = 0;
let uninstall: (() => void) | null = null;

/** Start counting. Returns the matching teardown — call it once, on unmount. */
export function installNavDepth(): () => void {
  installs += 1;

  if (installs === 1) {
    const originalPush = window.history.pushState.bind(window.history);
    window.history.pushState = ((...args: Parameters<History["pushState"]>) => {
      originalPush(...args);
      depth += 1;
    }) as History["pushState"];

    const onPop = () => {
      depth = Math.max(0, depth - 1);
    };
    window.addEventListener("popstate", onPop);

    uninstall = () => {
      window.history.pushState = originalPush;
      window.removeEventListener("popstate", onPop);
    };
  }

  return () => {
    installs = Math.max(0, installs - 1);
    if (installs === 0) {
      uninstall?.();
      uninstall = null;
      depth = 0;
    }
  };
}

/** Steps available behind the current screen. Zero means "opened straight here". */
export function navDepth(): number {
  return depth;
}
