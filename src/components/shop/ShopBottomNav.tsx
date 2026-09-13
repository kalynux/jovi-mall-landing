"use client";

import { useTranslations } from "next-intl";

import { useEffect, useRef } from "react";
import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import { useCart, useFavorites } from "@/components/shop/providers";
import { Icon } from "@/components/shop/ds";
import { normalizePath } from "@/lib/shop/shop.routes";
import { SHOP_TABS } from "@/lib/shop/shop.pages";

/**
 * Mobile-only bottom tab bar.
 *
 * Deliberately **not** `position: fixed`. It is the last flex item of the app
 * shell, which pins it to the bottom of a container that is exactly one
 * viewport tall — so it cannot drift sideways with a horizontal pan, and cannot
 * be pushed out of frame by the browser's collapsing toolbar the way a fixed
 * bar is. `flex-none` keeps it at its own height when the pane above is long.
 *
 * Being in the column is also why it has to LEAVE the column when the keyboard
 * opens — the platform shrinks the viewport to make room, the column is
 * re-laid-out inside the strip that is left, and the last item lands on the
 * field. That is `[data-keyboard="open"] .shop-tabbar` in globals.css; the
 * `shop-tabbar` class below is what it hooks onto.
 */
export function ShopBottomNav() {
  // Root-scoped: the lib modules emit absolute keys (`shop.status.…`).
  const tKey = useTranslations();
  const pathname = usePathname();
  const { count: cartCount } = useCart();
  const { count: favCount } = useFavorites();
  const ref = useRef<HTMLElement>(null);

  /**
   * Publish the bar's real height as `--tabbar-h`, for the toast to sit above.
   *
   * It cannot be a constant. The height is a font-size, an icon, a label and a
   * safe-area inset that is only known on the device — and the toast used to
   * clear a hard-coded 72px that was a guess at the sum. At a large system font
   * size the bar grows past it and the toast lands on the Cart tab it is
   * usually reporting about, which is exactly the moment a shopper is looking
   * at the tabs.
   *
   * A ResizeObserver rather than a one-off measure: the value changes with the
   * font scale, with a rotation, and with the inset itself — Android reports 0
   * for the bottom inset while the keyboard is up. It reports 0 for a hidden
   * element too, which is the right answer both above `md` (where the bar is
   * `md:hidden`) and while the keyboard is open.
   */
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const root = document.documentElement;
    const publish = () => root.style.setProperty("--tabbar-h", `${el.offsetHeight}px`);

    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(el);

    return () => {
      observer.disconnect();
      // A route without a tab bar has nothing for the toast to clear, and the
      // 72px fallback in the stylesheet would leave it floating.
      root.style.setProperty("--tabbar-h", "0px");
    };
  }, []);

  const badgeFor = (href: string) =>
    href === "/shop/cart" ? cartCount : href === "/shop/saved" ? favCount : 0;

  return (
    <nav
      ref={ref}
      className="shop-tabbar z-[200] flex flex-none md:hidden"
      style={{
        background: "var(--surface)",
        borderTop: "1px solid var(--border)",
        /**
         * The bottom padding is the home indicator's, and it comes from two
         * places because on Android neither alone is enough.
         *
         * `--sa-bottom` is `env()` and Capacitor's injected inset, whichever is
         * reporting — see globals.css. `--tabbar-floor` is a minimum, set to
         * 24px for Android only by `NativeShell`: the gesture pill overlays the
         * bottom ~24dp of the screen and an Android WebView too old to have
         * insets passed through to it reports that strip as 0, which puts the
         * pill straight over the tab labels. iOS reports 34px and wins the
         * `max()` on its own — and an iPhone with no home indicator reports 0
         * and correctly gets no band, which is why the floor is not global.
         */
        padding: "6px 6px max(calc(6px + var(--sa-bottom, 0px)), var(--tabbar-floor, 0px))",
      }}
    >
      {SHOP_TABS.map((it) => {
        // Normalised: the app build serves "/shop/" and would otherwise never
        // mark a tab active. See `normalizePath`.
        const here = normalizePath(pathname);
        const active = it.href === "/shop" ? here === "/shop" : here.startsWith(it.href);
        const badge = badgeFor(it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className="relative flex flex-1 flex-col items-center gap-1 py-1.5"
            style={{ color: active ? "var(--brand-hover)" : "var(--text-muted)", fontSize: 10.5, fontWeight: 700 }}
          >
            <span className="relative">
              <Icon
                name={it.icon}
                size={22}
                strokeWidth={active ? 2.4 : 2}
                style={active && it.icon === "heart" ? { fill: "currentColor" } : undefined}
              />
              {badge > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -8,
                    background: "var(--danger)",
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 800,
                    minWidth: 15,
                    height: 15,
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 3px",
                    border: "2px solid var(--surface)",
                  }}
                >
                  {badge}
                </span>
              )}
            </span>
            {tKey(it.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
}
