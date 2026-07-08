"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { IconButton } from "./IconButton";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * Responsive dialog: a bottom sheet on mobile, a centered modal on `sm+`.
 * Adapts the design's mobile-only BottomSheet for the web.
 */
export function BottomSheet({ open, onClose, title, footer, children }: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
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
            zIndex: 400,
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
              <IconButton icon="x" variant="plain" label="Close" onClick={onClose} />
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
}
