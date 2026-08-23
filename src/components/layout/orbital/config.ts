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
  /**
   * Radius in **vmax**, not vmin: the scene has to reach the corners of any
   * aspect ratio, and the half-diagonal is 0.56–0.71 vmax depending on how
   * square the viewport is. Anything sized in vmin stops at the short edge.
   */
  radius: number;
  /** Reference period, in seconds — the relative speed the `rate` is derived from. */
  spin: number;
  /** Rotation direction — alternated ring to ring. */
  reverse: boolean;
  /**
   * Scroll-driven rotation rate: degrees turned per degree of scene drive
   * (`--orb-angle`). Signed — rings alternate direction for depth, which reads
   * as a gyroscope rather than contradicting the overall scroll direction
   * because the strokes sit at 7–14% opacity.
   */
  rate: number;
  /** Breathing (scale 1 → 1.02 → 1) period, in seconds. */
  breathe: number;
  /** Negative-delay phase offset so no two rings breathe in sync. */
  breatheDelay: number;
  /**
   * Dash geometry, in the **0–100 space** that `pathLength="100"` normalises the
   * circle to. Values above 100 make the first dash swallow the whole path and
   * the ring renders solid — at which point rotating it looks like nothing is
   * happening at all, because a solid circle is rotationally symmetric.
   */
  dash: string;
  /** Base stroke opacity (7–14%). */
  opacity: number;
}

