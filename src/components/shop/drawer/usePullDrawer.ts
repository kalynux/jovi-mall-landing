"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { localeDir, type Locale } from "@/i18n/routing";
import {
  PULL_SLOP_PX,
  nextTeaserIndex,
  pullCommits,
  pullProgress,
} from "@/lib/shop/drawer-teaser";

/** How long the drawer takes to finish opening, or to spring back. */
export const DRAWER_MS = 380;

export type DrawerPhase = "idle" | "dragging" | "closing" | "opening";

export interface PullDrawer {
  phase: DrawerPhase;
  /** 0 = shut, 1 = covering the page. */
  progress: number;
  /** How far the drawer's leading edge travels, in px. */
  rest: number;
  /** The shop header's bottom edge: the drawer slides in under it. */
  top: number;
  rtl: boolean;
  /** Spread on the tab or the lid. It is a real link: middle-click still opens a tab. */
  handlers: {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerCancel: () => void;
    onClick: (e: ReactMouseEvent<HTMLElement>) => void;
    onDragStart: (e: React.DragEvent<HTMLElement>) => void;
  };
}

function headerBottom(): number {
  const header = document.querySelector(".shop-header");
  return header ? Math.max(0, header.getBoundingClientRect().bottom) : 0;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Pull a page in from the inline end, like a drawer, then navigate to it.
 *
 * The destination stays a real route (`/shop` ⇄ `/shop/listings`): the drawer
 * is a preview that slides over the page, and on release the router takes
 * over. Back, shared links and crawling all behave as for any link, and the
 * preview simply goes when this page unmounts.
 *
 * A horizontal drag past a quarter opens it; anything less springs back. A tap,
 * Enter or a click opens it outright. A vertical drag is left to the scroller:
 * the pointer is captured only once the gesture is known to be sideways.
 *
 * @param measureRest How far the drawer travels, from the element pulled.
 */
export function usePullDrawer(href: string, measureRest: (el: HTMLElement) => number): PullDrawer {
  const router = useRouter();
  const rtl = localeDir(useLocale() as Locale) === "rtl";
  const [phase, setPhase] = useState<DrawerPhase>("idle");
  const [progress, setProgress] = useState(0);
  const [geometry, setGeometry] = useState({ rest: 0, top: 0 });

  const drag = useRef<{ x: number; y: number; axis: "x" | "y" | null; rest: number; id: number } | null>(null);
  const progressRef = useRef(0);
  const suppressClickUntil = useRef(0);
  const timers = useRef<number[]>([]);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((t) => window.clearTimeout(t));
  }, []);

  const set = useCallback((p: number) => {
    progressRef.current = p;
    setProgress(p);
  }, []);

  const measure = useCallback(
    (el: HTMLElement) => {
      const next = { rest: Math.max(1, measureRest(el)), top: headerBottom() };
      setGeometry(next);
      return next;
    },
    [measureRest],
  );

  const open = useCallback(
    (el: HTMLElement) => {
      if (phase === "opening") return;
      const fromRest = phase === "idle";
      if (fromRest) measure(el);
      setPhase("opening");
      const ms = prefersReducedMotion() ? 0 : DRAWER_MS;
      // From rest the drawer has to be drawn shut once before it can slide.
      if (fromRest && ms > 0) {
        requestAnimationFrame(() => requestAnimationFrame(() => set(1)));
      } else {
        set(1);
      }
      later(() => router.push(href), ms + (fromRest ? 32 : 0));
      // Navigation normally unmounts this page long before. If it did not (the
      // same URL, a failed fetch), let go rather than leave a sheet on screen.
      later(() => {
        set(0);
        setPhase("idle");
      }, 8000);
    },
    [href, later, measure, phase, router, set],
  );

  const springBack = useCallback(() => {
    set(0);
    setPhase("closing");
    later(() => setPhase((p) => (p === "closing" ? "idle" : p)), DRAWER_MS);
  }, [later, set]);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      if (phase === "opening") return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      drag.current = { x: e.clientX, y: e.clientY, axis: null, rest: 0, id: e.pointerId };
      // Captured at once, not when the drag is recognised: the desktop lid is
      // 34px wide, and a quick pull leaves it before the slop is crossed, so
      // its moves would land on the page behind. A touch pointer is captured
      // implicitly anyway; vertical scrolling stays the browser's through
      // `touch-action: pan-y`, which cancels this pointer when it scrolls.
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // A pointer that is already gone cannot be captured.
      }
      router.prefetch(href);
    },
    [href, phase, router],
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const d = drag.current;
      if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      if (d.axis === null) {
        if (Math.hypot(dx, dy) < PULL_SLOP_PX) return;
        d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (d.axis === "y") {
          drag.current = null;
          return;
        }
        d.rest = measure(e.currentTarget).rest;
        setPhase("dragging");
      }
      set(pullProgress(dx, d.rest, rtl));
    },
    [measure, rtl, set],
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const d = drag.current;
      drag.current = null;
      if (!d || d.axis !== "x") return;
      // The click that follows this release is the end of a drag, not a tap.
      suppressClickUntil.current = performance.now() + 500;
      if (pullCommits(progressRef.current, true)) open(e.currentTarget);
      else springBack();
    },
    [open, springBack],
  );

  const onPointerCancel = useCallback(() => {
    const d = drag.current;
    drag.current = null;
    if (d?.axis === "x") springBack();
  }, [springBack]);

  const onClick = useCallback(
    (e: ReactMouseEvent<HTMLElement>) => {
      if (e.defaultPrevented) return;
      // New tab, new window, download: the browser's business, not a drawer's.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      if (performance.now() < suppressClickUntil.current) return;
      open(e.currentTarget);
    },
    [open],
  );

  const onDragStart = useCallback((e: React.DragEvent<HTMLElement>) => e.preventDefault(), []);

  return {
    phase,
    progress,
    rest: geometry.rest,
    top: geometry.top,
    rtl,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClick, onDragStart },
  };
}

/**
 * Which face the tab or the rail shows, advancing every few seconds.
 * Paused while a drawer is moving and while the tab is in the background.
 */
export function useTeaserRotation(count: number, paused: boolean, everyMs = 3000): number {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (paused || count < 2) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") setIndex((i) => nextTeaserIndex(i, count));
    }, everyMs);
    return () => window.clearInterval(id);
  }, [count, everyMs, paused]);
  return count > 0 ? index % count : 0;
}
