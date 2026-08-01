"use client";
import { useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { TIER_CONFIG } from "./config";
import { useMouseParallax, useSceneTier, useTabHidden } from "./hooks";
import {
  ConcentricRings,
  FloatingParticles,
  GlassCore,
  GradientWash,
  LightSweep,
  OrbitingAvatars,
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

/**
 * OrbitalBackground — a fixed, non-interactive ambient layer: slowly shifting
 * brand-gradient wash, concentric rotating rings, orbiting placeholder-avatar
 * chips, a diagonal light sweep, and drifting particles, all centred on the
 * viewport with a subtle pointer parallax.
 *
 * It renders nothing until the client resolves a fidelity tier (avoids
 * hydration mismatch), scales itself down on mobile / entry-level devices, and
 * collapses to a motionless composed frame under prefers-reduced-motion. Every
 * continuous loop is pure CSS (transform/opacity only) so the component never
 * re-renders after mount and stays on the compositor.
 */
export default function OrbitalBackground({
  className,
  zClassName = "-z-10",
}: OrbitalBackgroundProps) {
  const tier = useSceneTier();
  const parallaxRef = useRef<HTMLDivElement>(null);
  const hidden = useTabHidden();

  // Hooks must run every render; the parallax hook no-ops when travel is 0.
  const cfg = tier ? TIER_CONFIG[tier] : null;
  useMouseParallax(parallaxRef, cfg?.parallax ?? 0);

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
      data-paused={hidden ? "true" : "false"}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
    >
      <GradientWash />

      <div ref={parallaxRef} className="orb-parallax">
        <ConcentricRings rings={cfg.rings} />
        <GlassCore animate={animate} />
        <OrbitingAvatars avatars={cfg.avatars} />
      </div>

      {cfg.sweep && animate && <LightSweep duration={15} />}
      <FloatingParticles particles={cfg.particles} />
    </motion.div>
  );
}