export interface CloudSpec {
  key: string;
  /** Gradient stops for the blob's radial tint. */
  from: string;
  to: string;
  /** Diameter in vmin (the blur is derived from it, at 20%). */
  size: number;
  /** Orbit radius in vmax — see the note on RingSpec.radius. */
  radius: number;
  /** Starting angle in degrees (position on the orbit). */
  angle: number;
  /** Reference period, in seconds (18–45s) — the `rate` is derived from it. */
  spin: number;
  /**
   * Scroll-driven orbit rate: degrees revolved per degree of scene drive
   * (`--orb-angle`). Always positive so every blob follows the scroll direction
   * — clockwise down, anticlockwise up. Depth comes from the speed spread.
   */
  rate: number;
  /**
   * Scroll progress (0–1) at which this blob starts materialising. Reveal is a
   * pure function of position, so scrolling back up un-reveals it exactly.
   */
  revealAt: number;
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
  clouds: CloudSpec[];
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

// ─── Cloud tints ─────────────────────────────────────────────────────────────
// The blobs carry no identity — no initials, no photos, nothing that implies a
// customer count. They are just coloured light. `CLOUD_TINTS` is exported so a
// caller can swap the palette without touching the geometry.
export interface CloudTint {
  from: string;
  to: string;
}

export const CLOUD_TINTS: CloudTint[] = [
  { from: "#22BD82", to: "#068554" }, // Wi-Mall green
  { from: "#2DD4BF", to: "#0D9488" }, // teal
  { from: "#FBBF24", to: "#D97706" }, // amber
  { from: "#57D6A0", to: "#0DA06B" }, // light green
  { from: "#60A5FA", to: "#2563EB" }, // blue
  { from: "#34D399", to: "#059669" }, // emerald
  { from: "#FCD34D", to: "#B45309" }, // gold
  { from: "#5EEAD4", to: "#0F766E" }, // aqua
  { from: "#4ADE80", to: "#166534" }, // green
  { from: "#93E9C1", to: "#068554" }, // mint
  { from: "#7DD3FC", to: "#0369A1" }, // sky
  { from: "#FBBF24", to: "#0DA06B" }, // amber→green
  { from: "#22BD82", to: "#14B8A6" }, // green→teal
  { from: "#F59E0B", to: "#92400E" }, // deep amber
];

// ─── Tier builders ───────────────────────────────────────────────────────────
// Rotation is scroll-driven (see useScrollDrive): every rotating node turns by
// `--orb-angle × rate`. The reference periods below no longer set a wall-clock
// speed — they only fix how fast each node turns *relative* to the others, so
// the scene keeps the layered feel it had as a timed animation.
const RING_RATE_REF = 40;
const CLOUD_RATE_REF = 30;
/** Last blob finishes revealing at this scroll progress (leaves a settled tail). */
const REVEAL_SPAN = 0.72;

function buildRings(count: number, seed: number): RingSpec[] {
  const rng = mulberry32(seed);
  // Radii spread from behind the copy out past the corners (vmax — see RingSpec).
  const rings: RingSpec[] = [];
  const inner = 16;
  const outer = 66;
  for (let i = 0; i < count; i++) {
    const t = count === 1 ? 0 : i / (count - 1);
    const radius = round(inner + (outer - inner) * t, 1);
    const spin = round(80 + rng() * 40, 1); // 80–120s
    const breathe = round(8 + rng() * 2, 2); // 8–10s
    // A single long arc + gap, in the normalised 0–100 pathLength space, so the
    // ring is visibly an arc and its rotation actually reads.
    const dashOn = round(46 + rng() * 30, 1); // 46–76% of the circle
    const dashOff = round(100 - dashOn, 1);
    const reverse = i % 2 === 1;
    rings.push({
      radius,
      spin,
      reverse,
      rate: round((RING_RATE_REF / spin) * (reverse ? -1 : 1), 3),
      breathe,
      breatheDelay: round(-rng() * breathe, 2),
      dash: `${dashOn} ${dashOff}`,
      opacity: round(0.07 + rng() * 0.07, 3), // 7–14%
    });
  }
  return rings;
}

function buildClouds(
  radii: number[],
  perRing: number[],
  seed: number,
  sizeRange: [number, number]
): CloudSpec[] {
  const rng = mulberry32(seed);
  const out: CloudSpec[] = [];
  // Blobs reveal in build order — inner ring first, then outward — so scrolling
  // down grows the field from the centre toward the corners.
  const total = perRing.reduce((a, b) => a + b, 0);
  let idx = 0;
  radii.forEach((radius, ring) => {
    const n = perRing[ring];
    const spin = round(18 + rng() * 27, 1); // 18–45s
    const angleOffset = rng() * 360;
    for (let k = 0; k < n; k++) {
      const tint = CLOUD_TINTS[idx % CLOUD_TINTS.length];
      const [minS, maxS] = sizeRange;
      out.push({
        key: `cl-${idx}`,
        from: tint.from,
        to: tint.to,
        size: round(minS + rng() * (maxS - minS), 1),
        radius,
        angle: round((360 / n) * k + angleOffset, 1),
        spin,
        rate: round(CLOUD_RATE_REF / spin, 3),
        revealAt: round((idx / Math.max(total - 1, 1)) * REVEAL_SPAN, 3),
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
// Orbit radii are vmax and run out to 64 — past the 0.56–0.71 vmax half-diagonal
// on most screens — so the outermost blobs sweep through the corners and bleed
// off the edges rather than describing a neat circle inside the frame.
const FULL: TierConfig = {
  rings: buildRings(6, 1201),
  clouds: buildClouds([22, 36, 50, 64], [3, 3, 3, 3], 4207, [26, 48]),
  particles: buildParticles(30, 9109),
  sweep: true,
  parallax: 26,
};

const LEAN: TierConfig = {
  rings: buildRings(3, 3307),
  // Fewer, proportionally larger blobs on phones — vmin is the short edge there,
  // so the same vmin size covers much more of the (narrow) screen.
  clouds: buildClouds([30, 56], [3, 3], 6607, [30, 54]),
  particles: [],
  sweep: false,
  parallax: 0,
};

const STILL: TierConfig = {
  // Same geometry as lean, but the components skip every loop for this tier.
  rings: buildRings(4, 3307),
  clouds: buildClouds([26, 50], [3, 3], 6607, [30, 52]),
  particles: [],
  sweep: false,
  parallax: 0,
};

export const TIER_CONFIG: Record<SceneTier, TierConfig> = {
  full: FULL,
  lean: LEAN,
  still: STILL,
};
