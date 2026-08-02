"use client";
import { memo, type CSSProperties } from "react";
import { motion } from "framer-motion";
import type { CloudSpec, ParticleSpec, RingSpec } from "./config";
import { EASE_OUT } from "@/lib/utils";

/* Animation durations/phases are passed as CSS custom properties; the keyframes
 * live in globals.css (GPU-cheap transform/opacity only, no React re-renders).
 * Positioning classes are always applied — the reduced-motion "still" tier adds
 * an `.orb-still` class on the root that switches every loop off, so geometry is
 * identical whether or not the scene animates. */

type Vars = CSSProperties & Record<`--${string}`, string | number>;

// ─── Gradient wash ───────────────────────────────────────────────────────────
export const GradientWash = memo(function GradientWash() {
  return (
    <div className="orb-wash" aria-hidden="true">
      <span className="orb-wash-blob orb-wash-a" />
      <span className="orb-wash-blob orb-wash-b" />
    </div>
  );
});

// ─── Concentric rings ────────────────────────────────────────────────────────
export const ConcentricRings = memo(function ConcentricRings({ rings }: { rings: RingSpec[] }) {
  return (
    <>
      {rings.map((r, i) => {
        const d = `${r.radius * 2}vmax`;
        return (
          <div
            key={`ring-${i}`}
            className="orb-center-item orb-ring-breathe"
            style={{ width: d, height: d, "--breathe": `${r.breathe}s`, "--breathe-delay": `${r.breatheDelay}s` } as Vars}
            aria-hidden="true"
          >
            <svg
              className="orb-ring-spin"
              viewBox="0 0 100 100"
              width="100%"
              height="100%"
              style={{ "--rate": r.rate } as Vars}
            >
              {/* Non-scaling stroke: the hairline stays 1.2px whether the ring
                  is 32vmax or 132vmax across, instead of thickening with radius. */}
              <circle
                cx="50"
                cy="50"
                r="49"
                fill="none"
                stroke="var(--orb-stroke)"
                strokeWidth="1.2"
                vectorEffect="non-scaling-stroke"
                strokeOpacity={r.opacity}
                strokeLinecap="round"
                pathLength="100"
                strokeDasharray={r.dash}
              />
            </svg>
          </div>
        );
      })}
    </>
  );
});

// ─── Orbiting clouds ─────────────────────────────────────────────────────────
const DEG = Math.PI / 180;

const Cloud = memo(function Cloud({ c }: { c: CloudSpec }) {
  // Static orbit position (no rotation → no tilt to cancel).
  const x = (c.radius * Math.sin(c.angle * DEG)).toFixed(3);
  const y = (-c.radius * Math.cos(c.angle * DEG)).toFixed(3);
  return (
    <div className="orb-center-point" aria-hidden="true">
      {/* revolve the arm around the centre (scroll-driven, see --orb-angle) */}
      <div className="orb-spin" style={{ "--rate": c.rate } as Vars}>
        {/* place on the orbit — vmax, so the outer orbits clear the corners */}
        <div className="orb-arm" style={{ transform: `translate(${x}vmax, ${y}vmax)` }}>
          {/* No counter-rotation link here: a radial blob is rotationally
              symmetric, so there is no upright to preserve — which also saves a
              promoted layer per blob. */}
          {/* materialise / de-materialise with scroll progress */}
          <div className="orb-reveal" style={{ "--reveal-at": c.revealAt } as Vars}>
            <div className="orb-float" style={{ "--float": `${c.float}s`, "--float-delay": `${c.delay}s` } as Vars}>
              <div className="orb-breathe" style={{ "--breathe": `${c.breathe}s`, "--breathe-delay": `${c.delay}s` } as Vars}>
                <div
                  className="orb-cloud"
                  style={{
                    // One var drives diameter *and* blur radius (20% of size),
                    // so every blob stays equally soft at any scale.
                    "--size": `${c.size}vmin`,
                    "--tint": `radial-gradient(circle at 36% 32%, ${c.from} 0%, ${c.to} 48%, transparent 78%)`,
                  } as Vars}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export const OrbitingClouds = memo(function OrbitingClouds({ clouds }: { clouds: CloudSpec[] }) {
  return (
    <>
      {clouds.map((c) => (
        <Cloud key={c.key} c={c} />
      ))}
    </>
  );
});

// ─── Light sweep ─────────────────────────────────────────────────────────────
export const LightSweep = memo(function LightSweep({ duration }: { duration: number }) {
  return (
    <div className="orb-sweep" aria-hidden="true">
      <span className="orb-sweep-beam" style={{ "--sweep": `${duration}s` } as Vars} />
    </div>
  );
});

// ─── Floating particles ──────────────────────────────────────────────────────
export const FloatingParticles = memo(function FloatingParticles({ particles }: { particles: ParticleSpec[] }) {
  if (!particles.length) return null;
  return (
    <div className="orb-particles" aria-hidden="true">
      {particles.map((p) => (
        <span
          key={p.key}
          className={`orb-particle${p.glow ? " orb-particle-glow" : ""}${p.blur ? " orb-particle-blur" : ""}`}
          style={{
            top: `${p.top}%`,
            left: `${p.left}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            "--dx": `${p.dx}px`,
            "--dy": `${p.dy}px`,
            "--drift": `${p.duration}s`,
            "--drift-delay": `${p.delay}s`,
            "--op-max": p.opacity,
            "--op-min": p.opacity * 0.3,
          } as Vars}
        />
      ))}
    </div>
  );
});

// ─── Glass core (the brief's "center card", adapted to a background anchor) ───
export const GlassCore = memo(function GlassCore({ animate }: { animate: boolean }) {
  return (
    <div className="orb-center-item orb-core-wrap" aria-hidden="true">
      <motion.div
        className="orb-core"
        initial={animate ? { opacity: 0, scale: 0.94, y: 20 } : false}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.9, ease: EASE_OUT }}
      >
        <div className="orb-core-glow" />
      </motion.div>
    </div>
  );
});
