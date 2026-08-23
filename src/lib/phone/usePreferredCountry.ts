"use client";
import { useCallback, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth/useAuth";
import { useHydrated } from "@/lib/use-hydrated";
import { DEFAULT_COUNTRY, isSupportedCountry, resolveCountry, type CountryCode } from "./phone";

/**
 * Where a phone field's country selector starts, in priority order:
 *
 *   1. `role_entity.country` — the ISO-2 code the user set during onboarding
 *      (api-doc/auth/README.md → BASIC_SETUP step 1). This is the "preferred
 *      country" the spec asks us to default to.
 *   2. The last country they explicitly picked in a selector, remembered
 *      locally. Registration happens before any profile exists, so without
 *      this a returning visitor would be back to the fallback every time.
 *   3. `DEFAULT_COUNTRY` (CM) — the same default the backend applies.
 *
 * (2) comes from `localStorage`, which does not exist on the server, so it is
 * read through `useSyncExternalStore`: React uses the server snapshot to
 * hydrate and the live one thereafter, so the two renders agree. Subscribing
 * also means every PhoneField on the page — and every other tab — follows a
 * change the moment it is made.
 */

const STORAGE_KEY = "wi-mall-phone-country";
/** The key from before the brand became `wi-mall`. Still read, never written. */
const PRE_RENAME_STORAGE_KEY = "wimall-phone-country";

const listeners = new Set<() => void>();

function notify() {
    for (const listener of listeners) listener();
}

function subscribe(onStoreChange: () => void) {
    listeners.add(onStoreChange);
    // `storage` only fires in *other* tabs, hence the local listener set too.
    window.addEventListener("storage", onStoreChange);
    return () => {
        listeners.delete(onStoreChange);
        window.removeEventListener("storage", onStoreChange);
    };
}

function getSnapshot(): string | null {
    try {
        // Must stay pure — useSyncExternalStore calls this on every render, so
        // the old key is read through rather than migrated here. `rememberCountry`
        // clears it the next time the user picks a country.
        return localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(PRE_RENAME_STORAGE_KEY);
    } catch {
        // Private mode / storage disabled — the preference is a nicety, not a
        // requirement. The profile country and the default still apply.
        return null;
    }
}

const getServerSnapshot = (): string | null => null;

/** Records an explicit country choice so the next form starts where this one ended. */
export function rememberCountry(country: CountryCode) {
    try {
        localStorage.setItem(STORAGE_KEY, country);
        localStorage.removeItem(PRE_RENAME_STORAGE_KEY);
    } catch {
        // See getSnapshot.
    }
    notify();
}

export interface PreferredCountry {
    country: CountryCode;
    /**
     * False until the profile has loaded and the stored choice has been read.
     * A field that is still empty should follow a late-arriving preference;
     * one the user has typed into must not be yanked out from under them.
     */
    resolved: boolean;
    /** Persist an explicit choice. */
    remember: (country: CountryCode) => void;
}

export function usePreferredCountry(): PreferredCountry {
    const { role_entity, status } = useAuth();
    const hydrated = useHydrated();
    const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

    const profileCountry = isSupportedCountry(role_entity?.country)
        ? resolveCountry(role_entity?.country)
        : null;
    const remembered = isSupportedCountry(stored) ? stored : null;

    const remember = useCallback((country: CountryCode) => {
        rememberCountry(country);
    }, []);

    return {
        country: profileCountry ?? remembered ?? DEFAULT_COUNTRY,
        resolved: hydrated && status !== "loading",
        remember,
    };
}
