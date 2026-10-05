"use client";

import { useEffect, useRef, useState, type CSSProperties, type SyntheticEvent } from "react";

/** How long a finger must stay down. Android's own long-press is ~400–500ms. */
const HOLD_MS = 450;
/** When the card starts to visibly sink — late enough that a scroll never shows it. */
const SINK_MS = 140;
/** A finger that moves this far is scrolling, not holding. */
const MOVE_TOLERANCE_PX = 10;
/** The click a release produces arrives this soon after the press fired. */
const CLICK_SWALLOW_MS = 1200;

/**
 * `pointer` means a finger (or mouse button) is still down as the menu opens —
 * the caller must not let that same press close it again on release.
 */
export type LongPressSource = "pointer" | "keyboard";

/**
 * Press-and-hold on something that is also a link — a product card.
 *
 * ── Three things a long-press on a link already does, and must stop doing ───
 *
 * 1. **The release clicks.** The hold ends with a pointer-up, the browser turns
 *    that into a click, and the click opens the product behind the menu that
 *    just appeared. Swallowed in the capture phase, before the link sees it.
 * 2. **Android opens its own link menu** ("Open in new tab", "Download image")
 *    through `contextmenu`. Cancelled for touch only — a mouse right-click
 *    keeps the browser's menu, which is what a desktop user reaches for.
 * 3. **iOS opens a link preview and Android selects the title text.** Neither
 *    has an event to cancel; `style` below turns both off with CSS.
 *
 * ── Events from a portal are not ours ────────────────────────────────────────
 *
 * The sheet this opens is portalled to `<body>`, but React still bubbles its
 * events through the component tree — so a tap on one of its rows reaches the
 * card's handlers here. Every handler checks real DOM containment first and
 * ignores anything else; without that, a tap on "Share" restarted the hold
 * timer on the card underneath and a quick second tap got swallowed.
 *
 * The card's own buttons (Save, the corner "+") are skipped too: holding one of
 * those is a slow tap on that button, not a request for the menu.
 *
 * `onLongPress: null` turns it all off — no handlers and no style.
 */
export function useLongPress(onLongPress: ((source: LongPressSource) => void) | null): {
  handlers: {
    onPointerDown?: (e: React.PointerEvent) => void;
    onPointerMove?: (e: React.PointerEvent) => void;
    onPointerUp?: (e: React.PointerEvent) => void;
    onPointerCancel?: (e: React.PointerEvent) => void;
    onPointerLeave?: (e: React.PointerEvent) => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    onClickCapture?: (e: React.MouseEvent) => void;
    onKeyDown?: (e: React.KeyboardEvent) => void;
  };
  /** True while a hold is under way and the card should look pressed. */
  pressing: boolean;
  style: CSSProperties;
} {
  const holdTimer = useRef<number | null>(null);
  const sinkTimer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const pointerType = useRef<string>("mouse");
  const firedAt = useRef(0);
  const [pressing, setPressing] = useState(false);

  const cancel = () => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    if (sinkTimer.current !== null) window.clearTimeout(sinkTimer.current);
    holdTimer.current = null;
    sinkTimer.current = null;
    origin.current = null;
    setPressing(false);
  };

  // A card unmounted mid-hold (the grid re-rendered) must not fire afterwards.
  useEffect(
    () => () => {
      if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
      if (sinkTimer.current !== null) window.clearTimeout(sinkTimer.current);
    },
    [],
  );

  if (!onLongPress) return { handlers: {}, pressing: false, style: {} };

  const fire = () => {
    cancel();
    firedAt.current = Date.now();
    onLongPress("pointer");
  };

  const ours = (e: SyntheticEvent) => e.currentTarget.contains(e.target as Node);

  return {
    pressing,
    handlers: {
      onPointerDown: (e) => {
        if (!ours(e)) return;
        pointerType.current = e.pointerType;
        if (e.button !== 0) return;
        if ((e.target as Element).closest("button")) return;
        cancel();
        origin.current = { x: e.clientX, y: e.clientY };
        sinkTimer.current = window.setTimeout(() => setPressing(true), SINK_MS);
        holdTimer.current = window.setTimeout(fire, HOLD_MS);
      },
      onPointerMove: (e) => {
        if (!origin.current || !ours(e)) return;
        const dx = e.clientX - origin.current.x;
        const dy = e.clientY - origin.current.y;
        if (dx * dx + dy * dy > MOVE_TOLERANCE_PX * MOVE_TOLERANCE_PX) cancel();
      },
      // A scroll that starts under the finger arrives as `pointercancel`.
      onPointerUp: () => origin.current && cancel(),
      onPointerCancel: () => origin.current && cancel(),
      onPointerLeave: () => origin.current && cancel(),
      onContextMenu: (e) => {
        if (!ours(e) || pointerType.current === "mouse") return;
        e.preventDefault();
        // Android can raise its menu a beat before our timer: open ours now
        // rather than let the hold end with nothing.
        if (holdTimer.current !== null) fire();
      },
      onClickCapture: (e) => {
        if (!ours(e) || Date.now() - firedAt.current > CLICK_SWALLOW_MS) return;
        firedAt.current = 0;
        e.preventDefault();
        e.stopPropagation();
      },
      // The keyboard's way to the same menu: the Menu key, or Shift+F10.
      onKeyDown: (e) => {
        if (!ours(e)) return;
        if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) {
          e.preventDefault();
          onLongPress("keyboard");
        }
      },
    },
    style: {
      WebkitTouchCallout: "none",
      WebkitUserSelect: "none",
      userSelect: "none",
    },
  };
}
