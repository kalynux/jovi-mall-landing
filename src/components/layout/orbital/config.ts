/**
 * OrbitalBackground — shared configuration, types, and deterministic helpers.
 *
 * Everything here is pure and side-effect free so it can be imported on both the
 * server and the client. Randomness is *seeded* (mulberry32) on purpose: the
 * particle field must render identically on the server and the first client
 * paint, otherwise React throws a hydration mismatch. A fixed seed also means
 * the layout is stable between reloads while still looking un-gridded.
 */

// ─── Tiers ───────────────────────────────────────────────────────────────────
// The scene renders at one of three fidelities, resolved on the client from the
// device's pointer/width and its reduced-motion preference (see useSceneTier).
//
//  • full  — desktop / fine-pointer: the whole composition.
//  • lean  — mobile / coarse-pointer: fewer rings & avatars, no particles, no
//            blur. This is the Africa-first / entry-level-device budget.
//  • still — prefers-reduced-motion: a composed, motionless frame.
export type SceneTier = "full" | "lean" | "still";

export interface RingSpec {
  /** Radius in vmin (viewport-relative so the scene self-centres and scales). */
  radius: number;
  /** One full rotation, in seconds (80–120s = barely-perceptible drift). */
  spin: number;
  /** Rotation direction — alternated ring to ring. */
  reverse: boolean;
  /** Breathing (scale 1 → 1.02 → 1) period, in seconds. */
  breathe: number;
  /** Negative-delay phase offset so no two rings breathe in sync. */
  breatheDelay: number;
  /** Dash geometry gives the thin stroke something to reveal as it rotates. */
  dash: string;
  /** Base stroke opacity (5–10%). */
  opacity: number;
}

export interface AvatarSpec {
  key: string;
  initials: string;
  /** Gradient stops (placeholder identity — swap for real avatars later). */
  from: string;
  to: string;
  /** Diameter in px. */
  size: number;
  /** Orbit radius in vmin. */
  radius: number;
  /** Starting angle in degrees (position on the orbit). */
  angle: number;
  /** One revolution, in seconds (18–45s). */
  spin: number;
  /** Orbit direction. */
  reverse: boolean;
  /** Vertical float period, in seconds. */
  float: number;
  /** Scale-breathe period, in seconds. */
  breathe: number;
  /** Phase offset (negative animation-delay), in seconds. */
  delay: number;
}

export interface ParticleSpec {
  key: string;
  /** Position as viewport percentages. */
  top: number;
  left: number;
  size: number;
  opacity: number;
  /** Drift target offsets in px. */
  dx: number;
  dy: number;
  duration: number;
  delay: number;
  blur: boolean;
  glow: boolean;
}

export interface TierConfig {
  rings: RingSpec[];
  avatars: AvatarSpec[];
  particles: ParticleSpec[];
  /** Whether the diagonal light sweep runs. */
  sweep: boolean;
  /** Parallax travel in px at the screen edge (0 disables the effect). */
  parallax: number;
}

// ─── Deterministic RNG ───────────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (n: number, p = 2) => Math.round(n * 10 ** p) / 10 ** p;

// ─── Placeholder avatar identities ───────────────────────────────────────────
// Generic, clearly-placeholder gradient chips (initials, not photos) so nothing
// implies a real customer count. `PLACEHOLDER_AVATARS` is exported so callers
// can pass their own set once real imagery exists.
export interface AvatarSeed {
  initials: string;
  from: string;
  to: string;
}

export const PLACEHOLDER_AVATARS: AvatarSeed[] = [
  { initials: "AK", from: "#22BD82", to: "#068554" }, // Jovi green
  { initials: "NM", from: "#2DD4BF", to: "#0D9488" }, // teal
  { initials: "OE", from: "#FBBF24", to: "#D97706" }, // amber
  { initials: "TS", from: "#57D6A0", to: "#0DA06B" }, // light green
  { initials: "BL", from: "#60A5FA", to: "#2563EB" }, // blue
  { initials: "FA", from: "#34D399", to: "#059669" }, // emerald
  { initials: "JD", from: "#FCD34D", to: "#B45309" }, // gold
  { initials: "RM", from: "#5EEAD4", to: "#0F766E" }, // aqua
  { initials: "IK", from: "#4ADE80", to: "#166534" }, // green
  { initials: "PA", from: "#93E9C1", to: "#068554" }, // mint
  { initials: "CN", from: "#7DD3FC", to: "#0369A1" }, // sky
  { initials: "YB", from: "#FBBF24", to: "#0DA06B" }, // amber→green
  { initials: "DL", from: "#22BD82", to: "#14B8A6" }, // green→teal
  { initials: "MW", from: "#F59E0B", to: "#92400E" }, // deep amber
];

