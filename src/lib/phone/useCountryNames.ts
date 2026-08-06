"use client";
import { useMemo } from "react";
import { useLocale } from "@/lib/i18n-provider";
import { useHydrated } from "@/lib/use-hydrated";
import { COUNTRIES } from "./phone";

/**
 * Country names in the user's language.
 *
 * The baked list in countries.generated.ts is English — that keeps the server
 * and client renders identical, which is the whole point of generating it.
 * This hook layers `Intl.DisplayNames` on top once hydration is done, so
 * speakers of the other four locales get their own names without risking a
 * mismatch on a server-rendered field. If the runtime has no region data, the
 * English names simply stand.
 */
export function useCountryNames(): Record<string, string> {
    const { locale } = useLocale();
    const hydrated = useHydrated();

    return useMemo(() => {
        if (!hydrated || locale === "en") return {};

        let display: Intl.DisplayNames;
        try {
            display = new Intl.DisplayNames([locale], { type: "region" });
        } catch {
            return {};
        }

        const names: Record<string, string> = {};
        for (const country of COUNTRIES) {
            try {
                const name = display.of(country.iso2);
                // `of()` echoes the code back when it has no translation.
                if (name && name !== country.iso2) names[country.iso2] = name;
            } catch {
                // Skip this one; the English name remains.
            }
        }
        return names;
    }, [hydrated, locale]);
}
