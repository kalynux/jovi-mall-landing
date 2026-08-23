"use client";

import { withNative } from "@/lib/platform";

/**
 * The reduced-motion check, read directly rather than through the hooks in
 * `lib/reduced-motion.ts`.
 *
 * Those are hooks — `useReducedMotionSafe` defers to hydration so a
 * server-rendered tree cannot disagree with the client. Nothing here renders,
 * and every one of these is called from an event handler where hooks are not
 * available and hydration has long since happened, so the query is read at the
 * moment of the tap.
 *
 * It deliberately does **not** go through `HONOR_REDUCED_MOTION`. That flag
 * exists to stop Windows' "Animation effects: off" from stripping the landing
 * page's signature motion, which is a visual judgement about a desktop setting.
 * This is a phone vibrating in someone's hand, and the person who turned the
 * setting on may have done it because vibration is a vestibular trigger.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The small physical confirmations a phone gives and a browser does not.
 *
 * Every call is fire-and-forget and every one is optional: a device with the
 * motor disabled, a web browser, or a bridge that refuses all end in silence
 * rather than an error, because nothing here is load-bearing. The toast still
 * says what happened.
 *
 * ── Respecting reduced motion ────────────────────────────────────────────────
 *
 * Both platforms fold haptics into their reduce-motion setting rather than
 * giving it a switch of its own, and the people who turn it on include those
 * for whom vibration is a vestibular trigger. The app already reads that
 * preference for its animations; this reads the same one.
 */

/** Confirming something the shopper did: added to cart, saved, removed. */
export async function tapFeedback(): Promise<void> {
  if (prefersReducedMotion()) return;

  await withNative(async () => {
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    await Haptics.impact({ style: ImpactStyle.Light });
  });
}

/** A quantity stepper, a chip toggle — smaller than a confirmation. */
export async function selectionFeedback(): Promise<void> {
  if (prefersReducedMotion()) return;

  await withNative(async () => {
    const { Haptics } = await import("@capacitor/haptics");
    await Haptics.selectionChanged();
  });
}

/**
 * Something did not work.
 *
 * Deliberately NOT gated on reduced motion in the same way the others are — it
 * is gated, but it is the one signal worth reconsidering if that ever proves
 * wrong, because an error a shopper does not notice is worse than one they feel.
 * Kept consistent for now rather than making a special case nobody asked for.
 */
export async function errorFeedback(): Promise<void> {
  if (prefersReducedMotion()) return;

  await withNative(async () => {
    const { Haptics, NotificationType } = await import("@capacitor/haptics");
    await Haptics.notification({ type: NotificationType.Error });
  });
}
