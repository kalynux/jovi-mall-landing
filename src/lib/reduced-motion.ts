"use client";
import { useReducedMotion } from "framer-motion";
import { useHydrated } from "./use-hydrated";

/**
 * `prefers-reduced-motion`, in a form that survives hydration.
 *
 * Framer's own `useReducedMotion()` cannot: there is no media query on the
 * server, so it returns `false` there and the real value on the client. For a
 * visitor who *has* reduced motion on, every component that branches on it
 * renders one way in the HTML and the other way on hydration, and React tears
 * the whole tree down with "server rendered HTML didn't match the client".
 *
 * That is not a niche audience here. Windows reports `reduce` whenever
 * Settings → Accessibility → Visual effects → "Animation effects" is off — a
 * common non-accessibility configuration, as the flag below already notes — so
 * this was firing for a large slice of visitors across the landing page's whole
 * animation layer at once.
 *
 * Reporting `false` until hydrated makes the client's first pass agree with the
 * HTML that was actually sent, and the true value takes effect immediately
 * after. Nothing regresses for reduced-motion visitors: the server had already
 * committed to the non-reduced markup, so this replaces a full tree
 * regeneration with a normal re-render — and CSS `@media
 * (prefers-reduced-motion)` in globals.css never had this problem, so the
 * global rules hold from the first paint either way.
 *
 * Prefer this over importing `useReducedMotion` from framer-motion directly.
 */
export function useReducedMotionSafe(): boolean {
  const reduce = useReducedMotion();
  const hydrated = useHydrated();
  return hydrated && !!reduce;
}

/**
 * Whether the OS `prefers-reduced-motion` setting is allowed to strip motion from
 * the *signature* surfaces — the orbital background and the hero card's pointer
 * interaction.
 *
 * Deliberately off. Windows reports `reduce` whenever Settings → Accessibility →
 * Visual effects → "Animation effects" is switched off, which is a common
 * non-accessibility configuration: plenty of people turn it off for perceived
 * speed, or inherit it from a corporate image. The result was that the two pieces
 * of motion the landing page is actually built around silently did not exist for
 * a large slice of Windows visitors.
 *
 * Flip this to `true` to hand the decision back to the OS everywhere at once.
 *
 * Scope: this covers only the surfaces that opt in by calling
 * `useSignatureReducedMotion()`. The global CSS rules in globals.css and every
 * other section still honour the preference through framer's `useReducedMotion()`
 * directly, so ordinary transitions, hover lifts and scroll reveals all still
 * collapse as expected.
 */
export const HONOR_REDUCED_MOTION = false;

/**
 * `useReducedMotionSafe()`, gated by the product flag above. Returns `false`
 * while the flag is off, so callers keep their motion regardless of the OS
 * setting.
 */
export function useSignatureReducedMotion(): boolean {
  const reduce = useReducedMotionSafe();
  return HONOR_REDUCED_MOTION && reduce;
}
