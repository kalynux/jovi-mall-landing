"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "@/i18n/navigation";

/**
 * The shop's scroll container below `md` — see `.shop-shell-main` in
 * globals.css for why the pane exists at all.
 *
 * It owns one piece of behaviour the class cannot: scroll position. Next
 * restores scroll by driving `window`, and on mobile the window no longer
 * moves, so without this every navigation would land wherever the *previous*
 * page happened to be scrolled to. Offsets are remembered per route, which
 * gives the app-like result in both directions — a product page opens at the
 * top, and coming back lands on the row of the grid you left from.
 *
 * Above `md` the pane is not a scroller, `scrollTop` is always 0, and both
 * halves of this quietly do nothing.
 */
export function ShopScrollArea({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const offsets = useRef(new Map<string, number>());
  const pathname = usePathname();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Read once into the effect: the Map is created with the component and
    // never replaced, so the cleanup below is writing to the same object.
    const seen = offsets.current;
    el.scrollTop = seen.get(pathname) ?? 0;

    // Coalesced to one write per frame: a scroll event fires far more often
    // than the value is ever read.
    let frame = 0;
    const remember = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        seen.set(pathname, el.scrollTop);
      });
    };

    el.addEventListener("scroll", remember, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener("scroll", remember);
      // The last frame may never have run; record where the route was left.
      seen.set(pathname, el.scrollTop);
    };
  }, [pathname]);

  return (
    <div ref={ref} className="shop-shell-main">
      {children}
    </div>
  );
}
