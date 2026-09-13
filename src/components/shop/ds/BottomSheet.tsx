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
   * The filter sheet opens a second sheet for the category list, and DOM order
   * alone is not enough to keep it on top — both are `position: fixed` at the
   * same z-index, and the inner one is a descendant of a motion element that
   * creates its own stacking context.
   */
  layer?: "default" | "top";
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
export function BottomSheet({ open, onClose, title, footer, children, layer = "default" }: BottomSheetProps) {
  // `title` stays a prop — the caller owns that sentence and hands it over
  // already translated. Only the × this sheet draws itself is ours.
  const tCommon = useTranslations("shop.common");

  /**
   * A stacked sheet is rendered from inside the sheet below it, whose panel is
   * a `motion.div`. While that panel is animating it carries a `transform`,
   * and a transformed ancestor makes `position: fixed` resolve against *it*
   * rather than the viewport — so the inner sheet would land inside the outer
   * one instead of over the screen. A portal takes it out of that subtree.
   *
   * Only the stacked case: portalling the ordinary sheet would change where
   * every existing caller's markup ends up for no benefit.
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
      // A sheet underneath a stacked one stays put: the key closed the sheet
      // the visitor is actually looking at.
      if (layer !== "top" && openTopSheets > 0) return;
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
            zIndex: layer === "top" ? 420 : 400,
            background: "var(--scrim)",
            display: "flex",
            justifyContent: "center",
          }}
          className="items-end sm:items-center p-0 sm:p-4"
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
            className="w-full sm:max-w-[480px] rounded-t-[28px] sm:rounded-[20px]"
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

  if (layer === "top") {
    // Nothing until hydration — one frame of no sheet, which is the frame
    // before the open animation would have started anyway.
    return hydrated ? createPortal(sheet, document.body) : null;
  }
  return sheet;
}
