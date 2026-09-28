/**
 * The three channel marks: Android (the APK), Google Play and the App Store.
 *
 * Simplified single-colour line drawings rather than the official badges —
 * they sit at 20px inside our own tiles, inherit `currentColor`, and grey out
 * with their tile. lucide dropped its brand icons, so they are drawn here.
 */
type GlyphProps = { className?: string };

export function AndroidGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      {/* Head, with the two eyes cut out (even-odd). */}
      <path
        fillRule="evenodd"
        d="M3.5 18a8.5 8.5 0 0 1 17 0zM7.6 14.4a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0zM14.2 14.4a1.1 1.1 0 1 0 2.2 0a1.1 1.1 0 1 0 -2.2 0z"
      />
      <path d="M7.2 11.2 5.2 7.8M16.8 11.2l2-3.4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function PlayGlyph({ className }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      <path d="M4.5 3.6v16.8a.9.9 0 0 0 1.36.77l14.1-8.4a.9.9 0 0 0 0-1.54L5.86 2.83a.9.9 0 0 0-1.36.77z" />
      {/* The four-colour split, as two crossing seams. */}
      <path d="M4.9 3.3 16.2 15.2M4.9 20.7 16.2 8.8" strokeLinecap="round" />
    </svg>
  );
}

export function AppleGlyph({ className }: GlyphProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M12 7.6c-1.05-.9-2.3-1.3-3.5-1.08C6.2 6.93 4.8 9.05 4.8 11.8c0 4.05 2.65 9.2 5 9.2.85 0 1.3-.5 2.2-.5s1.35.5 2.2.5c2.35 0 5-5.15 5-9.2 0-2.75-1.4-4.87-3.7-5.28-1.2-.22-2.45.18-3.5 1.08z" />
      <path d="M12.2 6.6c-.05-2.1 1.3-3.8 3.3-4.1.05 2.1-1.3 3.8-3.3 4.1z" />
    </svg>
  );
}
