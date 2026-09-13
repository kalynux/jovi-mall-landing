"use client";
import { useEffect, useState } from "react";

/**
 * How much rendering work this device can actually afford.
 *
 * The landing page's ambience is four stacked full-viewport layers: three
 * animated aurora blobs behind a `filter: blur(56px)`, a rAF canvas, the
 * orbital scene (two `blur(70px)` washes plus six blurred clouds), and a fixed
 * `mix-blend-mode: overlay` grain sheet over all of it. On a desktop GPU that
 * is a rounding error. On a mid-range Android phone it is the entire frame
 * budget and then some — measured on a TECNO SPARK 30 over the DevTools
 * protocol, sitting completely still on the hero:
 *
 *     all four layers on ..................... 10.1 fps   (100ms/frame)
 *     grain off .............................. 14.3 fps
 *     canvas off ............................. 16.9 fps
 *     aurora off ............................. 22.4 fps
 *     orbital off ............................ 24.3 fps
 *     all four off ........................... 42.0 fps
 *     replaced by the static wash ............ 46.3 fps    (22ms/frame)
 *
 * Nothing was animating on screen in any of those runs and long-task time was
 * negligible, so this was never JavaScript blocking the main thread — it is
 * raster and compositing cost, which is why it showed up identically whether
 * the visitor scrolled or sat still.
 *
 * So: `lite` devices get a single static gradient wash that reproduces the
 * same green ambience for free, and `full` devices get the real thing,
 * unchanged.
 *
 * `pointer: coarse` is the primary signal, and not only as a proxy for a
 * weaker GPU: two of the four layers exist to react to a *cursor* (the network
 * gathers its nodes toward the pointer, the soft-light glare tracks it), so on
 * a touch screen they are paying full price for an interaction that cannot
 * happen.
 */
export type RenderTier = "lite" | "full";

interface NavigatorWithHints extends Navigator {
    /** Chrome-only, in GiB, clamped to 8. Absent elsewhere. */
    deviceMemory?: number;
}

export function useRenderTier(): RenderTier {
    /*
     * `lite` is the value the server renders and the value the first client
     * render agrees on. Deciding during render would read matchMedia on a
     * machine that has none, and starting at `full` would make every phone
     * mount the expensive stack — the worst case — for a frame before tearing
     * it back down. Starting cheap means the upgrade, not the downgrade, is
     * the thing that happens after mount.
     */
    const [tier, setTier] = useState<RenderTier>("lite");

    useEffect(() => {
        const coarse = window.matchMedia("(pointer: coarse)");
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
        const nav = navigator as NavigatorWithHints;

        // Both hints are optional; absent means "no reason to worry", so the
        // fallbacks are deliberately generous rather than 0.
        const underpowered =
            (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;

        const decide = () =>
            setTier(coarse.matches || reduced.matches || underpowered ? "lite" : "full");

        decide();
        coarse.addEventListener("change", decide);
        reduced.addEventListener("change", decide);
        return () => {
            coarse.removeEventListener("change", decide);
            reduced.removeEventListener("change", decide);
        };
    }, []);

    return tier;
}
