"use client";
import { useEffect, useRef, useState } from "react";
import { HONOR_REDUCED_MOTION } from "@/lib/reduced-motion";
import type { SceneTier } from "./config";

/**
 * Resolve the render fidelity on the client. Returns `null` until mounted so the
 * server and first client render agree (the scene renders nothing until then,
 * which is invisible for a background layer and avoids hydration mismatch).
 *
 *  • prefers-reduced-motion  → "still"  (only when HONOR_REDUCED_MOTION)
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
      if (HONOR_REDUCED_MOTION && reduce.matches) return setTier("still");
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
 * Scroll-driven rotation for the radar, with zero React re-renders.
 *
 * The scene's rotation is a *pure function of scroll position*: the target angle
 * is `scrollY × degPerPx`, so scrolling down turns it clockwise, scrolling up
 * turns it back anticlockwise through exactly the same states, and it holds
 * still whenever the page does. A single rAF lerps toward that target so the
 * radar spins up and glides to a stop instead of snapping frame to frame.
 *
 * Three custom properties are written on `el` (inherited by the whole scene):
 *
 *  • `--orb-angle` — accumulated degrees; each rotating node multiplies it by
 *                    its own `--rate`.
 *  • `--orb-p`     — scroll progress 0–1, driving the chip reveal. Left unset
 *                    when this hook doesn't run, and the CSS falls back to 1
 *                    (fully composed scene) for the reduced-motion tier.
 *  • `--orb-drive` — 0–1 "how fast are we turning right now", for the glow lift.
 *
 * `degPerPx` is the coupling strength; 0 disables the hook.
 */
export function useScrollDrive(
  ref: React.RefObject<HTMLElement | null>,
  degPerPx: number
) {
  const raf = useRef(0);
  const running = useRef(false);
  const target = useRef({ angle: 0, p: 0 });
  const current = useRef({ angle: 0, p: 0, drive: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el || degPerPx <= 0) return;

    const write = () => {
      const c = current.current;
      el.style.setProperty("--orb-angle", c.angle.toFixed(2));
      el.style.setProperty("--orb-p", c.p.toFixed(4));
      el.style.setProperty("--orb-drive", c.drive.toFixed(3));
    };

    const read = () => {
      const y = window.scrollY;
      const max = Math.max(
        document.documentElement.scrollHeight - window.innerHeight,
        1
      );
      target.current.angle = y * degPerPx;
      target.current.p = Math.min(Math.max(y / max, 0), 1);
    };

    const tick = () => {
      const c = current.current;
      const t = target.current;
      const lag = t.angle - c.angle;
      c.angle += lag * 0.12;
      c.p += (t.p - c.p) * 0.12;
      // Remaining lag is a good proxy for scroll velocity; ~12° of lag reads as
      // "turning hard". Fades to 0 on its own once the page stops moving.
      c.drive = Math.min(Math.abs(lag) / 12, 1);
      // Settle: snap onto the target and stop the loop.
      if (Math.abs(lag) < 0.02 && Math.abs(t.p - c.p) < 0.0005) {
        c.angle = t.angle;
        c.p = t.p;
        c.drive = 0;
        write();
        running.current = false;
        return;
      }
      write();
      raf.current = requestAnimationFrame(tick);
    };

    const kick = () => {
      if (running.current || document.hidden) return;
      running.current = true;
      raf.current = requestAnimationFrame(tick);
    };
    const onScroll = () => {
      read();
      kick();
    };
    const onVisibility = () => {
      if (document.hidden) {
        running.current = false;
        cancelAnimationFrame(raf.current);
      } else {
        onScroll();
      }
    };

    // Seed from the current position so a reload part-way down the page paints
    // the scene already turned, instead of animating in from zero.
    read();
    current.current.angle = target.current.angle;
    current.current.p = target.current.p;
    write();

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf.current);
      running.current = false;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [ref, degPerPx]);
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
