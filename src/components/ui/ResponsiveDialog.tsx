"use client";
/**
 * ResponsiveDialog — a bottom sheet on a phone, a centred popup from `sm` up.
 *
 * ModalShell is the centred-only version and stays that way: it is the shape
 * the landing page's role picker and agent dialog want on every screen. This is
 * the shape the account flows want instead — under the thumb on a phone, under
 * the pointer on a desktop — and it is one component rather than two so the two
 * halves cannot drift apart.
 *
 * The scroll lock and the gesture shield are ModalShell's, imported rather than
 * re-implemented: a dialog opened over a page that uses SectionNavProvider
 * would otherwise have its own body scroll cancelled by that provider's
 * window-level `touchmove` handler.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/use-hydrated";
import { gestureShieldProps, useBodyScrollLock } from "@/components/ui/ModalShell";

interface ResponsiveDialogProps {
  open: boolean;
  onClose: () => void;
  /** Names the dialog for assistive tech, and heads the panel. */
  title: string;
  /** One line under the title, before the body. */
  description?: ReactNode;
  children: ReactNode;
  /** Panel width from `sm` up. */
  className?: string;
}

export default function ResponsiveDialog({
  open,
  onClose,
  title,
  description,
  children,
  className,
}: ResponsiveDialogProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);

  /**
   * Rendered into `document.body`, because every call site so far is deep
   * inside an animated subtree — the auth card and its step transitions are
   * both `motion.div`s. A transformed ancestor re-bases `position: fixed` on
   * itself, which would put a full-screen scrim inside a 480px card.
   *
   * `useHydrated` rather than an effect that sets state: there is no
   * `document` during SSR, and this is the project's `useSyncExternalStore`
   * answer to exactly that question — server and hydrating render both say
   * false, so the two passes agree without a cascading re-render.
   */
  const hydrated = useHydrated();

  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const dialog = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={onClose}
          className={cn(
            "fixed inset-0 z-[300] flex justify-center bg-black/60 backdrop-blur-sm",
            // Bottom-anchored on a phone, centred once there is room.
            "items-end p-0 sm:items-center sm:p-4"
          )}
          {...gestureShieldProps}
        >
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            // The sheet rises; the popup scales. Same component, and the two
            // motions are what make each read as native to its screen.
            initial={{ y: 44, opacity: 0, scale: 0.985 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 44, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 34 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "relative w-full max-h-[88vh] overflow-y-auto",
              "border border-[var(--border)] bg-[var(--surface)] shadow-2xl",
              "rounded-t-[28px] sm:rounded-[24px]",
              "px-5 pb-[calc(20px+var(--sa-bottom,0px))] pt-4 sm:px-6 sm:pb-6 sm:pt-5",
              "focus-visible:outline-none",
              className ?? "sm:max-w-md"
            )}
          >
            {/* Grab handle — the affordance that says "this is a sheet", and
                meaningless once the same panel is a centred popup. */}
            <span
              aria-hidden="true"
              className="mx-auto mb-3 block h-1 w-9 rounded-full bg-[var(--border-strong)] sm:hidden"
            />

            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="font-display text-base font-bold text-[var(--text-primary)]"
                >
                  {title}
                </h2>
                {description && (
                  <p className="mt-1 text-sm leading-relaxed text-[var(--text-secondary)]">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="-me-1 -mt-1 flex h-9 w-9 flex-none items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors hover:bg-[var(--bg-muted)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return hydrated ? createPortal(dialog, document.body) : null;
}
