"use client";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * `false` during the server render and the hydrating client render, `true`
 * afterwards.
 *
 * For values that legitimately differ between server and client — anything
 * reading `localStorage`, `Intl` data or the DOM — this is the safe way to
 * gate them. `useSyncExternalStore` is what makes it safe: React knows to use
 * the server snapshot for hydration, so the two passes agree and no
 * setState-in-an-effect is needed to flip it.
 */
export function useHydrated(): boolean {
    return useSyncExternalStore(
        subscribe,
        () => true,
        () => false
    );
}
