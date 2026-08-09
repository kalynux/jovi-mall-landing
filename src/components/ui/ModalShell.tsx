"use client";
/**
 * ModalShell
 *
 * Backdrop, centred dialog, Escape, body scroll lock — the chrome every modal
 * in this app was open-coding. Extracted from RoleSelectorModal when the agent
 * app dialog and the switch-role verification gate became the second and third
 * consumers.
 *
 * The part that is NOT boilerplate: the gesture shield. On the landing page
 * SectionNavProvider owns window-level `wheel`, `keydown` and `touchmove`
 * listeners and calls preventDefault() on them (SectionNavProvider.tsx:278-282)
 * so one gesture maps to exactly one section. A modal mounted inside that has
 * arrow keys snapping the page behind it, and on a phone whose current section
 * fits the viewport `touchmove` is cancelled outright, so the modal's own body
 * cannot be scrolled at all. React attaches its listeners to the root
 * container, which sits below `window`, so stopping propagation here keeps the
 * native event from ever reaching those handlers.
 *
 * Only the keys SectionNavProvider actually acts on are blocked — Tab, Escape
 * and everything else still bubble, so nested focus traps keep working.
 */
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Keys SectionNavProvider snaps on. */
const NAV_KEYS = new Set([
    "ArrowDown",
    "ArrowUp",
    "PageDown",
    "PageUp",
    "Home",
    "End",
    " ",
    "Spacebar",
]);

/**
 * Spread onto any full-screen overlay rendered on a page that uses
 * SectionNavProvider. Exported because the WhatsApp verification gate brings
 * its own chrome and so cannot go through ModalShell, but still needs the
 * window-level gesture handlers held off.
 */
export const gestureShieldProps = {
    onWheel: (e: React.WheelEvent) => e.stopPropagation(),
    onTouchMove: (e: React.TouchEvent) => e.stopPropagation(),
    onKeyDown: (e: React.KeyboardEvent) => {
        if (NAV_KEYS.has(e.key)) e.stopPropagation();
    },
} as const;

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
    const shieldRef = useRef<HTMLDivElement | null>(null);

    // Escape — only for dismissible modals. Bound to the document so it works
    // whether or not focus made it inside the dialog; Escape is never in
    // NAV_KEYS, so the shield below does not intercept it on the way up.
    useEffect(() => {
        if (!isOpen || !onClose) return;
        const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
        document.addEventListener("keydown", handler);
        return () => document.removeEventListener("keydown", handler);
    }, [isOpen, onClose]);

    useBodyScrollLock(isOpen);

    // Move focus into the dialog so the shield's key handling is in the path
    // and screen readers announce the new context.
    useEffect(() => {
        if (isOpen) shieldRef.current?.focus();
    }, [isOpen]);

    const backdropZ = layer === "top" ? "z-[110]" : "z-[100]";
    const panelZ = layer === "top" ? "z-[111]" : "z-[101]";

    return (
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
                        ref={shieldRef}
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
                        // ── Gesture shield. Bubble phase on purpose: capture
                        // would run ahead of any nested focus trap.
                        {...gestureShieldProps}
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
}
