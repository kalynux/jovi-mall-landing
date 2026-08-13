/**
 * Generated cover art for an article that has no image.
 *
 * The alternative was stock photography, and it is worth saying why it lost. A
 * generic photo of a smiling person holding a phone tells the reader nothing,
 * costs a network round-trip on the thin connections this product is built for,
 * and — if pulled from a placeholder service the way `catalog.mock.ts` does —
 * puts a third-party host in the critical path of the page's largest paint.
 *
 * This is an inline SVG: no request, no layout shift, no `remotePatterns` entry
 * in next.config, and it inherits `--role` from its category so a payments
 * article and a delivery article are visibly different without a second
 * palette existing anywhere.
 *
 * The geometry is deterministic in the article's id, so a given article always
 * gets the same cover — on the index, on the category page, and in the related
 * row at the foot of another article. A random one would make the same article
 * look like three different articles.
 */

/**
 * djb2. Not cryptographic and does not need to be: the only requirement is that
 * the same string always produces the same number, and that similar strings
 * (`getting-paid`, `getting-paid-2`) land far apart.
 */
function hash(seed: string): number {
  let value = 5381;
  for (let i = 0; i < seed.length; i += 1) {
    value = (value * 33) ^ seed.charCodeAt(i);
  }
  return Math.abs(value);
}

/** A deterministic integer in [min, max] from the seed and a channel index. */
function pick(seed: string, channel: number, min: number, max: number): number {
  const value = hash(`${seed}:${channel}`);
  return min + (value % (max - min + 1));
}

export default function CoverArt({
  seed,
  className,
  /** Cards use the plain field; the article header adds the orbit rings. */
  variant = "card",
}: {
  seed: string;
  className?: string;
  variant?: "card" | "hero";
}) {
  const cx = pick(seed, 1, 240, 340);
  const cy = pick(seed, 2, 40, 110);
  const rotation = pick(seed, 3, -28, 28);
  const dotOffset = pick(seed, 4, 0, 11);
  const ringGap = pick(seed, 5, 26, 40);

  // The dot field is the site's network motif at rest. Rows are offset by the
  // seed so the lattice does not line up identically across a grid of cards.
  const dots: { x: number; y: number; r: number }[] = [];
  for (let row = 0; row < 7; row += 1) {
    for (let col = 0; col < 12; col += 1) {
      const x = 16 + col * 34 + ((row + dotOffset) % 2) * 17;
      const y = 18 + row * 34;
      dots.push({ x, y, r: (col + row + dotOffset) % 5 === 0 ? 2.6 : 1.4 });
    }
  }

  return (
    <svg
      viewBox="0 0 400 250"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      // Decorative: the article title is right beside it in the DOM, so
      // describing this would make a screen reader announce the headline twice.
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`cover-bg-${seed}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="color-mix(in srgb, var(--role) 22%, var(--surface))" />
          <stop offset="55%" stopColor="color-mix(in srgb, var(--role) 9%, var(--surface))" />
          <stop offset="100%" stopColor="var(--surface)" />
        </linearGradient>
        <radialGradient id={`cover-glow-${seed}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="color-mix(in srgb, var(--role) 42%, transparent)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <clipPath id={`cover-clip-${seed}`}>
          <rect width="400" height="250" />
        </clipPath>
      </defs>

      <g clipPath={`url(#cover-clip-${seed})`}>
        <rect width="400" height="250" fill={`url(#cover-bg-${seed})`} />

        <g opacity="0.5">
          {dots.map((dot) => (
            <circle
              key={`${dot.x}-${dot.y}`}
              cx={dot.x}
              cy={dot.y}
              r={dot.r}
              fill="var(--role)"
              opacity={dot.r > 2 ? 0.55 : 0.25}
            />
          ))}
        </g>

        <circle cx={cx} cy={cy} r="120" fill={`url(#cover-glow-${seed})`} />

        {/* Orbit rings — the same motif as the landing page's background, held
            still. Only on the hero, where there is room for them to read. */}
        {variant === "hero" && (
          <g
            fill="none"
            stroke="var(--role)"
            transform={`rotate(${rotation} ${cx} ${cy})`}
            opacity="0.45"
          >
            <ellipse cx={cx} cy={cy} rx={ringGap * 2.6} ry={ringGap} strokeWidth="1.25" />
            <ellipse cx={cx} cy={cy} rx={ringGap * 3.6} ry={ringGap * 1.5} strokeWidth="1" opacity="0.7" />
            <circle cx={cx} cy={cy} r="5" fill="var(--role)" stroke="none" />
          </g>
        )}

        {/* A single sweep across the field, so the composition has a direction. */}
        <path
          d={`M -20 ${190 + (dotOffset % 3) * 12} C 90 ${150 - dotOffset * 4}, 250 ${
            230 - dotOffset * 3
          }, 420 ${140 + (dotOffset % 4) * 10}`}
          fill="none"
          stroke="var(--role)"
          strokeWidth="1.5"
          opacity="0.35"
        />
      </g>
    </svg>
  );
}
