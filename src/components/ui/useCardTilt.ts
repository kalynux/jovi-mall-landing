"use client";
import { useEffect } from "react";
import {
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";

/**
 * The hero card's tactile physics, pulled out so every product-preview card on
 * the page moves with the same hand.
 *
 * Three things happen at once, all transform-only:
 *  • the card rotates toward the pointer (or the device's own tilt on mobile);
 *  • a soft glare tracks the pointer across the glass;
 *  • layers glide along one shared diagonal, signed and scaled per layer, so a
 *    floating badge closes the gap with the card exactly as the card opens the
 *    gap on the other side. Motion along a single axis is what makes a stack of
 *    absolutely-positioned divs read as one object turning in space; give each
 *    layer its own direction and it reads as confetti.
 *
 * The axis defaults to NE–SW because that is where the hero parks its two
 * badges — top-right and bottom-left. Cards that hang their badges elsewhere
 * should pass their own.
 */

/** ↗ positive, ↙ negative. */
const NE_SW = { x: Math.SQRT1_2, y: -Math.SQRT1_2 } as const;

export interface CardTiltOptions {
  /** Peak rotation at the card's corners, in degrees. */
  maxTilt?: number;
  /** Off → every value stays parked at rest and no listeners are attached. */
  enabled?: boolean;
  /** Unit vector the layers glide along. */
  axis?: { x: number; y: number };
  /** Follow device orientation on phones. Off for cards that already float. */
  gyro?: boolean;
}

export interface CardTilt {
  enabled: boolean;
  /** Spread onto the element that owns the perspective. */
  surfaceProps: {
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerLeave: () => void;
  };
  rotateX: MotionValue<number>;
  rotateY: MotionValue<number>;
  /** A `radial-gradient(...)` string — paint it over the card in soft-light. */
  glare: MotionValue<string>;
  /**
   * Travel for one layer, in px along the axis. Negative counter-travels
   * (moves against the card). Scale it with the layer's translateZ: whatever
   * floats highest should react hardest.
   *
   * This is a hook — call it at the top level, the same number of times every
   * render.
   */
  useTravel: (distance: number) => { x: MotionValue<number>; y: MotionValue<number> };
}

export function useCardTilt({
  maxTilt = 9,
  enabled = true,
  axis = NE_SW,
  gyro = true,
}: CardTiltOptions = {}): CardTilt {
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const glareX = useMotionValue(50);
  const glareY = useMotionValue(0);
  const glide = useMotionValue(0); // −1…1 along the axis

  const rotateX = useSpring(rx, { stiffness: 150, damping: 15, mass: 0.4 });
  const rotateY = useSpring(ry, { stiffness: 150, damping: 15, mass: 0.4 });
  const sGlide = useSpring(glide, { stiffness: 140, damping: 18, mass: 0.5 });

  const glare = useMotionTemplate`radial-gradient(120% 90% at ${glareX}% ${glareY}%, rgba(255,255,255,0.35), rgba(255,255,255,0) 60%)`;

  const onPointerMove = (e: React.PointerEvent) => {
    // Touch drives the gyroscope path instead; honouring both would fight.
    if (!enabled || e.pointerType === "touch") return;
    const r = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width; // 0..1
    const py = (e.clientY - r.top) / r.height;
    const nx = (px - 0.5) * 2; // −1..1
    const ny = (py - 0.5) * 2;
    ry.set(nx * maxTilt);
    rx.set(-ny * maxTilt);
    glareX.set(px * 100);
    glareY.set(py * 100);
    // Project the pointer onto the axis, clamped so the corners don't overshoot
    // the ±1 that travel distances are calibrated against.
    glide.set(Math.max(-1, Math.min(1, nx * axis.x + ny * axis.y)));
  };

  const onPointerLeave = () => {
    rx.set(0);
    ry.set(0);
    glareX.set(50);
    glareY.set(0);
    glide.set(0);
  };

  // Android fires deviceorientation without a permission prompt; where it
  // doesn't, the card simply rests flat — nothing is gated on it.
  useEffect(() => {
    if (!enabled || !gyro) return;
    if (typeof window === "undefined" || !("DeviceOrientationEvent" in window)) return;
    let raf = 0;
    const onOrient = (e: DeviceOrientationEvent) => {
      const gamma = e.gamma ?? 0; // left/right [-90,90]
      const beta = e.beta ?? 0; // front/back [-180,180]
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        ry.set(Math.max(-maxTilt, Math.min(maxTilt, gamma * 0.4)));
        // −45° is roughly how a phone is held while reading, so that posture
        // reads as "flat" rather than permanently tipped back.
        rx.set(Math.max(-maxTilt, Math.min(maxTilt, (beta - 45) * 0.25)));
      });
    };
    window.addEventListener("deviceorientation", onOrient);
    return () => {
      window.removeEventListener("deviceorientation", onOrient);
      cancelAnimationFrame(raf);
    };
  }, [enabled, gyro, maxTilt, rx, ry]);

  // Named `useTravel` so the rules-of-hooks lint follows it into callers — it
  // holds two useTransform calls and obeys every hook rule they do.
  const useTravel = (distance: number) => ({
    x: useTransform(sGlide, (v) => v * distance * axis.x),
    y: useTransform(sGlide, (v) => v * distance * axis.y),
  });

  return { enabled, surfaceProps: { onPointerMove, onPointerLeave }, rotateX, rotateY, glare, useTravel };
}
