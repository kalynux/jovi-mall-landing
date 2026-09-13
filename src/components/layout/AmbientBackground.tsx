"use client";
/**
 * AmbientBackground — the landing page's ambience, at whatever price the
 * device can pay.
 *
 * `full` mounts the four real layers, in the order they have always been in:
 * OrbitalBackground sits after the aurora and the network so it paints on top
 * of them, and before the grain so the grain still tops the stack.
 *
 * `lite` mounts one static gradient instead — no blur, no keyframes, no blend
 * mode, no canvas — painted once and then composited for free. It reuses the
 * same `--aurora-*` custom properties the blobs do, so it tracks the light and
 * dark themes without a second set of colours to keep in sync.
 *
 * See lib/render-tier.ts for who lands in which tier and the measurements
 * behind the split.
 */
import { useRenderTier } from "@/lib/render-tier";
import AuroraBackground from "@/components/layout/AuroraBackground";
import InteractiveNetwork from "@/components/layout/InteractiveNetwork";
import OrbitalBackground from "@/components/layout/orbital";
import GrainOverlay from "@/components/layout/GrainOverlay";

export default function AmbientBackground() {
    const tier = useRenderTier();

    if (tier === "lite") {
        return <div aria-hidden="true" className="ambient-static" />;
    }

    return (
        <>
            <AuroraBackground />
            <InteractiveNetwork />
            <OrbitalBackground />
            <GrainOverlay />
        </>
    );
}
