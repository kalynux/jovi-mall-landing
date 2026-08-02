"use client";
import { useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TIER_CONFIG } from "./config";
import { useMouseParallax, useSceneTier, useScrollDrive, useTabHidden } from "./hooks";
import {
  ConcentricRings,
  FloatingParticles,
  // GlassCore,   ← re-enable alongside the <GlassCore /> line below
  GradientWash,
  LightSweep,
  OrbitingClouds,
} from "./parts";

export interface OrbitalBackgroundProps {
  /** Extra classes on the fixed root (e.g. to change stacking or clip). */
  className?: string;
  /**
   * Stacking. Defaults to `-z-10` so it sits with the other ambient layers
   * (AuroraBackground / InteractiveNetwork) and behind page content. Because it
   * is placed *after* those in the DOM at the same z-index, it paints on top of
   * them — i.e. "on top of the current background".
   */
  zClassName?: string;
}

/** Degrees of scene rotation per pixel scrolled (0 disables the scroll drive). */
const SCROLL_DEG_PER_PX = 0.06;

/**
 * OrbitalBackground — a fixed, non-interactive ambient layer: slowly shifting
 * brand-gradient wash, concentric rings, orbiting cloud blobs, a diagonal light
 * sweep, and drifting particles, all centred on the viewport with a subtle
 * pointer parallax.
 *
 * The geometry is sized in vmax and runs past the viewport half-diagonal, so the
 * scene fills the whole frame including the corners. A radial mask on the
 * parallax layer thins it out behind the centre column, where the copy lives.
 *
 * The rotation is *scroll-driven*: the radar turns clockwise as the page scrolls
 * down, unwinds anticlockwise on the way back up, and rests whenever the page
 * does (see `useScrollDrive`). The chips reveal along the same axis, so scrolling
 * up reverts the scene through exactly the states it came through.
 *
 * It renders nothing until the client resolves a fidelity tier (avoids
 * hydration mismatch), scales itself down on mobile / entry-level devices, and
 * collapses to a motionless composed frame under prefers-reduced-motion. The
 * remaining ambient loops are pure CSS (transform/opacity only) so the component
 * never re-renders after mount and stays on the compositor.
 */
export default function OrbitalBackground({
  className,
  zClassName = "-z-10",
}: OrbitalBackgroundProps) {
  const tier = useSceneTier();
  const parallaxRef = useRef<HTMLDivElement>(null);
  const hidden = useTabHidden();

  // Hooks must run every render; both no-op when their travel/rate is 0. They
  // share the parallax node: everything that reads the drive vars lives inside
  // it, so the per-frame style invalidation skips the particles and the wash.
  const cfg = tier ? TIER_CONFIG[tier] : null;
  useMouseParallax(parallaxRef, cfg?.parallax ?? 0);
  useScrollDrive(parallaxRef, tier && tier !== "still" ? SCROLL_DEG_PER_PX : 0);

  if (!tier || !cfg) return null;
  const animate = tier !== "still";

  return (
    <motion.div
      aria-hidden="true"
      className={cn(
        "orb-scene pointer-events-none fixed inset-0 overflow-hidden",
        !animate && "orb-still",
        zClassName,
        className
      )}
      data-tier={tier}
      data-paused={hidden ? "true" : "false"}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <GradientWash />

      <div ref={parallaxRef} className="orb-parallax">
        <ConcentricRings rings={cfg.rings} />
        {/* <GlassCore animate={animate} /> */}
        <OrbitingClouds clouds={cfg.clouds} />
      </div>

      {cfg.sweep && animate && <LightSweep duration={15} />}
      <FloatingParticles particles={cfg.particles} />
    </motion.div>
  );
}
