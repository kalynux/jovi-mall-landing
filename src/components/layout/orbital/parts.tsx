"use client";
import { memo, type CSSProperties } from "react";
import { motion } from "framer-motion";
import type { AvatarSpec, ParticleSpec, RingSpec } from "./config";
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
        const d = `${r.radius * 2}vmin`;
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
              style={{ "--spin": `${r.spin}s`, animationDirection: r.reverse ? "reverse" : "normal" } as Vars}
            >
              <circle
                cx="50"
                cy="50"
                r="49"
                fill="none"
                stroke="var(--orb-stroke)"
                strokeWidth="0.35"
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

// ─── Orbiting avatars ────────────────────────────────────────────────────────
const DEG = Math.PI / 180;

const Avatar = memo(function Avatar({ a }: { a: AvatarSpec }) {
  // Static orbit position (no rotation → no tilt to cancel).
  const x = (a.radius * Math.sin(a.angle * DEG)).toFixed(3);
  const y = (-a.radius * Math.cos(a.angle * DEG)).toFixed(3);
  const spinDir = a.reverse ? "reverse" : "normal";
  const counterDir = a.reverse ? "normal" : "reverse";
  return (
    <div className="orb-center-point" aria-hidden="true">
      {/* revolve the arm around the centre */}
      <div className="orb-spin" style={{ "--spin": `${a.spin}s`, animationDirection: spinDir } as Vars}>
        {/* place on the orbit */}
        <div className="orb-arm" style={{ transform: `translate(${x}vmin, ${y}vmin)` }}>
          {/* counter-rotate so the chip stays upright */}
          <div className="orb-counter" style={{ "--spin": `${a.spin}s`, animationDirection: counterDir } as Vars}>
            <div className="orb-float" style={{ "--float": `${a.float}s`, "--float-delay": `${a.delay}s` } as Vars}>
              <div className="orb-breathe" style={{ "--breathe": `${a.breathe}s`, "--breathe-delay": `${a.delay}s` } as Vars}>
                <div
                  className="orb-avatar"
                  style={{
                    width: `${a.size}px`,
                    height: `${a.size}px`,
                    backgroundImage: `linear-gradient(135deg, ${a.from} 0%, ${a.to} 100%)`,
                    fontSize: `${Math.round(a.size * 0.34)}px`,
                  }}
                >
                  <span>{a.initials}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export const OrbitingAvatars = memo(function OrbitingAvatars({ avatars }: { avatars: AvatarSpec[] }) {
  return (
    <>
      {avatars.map((a) => (
        <Avatar key={a.key} a={a} />
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
