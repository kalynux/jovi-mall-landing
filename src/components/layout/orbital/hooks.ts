"use client";
import { useEffect, useRef, useState } from "react";
import type { SceneTier } from "./config";

/**
 * Resolve the render fidelity on the client. Returns `null` until mounted so the
 * server and first client render agree (the scene renders nothing until then,
 * which is invisible for a background layer and avoids hydration mismatch).
 *
 *  • prefers-reduced-motion  → "still"
 *  • coarse pointer OR < 768px → "lean"
 *  • otherwise                → "full"
 */
export function useSceneTier(): SceneTier | null {
  const [tier, setTier] = useState<SceneTier | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarse = window.matchMedia("(pointer: coarse)");
    const narrow = window.matchMedia("(max-width: 767px)");

    const resolve = () => {
      if (reduce.matches) return setTier("still");
      if (coarse.matches || narrow.matches) return setTier("lean");
      setTier("full");
    };

    resolve();
    reduce.addEventListener("change", resolve);
    coarse.addEventListener("change", resolve);
    narrow.addEventListener("change", resolve);
    return () => {
      reduce.removeEventListener("change", resolve);
      coarse.removeEventListener("change", resolve);
      narrow.removeEventListener("change", resolve);
    };
  }, []);

  return tier;
}

/**
 * Pointer parallax with zero React re-renders. A single rAF lerps the current
 * offset toward the pointer target and writes it to `--par-x` / `--par-y` on the
 * given element; the element's transform reads those vars. The loop only runs
 * while the pointer has moved recently and pauses with the tab, so it costs
 * nothing at rest.
 *
 * `travel` is the maximum offset in px at the screen edge; 0 disables it.
 */
export function useMouseParallax(
  ref: React.RefObject<HTMLElement | null>,
  travel: number
) {
  const raf = useRef(0);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const running = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || travel <= 0) return;
    // Fine pointers only — a coarse pointer has no hover to parallax against.
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const tick = () => {
      const c = current.current;
      const t = target.current;
      c.x += (t.x - c.x) * 0.08;
      c.y += (t.y - c.y) * 0.08;
      el.style.setProperty("--par-x", `${c.x.toFixed(2)}px`);
      el.style.setProperty("--par-y", `${c.y.toFixed(2)}px`);
      // Settle: stop the loop once we're essentially on target.
      if (Math.abs(t.x - c.x) < 0.05 && Math.abs(t.y - c.y) < 0.05) {
        running.current = false;
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    const kick = () => {
      if (running.current || document.hidden) return;
      running.current = true;
      raf.current = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      target.current.x = -(e.clientX / window.innerWidth - 0.5) * 2 * travel;
      target.current.y = -(e.clientY / window.innerHeight - 0.5) * 2 * travel;
      kick();
    };
    const onLeave = (e: PointerEvent) => {
      if (e.relatedTarget) return;
      target.current.x = 0;
      target.current.y = 0;
      kick();
    };
    const onVisibility = () => {
      if (document.hidden) {
        running.current = false;
        cancelAnimationFrame(raf.current);
      } else {
        kick();
      }
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerout", onLeave, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf.current);
      running.current = false;
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerout", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ref, travel]);
}

/**
 * True while the tab is hidden — used to pause CSS loops (animation-play-state)
 * so the scene draws nothing in a backgrounded tab.
 */
export function useTabHidden(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const onVisibility = () => setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  return hidden;
}
