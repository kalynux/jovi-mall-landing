"use client";
import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { parsePhoneErrorMessage, type PhoneErrorCode } from "./phone";

/**
 * Turns a phone error — either a {@link PhoneErrorCode} or a raw Zod/API
 * message — into display text.
 *
 * Anything that did not come from the phone module (a backend field error, for
 * instance) is passed through untouched, so a form can hand the whole of
 * `errors.phone?.message` to this without first working out where it came from.
 */
export function usePhoneErrorText() {
    const t = useTranslations("phone");

    return useCallback(
        (error: PhoneErrorCode | string | undefined | null): string | undefined => {
            if (!error) return undefined;

            const code = parsePhoneErrorMessage(error) ?? error;
            const known: PhoneErrorCode[] = [
                "required",
                "tooShort",
                "tooLong",
                "invalidCountry",
                "invalid",
            ];

            if (known.includes(code as PhoneErrorCode)) {
                return t(`errors.${code}` as Parameters<typeof t>[0]);
            }
            return error;
        },
        [t]
    );
}
