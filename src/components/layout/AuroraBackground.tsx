"use client";
/**
 * AuroraBackground — a single fixed layer of slowly drifting blurred blobs.
 *
 * This is the page's only always-on ambient motion (all other loops were
 * retired in favour of it). It's GPU-cheap: three transform-only keyframes
 * (aurora-a/b/c in globals.css) on blurred radial blobs. Colours come from the
 * theme-aware --aurora-* CSS vars so it adapts to light/dark automatically.
 *
 * prefers-reduced-motion is respected by the global CSS rule that collapses
 * animation durations, so the blobs simply sit still.
 */
export default function AuroraBackground() {
    return (
        <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
        >
            <div
                className="aurora-blob aurora-a -top-[15%] -left-[10%] h-[55vh] w-[55vh]"
                style={{ background: "var(--aurora-1)" }}
            />
            <div
                className="aurora-blob aurora-b top-[35%] right-[-12%] h-[60vh] w-[60vh]"
                style={{ background: "var(--aurora-2)" }}
            />
            <div
                className="aurora-blob aurora-c bottom-[-15%] left-[25%] h-[50vh] w-[50vh]"
                style={{ background: "var(--aurora-3)" }}
            />
        </div>
    );
}
