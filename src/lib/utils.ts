import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { Variants } from "framer-motion";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

// ─── Reusable Framer Motion Variants ────────────────────────────────────────

export const fadeInUp: Variants = {
    hidden: { opacity: 0, y: 32 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    },
};

export const fadeInLeft: Variants = {
    hidden: { opacity: 0, x: -32 },
    visible: {
        opacity: 1,
        x: 0,
        transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    },
};

export const fadeInRight: Variants = {
    hidden: { opacity: 0, x: 32 },
    visible: {
        opacity: 1,
        x: 0,
        transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] },
    },
};

export const staggerContainer: Variants = {
    hidden: {},
    visible: {
        transition: {
            staggerChildren: 0.12,
            delayChildren: 0.1,
        },
    },
};

export const scaleIn: Variants = {
    hidden: { opacity: 0, scale: 0.92 },
    visible: {
        opacity: 1,
        scale: 1,
        transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
    },
};

/** Snappy blur-in reveal — cheap (opacity + small y + blur), great for headings. */
export const revealUp: Variants = {
    hidden: { opacity: 0, y: 24, filter: "blur(6px)" },
    visible: {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
    },
};

/** Child item for staggerContainer (no transition here — parent staggers it). */
export const staggerItem: Variants = {
    hidden: { opacity: 0, y: 18 },
    visible: {
        opacity: 1,
        y: 0,
        transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] },
    },
};

// ─── Shared performance-first primitives ────────────────────────────────────
// GPU-cheap (transform + opacity), exponential ease-out from a visible-by-default
// resting state. Reduced-motion is handled globally (globals.css collapses
// durations) and per-component via useReducedMotionSafe; keep these as the vocabulary
// so every surface animates with one accent, not fifteen bespoke curves.

/** The house ease — confident deceleration, no bounce. */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Tighter container for dense lists (cards, chips, rows) — capped total delay. */
export const staggerContainerFast: Variants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

/** A small confident "land" — for badges, confirmations, arriving state. */
export const popIn: Variants = {
    hidden: { opacity: 0, scale: 0.8, y: 6 },
    visible: {
        opacity: 1,
        scale: 1,
        y: 0,
        transition: { duration: 0.42, ease: [0.34, 1.4, 0.64, 1] },
    },
};

/** Overlay/sheet/dropdown entrance — quick, from the surface it belongs to. */
export const overlayIn: Variants = {
    hidden: { opacity: 0, scale: 0.97, y: 8 },
    visible: { opacity: 1, scale: 1, y: 0, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
    exit: { opacity: 0, scale: 0.98, y: 6, transition: { duration: 0.14, ease: "easeIn" } },
};