// ─── Tier builders ───────────────────────────────────────────────────────────
function buildRings(count: number, seed: number): RingSpec[] {
  const rng = mulberry32(seed);
  // Radii spread from just outside the core to near the viewport edge.
  const rings: RingSpec[] = [];
  const inner = 14;
  const outer = 50;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const radius = round(inner + (outer - inner) * t, 1);
    const spin = round(80 + rng() * 40, 1); // 80–120s
    const breathe = round(8 + rng() * 2, 2); // 8–10s
    // A single long arc + gap so the thin ring visibly (but calmly) rotates.
    const circumference = 2 * Math.PI * radius;
    const dashOn = round(circumference * (0.5 + rng() * 0.28), 1);
    const dashOff = round(circumference - dashOn, 1);
    rings.push({
      radius,
      spin,
      reverse: i % 2 === 1,
      breathe,
      breatheDelay: round(-rng() * breathe, 2),
      dash: `${dashOn} ${dashOff}`,
      opacity: round(0.05 + rng() * 0.05, 3), // 5–10%
    });
  }
  return rings;
}

function buildAvatars(
  radii: number[],
  perRing: number[],
  seed: number,
  sizeRange: [number, number]
): AvatarSpec[] {
  const rng = mulberry32(seed);
  const out: AvatarSpec[] = [];
  let idx = 0;
  radii.forEach((radius, ring) => {
    const n = perRing[ring];
    const spin = round(18 + rng() * 27, 1); // 18–45s
    const reverse = ring % 2 === 1;
    const angleOffset = rng() * 360;
    for (let k = 0; k < n; k++) {
      const seed3 = PLACEHOLDER_AVATARS[idx % PLACEHOLDER_AVATARS.length];
      const [minS, maxS] = sizeRange;
      out.push({
        key: `av-${idx}`,
        initials: seed3.initials,
        from: seed3.from,
        to: seed3.to,
        size: Math.round(minS + rng() * (maxS - minS)),
        radius,
        angle: round((360 / n) * k + angleOffset, 1),
        spin,
        reverse,
        float: round(4 + rng() * 3, 2), // 4–7s
        breathe: round(5 + rng() * 3, 2), // 5–8s
        delay: round(-rng() * spin, 2),
      });
      idx++;
    }
  });
  return out;
}

function buildParticles(count: number, seed: number): ParticleSpec[] {
  const rng = mulberry32(seed);
  const out: ParticleSpec[] = [];
  for (let i = 0; i < count; i++) {
    out.push({
      key: `pt-${i}`,
      top: round(rng() * 100, 2),
      left: round(rng() * 100, 2),
      size: round(2 + rng() * 6, 1), // 2–8px
      opacity: round(0.1 + rng() * 0.2, 3), // 10–30%
      dx: round((rng() - 0.5) * 80, 1),
      dy: round((rng() - 0.5) * 80, 1),
      duration: round(16 + rng() * 18, 1), // slow: 16–34s
      delay: round(-rng() * 20, 2),
      blur: rng() > 0.6,
      glow: rng() > 0.7,
    });
  }
  return out;
}

// Built once at module load (pure + deterministic).
const FULL: TierConfig = {
  rings: buildRings(6, 1201),
  avatars: buildAvatars([22, 30, 38, 46], [3, 3, 3, 3], 4207, [40, 64]),
  particles: buildParticles(30, 9109),
  sweep: true,
  parallax: 26,
};

const LEAN: TierConfig = {
  rings: buildRings(3, 3307),
  // Smaller chips on wider orbits so they hug the edges and stay out of the
  // single-column copy on phones (Jovi's primary, mobile-first audience).
  avatars: buildAvatars([32, 48], [3, 3], 6607, [30, 42]),
  particles: [],
  sweep: false,
  parallax: 0,
};

const STILL: TierConfig = {
  // Same geometry as lean, but the components skip every loop for this tier.
  rings: buildRings(4, 3307),
  avatars: buildAvatars([24, 38], [3, 3], 6607, [36, 52]),
  particles: [],
  sweep: false,
  parallax: 0,
};

export const TIER_CONFIG: Record<SceneTier, TierConfig> = {
  full: FULL,
  lean: LEAN,
  still: STILL,
};
