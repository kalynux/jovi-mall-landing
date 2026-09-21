"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import type { ReactNode } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { IconButton } from "./IconButton";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  footer?: ReactNode;
  children: ReactNode;
  /**
   * Stacks this sheet above another one.
   *
   * The filter sheet opens a second sheet for the category list. Both are
   * portalled to `<body>` as siblings, so only portal order would decide which
   * paints on top at an equal z-index — and that is an accident of which one
   * mounted last, not a statement about the stack. The higher z-index is.
   */
  layer?: "default" | "top";
  /**
   * Extra classes for the overlay — the full-screen scrim the panel sits in.
   *
   * For hiding the whole sheet at a breakpoint, which a wrapper element around
   * `<BottomSheet>` can no longer do now that the sheet is portalled out of
   * it. `MenuSheet` passes `sm:hidden`: above `sm` the same menu is a dropdown.
   */
  className?: string;
}

/**
 * How many `layer="top"` sheets are open right now.
 *
 * Escape belongs to the topmost sheet, and listener order cannot decide that:
 * both sheets bind to `document`, and the OUTER one registers first, so it
 * would win every time. A count is the only thing either sheet can consult that
 * describes the stack rather than the binding order.
 */
let openTopSheets = 0;

/**
 * Responsive dialog: a bottom sheet on mobile, a centered modal on `sm+`.
 * Adapts the design's mobile-only BottomSheet for the web.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  footer,
  children,
  layer = "default",
  className,
}: BottomSheetProps) {
  // `title` stays a prop — the caller owns that sentence and hands it over
  // already translated. Only the × this sheet draws itself is ours.
  const tCommon = useTranslations("shop.common");

  /**
   * Every sheet is portalled to `<body>`, because a `z-index` only ranks an
   * element inside its nearest stacking context — and the caller decides which
   * one that is, not us.
   *
   * It used to be only the stacked case, and the account screen is what that
   * cost. Its overflow menu and the "Sign out?" confirmation are rendered from
   * the header bar, which is `sticky` with `z-index: 200` — a stacking context.
   * So the sheet's 400 meant "400 inside the header", the whole header ranked
   * 200, and the tab bar (also 200, and later in the DOM) painted over both
   * sheets: undimmed, and squarely on top of their buttons. Nobody could
   * confirm a sign-out on a phone, and the menu's last row, Close account, was
   * under the tabs as well.
   *
   * The stacked case is the same problem in another shape: a sheet rendered
   * from inside another sheet's `motion.div` panel sits under a `transform`
   * while that panel animates, and a transformed ancestor makes
   * `position: fixed` resolve against *it* rather than the viewport. Sticky,
   * transform, filter, opacity — anything a caller wraps us in can do one or
   * the other, so the sheet does not stay where it was written. Same rule as
   * `ModalShell` and `ResponsiveDialog`.
   *
   * `useHydrated` rather than an effect that sets state: there is no
   * `document` during SSR, and this is the project's `useSyncExternalStore`
   * answer to exactly that question — server and hydrating render both say
   * false, so the two passes agree without a cascading re-render.
   */
  const hydrated = useHydrated();
  useEffect(() => {
    if (!open) return;
    if (layer === "top") openTopSheets += 1;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Something inside the sheet already used this Escape — the country
      // picker closes its own list with it and calls preventDefault. Closing the
      // whole sheet as well threw away a half-filled payment form.
      if (e.defaultPrevented) return;
      // A sheet underneath a stacked one stays put: the key closed the sheet
      // the visitor is actually looking at.
      if (layer !== "top" && openTopSheets > 0) return;
      // Spend the key. The count above only works while the outer sheet's
      // listener runs FIRST, and a sheet re-binds whenever its `onClose`
      // identity changes, so the order drifts. When the inner one ran first it
      // closed, its unmount dropped the count to 0 before the outer listener
      // looked, and one Escape took the pay sheet down with the "Replace the
      // link?" confirm. `defaultPrevented` above makes it order-independent.
      e.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKey);

    // Nesting is safe here: the inner sheet's `prev` is the outer's "hidden",
    // so unwinding in either order lands back on the page's own value.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      if (layer === "top") openTopSheets -= 1;
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, layer]);

  const sheet = (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            // Above the header and the tab bar (both 200), below the toast
            // (500) — a sheet's own save can fail, and that message has to
            // land on top of the form that caused it.
            zIndex: layer === "top" ? 420 : 400,
            background: "var(--scrim)",
          }}
          // `flex` is a class, not inline style, so a caller's `sm:hidden`
          // can outrank it; an inline `display` would beat any class.
          className={`flex justify-center items-end sm:items-center p-0 sm:p-4${className ? ` ${className}` : ""}`}
        >
          <motion.div
            initial={{ y: 40, opacity: 0.6, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            // Announced as a dialog rather than as an unlabelled box of divs: a
            // screen reader lands in the panel with no idea it is modal, and the
            // scrim behind it is a click target it cannot see.
            role="dialog"
            aria-modal="true"
            aria-label={title}
            // `shop-sheet` clears the home indicator / gesture pill below `sm`,
            // where the panel meets the bottom edge — see globals.css.
            className="shop-sheet w-full sm:max-w-[480px] rounded-t-[28px] sm:rounded-[20px]"
            style={{
              background: "var(--surface)",
              boxShadow: "var(--shadow-sheet)",
              maxHeight: "88vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                // The grab handle below is absolutely positioned, and without a
                // positioned ancestor here it resolved against the fixed scrim —
                // so on mobile it drew a stray pill at the top of the *screen*,
                // above the site header, instead of on the sheet.
                position: "relative",
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "14px 12px 12px 18px",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <span
                aria-hidden
                className="sm:hidden"
                style={{
                  position: "absolute",
                  left: "50%",
                  transform: "translateX(-50%)",
                  top: 6,
                  width: 38,
                  height: 4,
                  borderRadius: 999,
                  background: "var(--border-strong)",
                }}
              />
              <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: "var(--text-strong)" }}>
                {title}
              </span>
              <IconButton icon="x" variant="plain" label={tCommon("close")} onClick={onClose} />
            </div>
            <div style={{ padding: 18, overflowY: "auto", flex: 1 }}>{children}</div>
            {footer && (
              <div
                style={{
                  padding: 16,
                  borderTop: "1px solid var(--border-subtle)",
                  background: "var(--surface)",
                }}
              >
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Nothing until hydration — one frame of no sheet, which is the frame before
  // the open animation would have started anyway.
  return hydrated ? createPortal(sheet, document.body) : null;
}
