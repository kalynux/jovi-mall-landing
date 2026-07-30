"use client";
import { useEffect, useRef } from "react";

/**
 * InteractiveNetwork — the "one platform, every role, connected" motif as a live
 * background: emerald nodes joined by thin links that drift slowly, gather toward
 * the cursor, link straight to it, and parallax as the mouse moves.
 *
 * Performance-first (this ships to entry-level phones on 2G/3G):
 *  • Canvas 2D, DPR capped at 2, node count scales with area and is capped hard
 *    (fewer on coarse-pointer devices).
 *  • prefers-reduced-motion is deliberately NOT honoured here — product call,
 *    made knowing this is a full-viewport moving field and that the preference
 *    is often set for vestibular reasons. To reinstate it, gate the drift in
 *    step() (and the parallax) on a matchMedia("(prefers-reduced-motion:
 *    reduce)") check; the pointer interaction is fine to leave running.
 *  • Touch → nodes gather toward and link to the finger while it's on screen,
 *    releasing when it lifts. Same interaction as the mouse, no hover assumed.
 *  • Pauses entirely when the tab is hidden. Never intercepts pointer events
 *    (canvas is pointer-events-none, listeners are passive → page still scrolls).
 */
export default function InteractiveNetwork() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;
    const cv = canvas; // non-null captures so nested closures keep the narrowed type
    const c = ctx;

    const coarse = window.matchMedia("(pointer: coarse)");

    const CONNECT = 132; // node-to-node link distance (CSS px)
    const CURSOR_R = 178; // cursor influence radius

    type Node = { x: number; y: number; vx: number; vy: number; r: number };
    const nodes: Node[] = [];
    let w = 0;
    let h = 0;

    const mouse = { x: -9999, y: -9999, active: false };
    let paX = 0;
    let paY = 0;
    let paTX = 0;
    let paTY = 0;
    let dark = false;

    const rand = (a: number, b: number) => a + Math.random() * (b - a);

    // Drift speed in CSS px/frame (~60fps). Picked as a direction + a magnitude
    // with a floor rather than two independent ranges: uniform vx/vy around zero
    // leaves a good share of nodes at a near-zero vector, and those read as
    // frozen next to their moving neighbours.
    const SPEED_MIN = 0.22;
    const SPEED_MAX = 0.55;

    const makeNode = (): Node => {
      const angle = Math.random() * Math.PI * 2;
      const speed = rand(SPEED_MIN, SPEED_MAX);
      return {
        x: rand(0, w),
        y: rand(0, h),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        r: rand(1.1, 2.4),
      };
    };

    /**
     * Sizes the backing store, then reconciles the node count *without* throwing
     * away the nodes already on screen: existing positions are rescaled to the
     * new viewport and only the difference is added/trimmed.
     *
     * This matters on mobile far more than on desktop — every time the URL bar
     * collapses or expands mid-scroll the browser fires `resize`, so a rebuild
     * that regenerated the field would make the whole network visibly teleport
     * on almost every scroll gesture.
     */
    function build() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const pw = w || window.innerWidth; // previous size; equals the new one on first build
      const ph = h || window.innerHeight;
      w = window.innerWidth;
      h = window.innerHeight;
      cv.width = Math.floor(w * dpr);
      cv.height = Math.floor(h * dpr);
      cv.style.width = w + "px";
      cv.style.height = h + "px";
      c.setTransform(dpr, 0, 0, dpr, 0, 0);

      const sx = w / pw;
      const sy = h / ph;
      for (const n of nodes) {
        n.x *= sx;
        n.y *= sy;
      }

      const cap = coarse.matches ? 32 : 64;
      const count = Math.max(14, Math.min(cap, Math.round((w * h) / 23000)));
      while (nodes.length < count) nodes.push(makeNode());
      if (nodes.length > count) nodes.length = count;
    }

    function readTheme() {
      dark = document.documentElement.classList.contains("dark");
    }

    const rx: number[] = [];
    const ry: number[] = [];

    function step() {
      readTheme();
      paX += (paTX - paX) * 0.06;
      paY += (paTY - paY) * 0.06;

      c.clearRect(0, 0, w, h);
      const NODE = dark ? "34,197,140" : "12,138,88";
      const LINK = dark ? "34,197,140" : "13,150,100";
      const margin = 40;

      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < -margin) n.x = w + margin;
        else if (n.x > w + margin) n.x = -margin;
        if (n.y < -margin) n.y = h + margin;
        else if (n.y > h + margin) n.y = -margin;

        let x = n.x + paX;
        let y = n.y + paY;
        if (mouse.active) {
          const dx = mouse.x - x;
          const dy = mouse.y - y;
          const d = Math.hypot(dx, dy);
          if (d < CURSOR_R && d > 0.01) {
            const f = (1 - d / CURSOR_R) * 0.26; // gather toward cursor
            x += dx * f;
            y += dy * f;
          }
        }
        rx[i] = x;
        ry[i] = y;
      }

      // node-to-node links
      c.lineWidth = 1;
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = rx[i] - rx[j];
          const dy = ry[i] - ry[j];
          const d2 = dx * dx + dy * dy;
          if (d2 < CONNECT * CONNECT) {
            const a = (1 - Math.sqrt(d2) / CONNECT) * (dark ? 0.5 : 0.42);
            c.strokeStyle = `rgba(${LINK},${a})`;
            c.beginPath();
            c.moveTo(rx[i], ry[i]);
            c.lineTo(rx[j], ry[j]);
            c.stroke();
          }
        }
      }

      // links straight to the cursor
      if (mouse.active) {
        for (let i = 0; i < nodes.length; i++) {
          const d = Math.hypot(mouse.x - rx[i], mouse.y - ry[i]);
          if (d < CURSOR_R) {
            const a = (1 - d / CURSOR_R) * 0.62;
            c.strokeStyle = `rgba(${LINK},${a})`;
            c.beginPath();
            c.moveTo(mouse.x, mouse.y);
            c.lineTo(rx[i], ry[i]);
            c.stroke();
          }
        }
      }

      // nodes (brighten + swell near cursor)
      for (let i = 0; i < nodes.length; i++) {
        let r = nodes[i].r;
        let a = dark ? 0.82 : 0.66;
        if (mouse.active) {
          const d = Math.hypot(mouse.x - rx[i], mouse.y - ry[i]);
          if (d < CURSOR_R) {
            const t = 1 - d / CURSOR_R;
            r += t * 1.7;
            a = Math.min(1, a + t * 0.32);
          }
        }
        c.fillStyle = `rgba(${NODE},${a})`;
        c.beginPath();
        c.arc(rx[i], ry[i], r, 0, Math.PI * 2);
        c.fill();
      }
    }

    let raf = 0;
    let running = false;
    const loop = () => {
      if (!running) return;
      step();
      raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (running) return;
      running = true;
      raf = requestAnimationFrame(loop);
    };
    const stop = () => {
      running = false;
      cancelAnimationFrame(raf);
    };

    const track = (clientX: number, clientY: number) => {
      mouse.x = clientX;
      mouse.y = clientY;
      mouse.active = true;
      paTX = -(clientX / w - 0.5) * 28;
      paTY = -(clientY / h - 0.5) * 28;
    };
    const release = () => {
      mouse.active = false;
      paTX = 0;
      paTY = 0;
    };
    // Mouse + touch + pen all drive the same interaction via Pointer Events.
    const onMove = (e: PointerEvent) => track(e.clientX, e.clientY);
    const onDown = (e: PointerEvent) => track(e.clientX, e.clientY);
    const onUp = (e: PointerEvent) => {
      // A mouse keeps hovering after a click, so it stays active; touch/pen have
      // no hover — once the contact lifts, release the influence.
      if (e.pointerType !== "mouse") release();
    };
    // `pointerleave` does not bubble, so a window-level listener for it never
    // fires. `pointerout` does bubble, and a null relatedTarget is what the
    // pointer actually leaving the document looks like.
    const onOut = (e: PointerEvent) => {
      if (!e.relatedTarget) release();
    };
    const onVisibility = () => {
      if (document.hidden) stop();
      else start();
    };
    // Mobile fires resize in bursts as browser chrome animates; coalesce to one
    // rebuild per frame so a scroll gesture can't queue dozens of them.
    let resizeRaf = 0;
    const onResize = () => {
      if (resizeRaf) return;
      resizeRaf = requestAnimationFrame(() => {
        resizeRaf = 0;
        build();
      });
    };

    build();

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    window.addEventListener("pointercancel", onUp, { passive: true });
    document.addEventListener("pointerout", onOut, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", onResize);
    start();

    return () => {
      stop();
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.removeEventListener("pointerout", onOut);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10" />;
}
