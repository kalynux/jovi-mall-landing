"use client";
/**
 * ModalShell
 *
 * Backdrop, centred dialog, Escape, body scroll lock — the chrome every modal
 * in this app was open-coding. Extracted from RoleSelectorModal when the agent
 * app dialog and the switch-role verification gate became the second and third
 * consumers.
 *
 * This used to carry a "gesture shield" as well — onWheel/onTouchMove/onKeyDown
 * handlers that called stopPropagation so a modal's own scrolling survived the
 * landing page's full-page scroller, which owned window-level `wheel`,
 * `keydown` and `touchmove` listeners and preventDefault()ed them. That
 * scroller is gone (see SectionNavProvider) and with it the only thing the
 * shield defended against, so it has gone too rather than linger as a no-op
 * whose comment describes code that no longer exists.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useHydrated } from "@/lib/use-hydrated";

/** Holds body scroll while `isOpen`, and restores it on close/unmount. */
export function useBodyScrollLock(isOpen: boolean) {
    useEffect(() => {
        if (!isOpen) return;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);
}

interface ModalShellProps {
    isOpen: boolean;
    /**
     * Omit to make the modal blocking: no Escape, no backdrop dismiss. The
     * WhatsApp verification gate is deliberately in that category.
     */
    onClose?: () => void;
    /** id of the element naming the dialog. */
    labelledBy: string;
    children: ReactNode;
    /** Panel sizing/appearance. Defaults to the role-picker's max-w-lg card. */
    className?: string;
    /**
     * `top` stacks above every other modal. Used by the verification gate,
     * which can open on top of another dialog and must never sit under it.
     */
    layer?: "default" | "top";
}

export default function ModalShell({
    isOpen,
    onClose,
    labelledBy,
    children,
    className,
    layer = "default",
}: ModalShellProps) {
    const panelRef = useRef<HTMLDivElement | null>(null);

    /**
     * Rendered into `document.body`, for the reason ResponsiveDialog already
     * documents: a transformed ancestor re-bases `position: fixed` onto itself,
     * so `inset-0` stops meaning "the viewport" and starts meaning "that
     * element". Every consumer of this shell sits inside one —
     *
     *   • the pricing plan card carries `hover:-translate-y-1` (live at the
     *     moment of the click, because the pointer is still on the card) and
     *     `lg:scale-[1.03]` on the highlighted tier, which never goes away;
     *   • AgentSection's AnimatedSection is a motion.div that animates `x` and
     *     leaves an inline transform at rest;
     *   • CtaBand additionally clips with `overflow-hidden`.
     *
     * which is why the agent dialog opened *inside* a 320px card instead of
     * over the page. Portalling is the only fix that covers all three; chasing
     * the transforms individually would leave the next one to re-break it.
     *
     * `useHydrated` rather than an effect that sets state: there is no
     * `document` during SSR, and both the server and hydrating renders return
     * false, so the passes agree without a cascading re-render.
     */
    const hydrated = useHydrated();

    // Escape — only for dismissible modals. Bound to the document so it works
    // whether or not focus made it inside the dialog.
    useEffect(() => {
        if (!isOpen || !onClose) return;
        const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [isOpen, onClose]);

    useBodyScrollLock(isOpen);

    // Move focus into the dialog so screen readers announce the new context
    // and the keyboard starts inside it rather than behind it.
    useEffect(() => {
        if (isOpen) panelRef.current?.focus();
    }, [isOpen]);

    const backdropZ = layer === "top" ? "z-[110]" : "z-[100]";
    const panelZ = layer === "top" ? "z-[111]" : "z-[101]";

    const dialog = (
        <AnimatePresence>
            {isOpen && (
                <>
                    <motion.div
                        key="backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className={cn("fixed inset-0 bg-black/60 backdrop-blur-sm", backdropZ)}
                        onClick={onClose}
                        aria-hidden="true"
                    />

                    <motion.div
                        key="panel"
                        ref={panelRef}
                        tabIndex={-1}
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={labelledBy}
                        initial={{ opacity: 0, scale: 0.9, y: 16 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 16 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                        className={cn(
                            "fixed inset-0 flex items-center justify-center overflow-y-auto p-4",
                            "focus-visible:outline-none",
                            panelZ
                        )}
                        // This layer sits on top of the backdrop and covers it,
                        // so click-outside has to be handled here — putting it
                        // on the backdrop alone never fires.
                        onClick={onClose}
                    >
                        <div
                            className={cn(
                                "relative w-full max-w-lg glass rounded-3xl border border-[var(--border)] shadow-2xl",
                                className
                            )}
                            // The backdrop behind this is a click-to-close
                            // target; the panel itself must not be.
                            onClick={(e) => e.stopPropagation()}
                        >
                            {children}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );

    return hydrated ? createPortal(dialog, document.body) : null;
}
