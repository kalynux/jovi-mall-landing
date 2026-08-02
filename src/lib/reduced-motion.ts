"use client";
import { useReducedMotion } from "framer-motion";

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
 * `useReducedMotion()`, gated by the product flag above. Returns `false` while
 * the flag is off, so callers keep their motion regardless of the OS setting.
 */
export function useSignatureReducedMotion(): boolean {
  const reduce = useReducedMotion();
  return HONOR_REDUCED_MOTION && !!reduce;
}
