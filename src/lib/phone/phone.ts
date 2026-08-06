/**
 * Phone number core — the single source of truth for how this app parses,
 * formats, validates and normalises phone numbers.
 *
 * ## The value contract
 *
 * Every phone field in the app stores **one string**, and that string is
 * always international: a leading `+`, the selected country's calling code,
 * then whatever national digits have been typed so far.
 *
 *   typing "6 70"          in CM  →  "+2376 70"  ✗ never — spaces are stripped
 *   typing "6 70"          in CM  →  "+237670"
 *   completed number       in CM  →  "+237670000000"   ← valid E.164
 *   empty national portion         →  ""               ← treated as "no value"
 *
 * So the stored value is E.164 *exactly when the number is valid*, and a
 * partial prefix of it otherwise. That single rule is what lets the same string
 * be (a) round-tripped back into the input to restore country + digits,
 * (b) validated by Zod without any extra form state, and (c) handed to the
 * backend untouched once validation passes.
 *
 * Display formatting (grouping, spacing) lives only in the input's local UI
 * state — it is never part of the value.
 */
import {
    AsYouType,
    getCountryCallingCode,
    isSupportedCountry as isSupportedCountryLib,
    parsePhoneNumberFromString,
    validatePhoneNumberLength,
    type CountryCode,
} from "libphonenumber-js";
import { COUNTRIES, type CountryMeta } from "./countries.generated";

export type { CountryCode, CountryMeta };
export { COUNTRIES };

// ─── Default country ─────────────────────────────────────────────────────────

/**
 * Fallback when the profile carries no country.
 *
 * Matches the backend, which defaults `country` to `CM`
 * (api-doc/customer/profile.md → "defaults to `CM`").
 */
export const DEFAULT_COUNTRY: CountryCode = "CM";

// ─── Lookups ─────────────────────────────────────────────────────────────────

const BY_ISO2 = new Map<string, CountryMeta>(
    COUNTRIES.map((c) => [c.iso2, c])
);

/** Narrows an arbitrary string to a country we have metadata for. */
export function isSupportedCountry(value: unknown): value is CountryCode {
    return (
        typeof value === "string" &&
        BY_ISO2.has(value.toUpperCase()) &&
        isSupportedCountryLib(value.toUpperCase())
    );
}

export function getCountryMeta(iso2: string): CountryMeta | undefined {
    return BY_ISO2.get(iso2.toUpperCase());
}

/**
 * Coerces anything profile-shaped (`"cm"`, `"CM"`, `null`, `"Cameroon"`) into a
 * country we can actually select, falling back to {@link DEFAULT_COUNTRY}.
 */
export function resolveCountry(
    value: unknown,
    fallback: CountryCode = DEFAULT_COUNTRY
): CountryCode {
    if (typeof value === "string") {
        const upper = value.trim().toUpperCase();
        if (isSupportedCountry(upper)) return upper;
    }
    return fallback;
}

/** `"CM"` → `"237"`. Safe for any country in {@link COUNTRIES}. */
export function callingCodeOf(country: CountryCode): string {
    return BY_ISO2.get(country)?.callingCode ?? getCountryCallingCode(country);
}

/**
 * Regional-indicator flag emoji for an ISO-2 code.
 *
 * Windows ships no flag glyphs, so this degrades to the two letters of the
 * country code — which is still a correct, readable label rather than tofu.
 */
export function flagEmoji(iso2: string): string {
    return iso2
        .toUpperCase()
        .replace(/[A-Z]/g, (ch) =>
            String.fromCodePoint(0x1f1e6 + ch.charCodeAt(0) - 65)
        );
}

// ─── Value <-> (country, national) ───────────────────────────────────────────

export interface PhoneParts {
    country: CountryCode;
    /** Digits only, no calling code, no formatting. */
    national: string;
}

/**
 * Splits a stored value back into the country + national digits the input
 * renders.
 *
 * Deliberately tolerant: it accepts partials (`"+2376"`), values whose country
 * is ambiguous, and legacy values with no `+` at all — none of which
 * `parsePhoneNumberFromString` alone will resolve. `fallbackCountry` decides
 * the country whenever the value cannot name one itself, which is what keeps a
 * half-typed number from jumping between countries on every keystroke.
 */
export function parsePhoneValue(
    value: string | null | undefined,
    fallbackCountry: CountryCode = DEFAULT_COUNTRY
): PhoneParts {
    const raw = (value ?? "").trim();
    if (!raw) return { country: fallbackCountry, national: "" };

    // A value with no "+" cannot carry a country — treat it as national digits
    // typed under the fallback country. This is the migration path for numbers
    // stored before this module existed.
    if (!raw.startsWith("+")) {
        return { country: fallbackCountry, national: raw.replace(/\D/g, "") };
    }

    const digits = raw.slice(1).replace(/\D/g, "");
    if (!digits) return { country: fallbackCountry, national: "" };

    // Fast path — a parseable number tells us its own country.
    const parsed = parsePhoneNumberFromString(`+${digits}`);
    if (parsed?.country && isSupportedCountry(parsed.country)) {
        return { country: parsed.country, national: parsed.nationalNumber };
    }

    // Partial or non-geographic: keep the fallback country if its calling code
    // still prefixes the digits, so typing never yanks the selector around…
    const fallbackCc = callingCodeOf(fallbackCountry);
    if (digits.startsWith(fallbackCc)) {
        return { country: fallbackCountry, national: digits.slice(fallbackCc.length) };
    }

    // …otherwise fall back to the longest calling code that matches. Longest
    // wins because "1" (US) prefixes "1876" (JM) and the specific code is the
    // better guess.
    let best: CountryMeta | undefined;
    for (const c of COUNTRIES) {
        if (!digits.startsWith(c.callingCode)) continue;
        if (!best || c.callingCode.length > best.callingCode.length) best = c;
    }
    if (best) {
        return { country: best.iso2, national: digits.slice(best.callingCode.length) };
    }

    return { country: fallbackCountry, national: digits };
}

/**
 * The inverse of {@link parsePhoneValue} — assembles the stored value.
 * Returns `""` for an empty national part so "untouched" stays distinguishable
 * from "just a country code", which matters for `required` checks.
 */
export function buildPhoneValue(country: CountryCode, national: string): string {
    const digits = national.replace(/\D/g, "");
    if (!digits) return "";
    return `+${callingCodeOf(country)}${digits}`;
}

// ─── Display formatting ──────────────────────────────────────────────────────

export interface NationalInput {
    /** Text to render in the input. */
    display: string;
    /** Canonical national significant digits — no national prefix. */
    national: string;
    /**
     * Set only when the text itself named a country (it began with `+`), in
     * which case the selector should follow it.
     */
    country?: CountryCode;
}

/**
 * Formats what the user is typing, and extracts the canonical national digits
 * from it.
 *
 * Both halves come from `AsYouType` rather than a hand-rolled digit strip,
 * because a national prefix must be *shown* but must never reach the value.
 * Typing `08021234567` in Nigeria displays `0802 123 4567` while yielding the
 * national number `8021234567` → `+2348021234567`. Stripping non-digits by
 * hand would have produced `+2340802123456`, a different (wrong) number.
 *
 * Re-formatting is idempotent: feeding the formatted display back in produces
 * the same display and the same digits, which is what makes it safe to run on
 * every keystroke of a controlled input.
 */
export function formatNationalInput(
    rawInput: string,
    country: CountryCode
): NationalInput {
    const raw = rawInput.trimStart();
    if (!raw) return { display: "", national: "" };

    const formatter = new AsYouType(country);
    const display = formatter.input(raw);
    const national = formatter.getNationalNumber() || raw.replace(/\D/g, "");

    // A leading "+" means the user pasted or typed a full international
    // number; let it re-point the country selector.
    if (raw.startsWith("+")) {
        const detected = formatter.getCountry();
        const resolved =
            detected && isSupportedCountry(detected)
                ? detected
                : parsePhoneValue(raw, country).country;
        return {
            display: formatNationalFromValue(national, resolved),
            national,
            country: resolved,
        };
    }

    return { display, national };
}

/**
 * Renders stored national digits for display — used when a value arrives from
 * outside the input (prefill, reset, a country change), where there is no
 * in-progress typing to format incrementally.
 */
export function formatNationalFromValue(
    national: string,
    country: CountryCode
): string {
    const digits = national.replace(/\D/g, "");
    if (!digits) return "";

    // A complete number gets the country's own national convention, including
    // any national prefix ("0802 123 4567" for NG).
    const parsed = parsePhoneNumberFromString(`+${callingCodeOf(country)}${digits}`);
    if (parsed?.isValid()) return parsed.formatNational();

    // Partial: fall back to incremental formatting of the bare digits.
    return new AsYouType(country).input(digits) || digits;
}

/** Human-readable international form, e.g. `"+237 6 70 00 00 00"`. */
export function formatInternational(value: string): string {
    const parsed = parsePhoneNumberFromString(value);
    return parsed ? parsed.formatInternational() : value;
}

/** Placeholder for the national input — the country's own example number. */
export function examplePlaceholder(country: CountryCode): string {
    return BY_ISO2.get(country)?.example ?? "";
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Stable, translatable reasons a phone value can be rejected.
 * Rendered through the `phone.errors.*` i18n namespace — never shown raw.
 */
export type PhoneErrorCode =
    | "required"
    | "tooShort"
    | "tooLong"
    | "invalidCountry"
    | "invalid";

/** Prefix that marks a Zod message as one of our codes rather than free text. */
export const PHONE_ERROR_PREFIX = "phone.errors." as const;

export function phoneErrorMessage(code: PhoneErrorCode): string {
    return `${PHONE_ERROR_PREFIX}${code}`;
}

/**
 * Reads a code back out of a Zod message. Returns `null` for any message that
 * did not come from this module (a backend error, say), so callers can pass
 * those through untouched.
 */
export function parsePhoneErrorMessage(
    message: string | undefined
): PhoneErrorCode | null {
    if (!message?.startsWith(PHONE_ERROR_PREFIX)) return null;
    return message.slice(PHONE_ERROR_PREFIX.length) as PhoneErrorCode;
}

export interface ValidatePhoneOptions {
    /** When false, an empty value is accepted. Defaults to true. */
    required?: boolean;
}

/**
 * Validates a stored phone value against the numbering rules of the country it
 * names, and returns the reason it failed — or `null` when it is a valid,
 * dialable number.
 *
 * `validatePhoneNumberLength` is what separates "keep typing" from "that is
 * wrong": it distinguishes TOO_SHORT/TOO_LONG from a number that is the right
 * length but does not match any assigned prefix in that country.
 */
export function validatePhone(
    value: string | null | undefined,
    options: ValidatePhoneOptions = {}
): PhoneErrorCode | null {
    const { required = true } = options;
    const raw = (value ?? "").trim();

    if (!raw) return required ? "required" : null;
    if (!raw.startsWith("+")) return "invalid";

    const parsed = parsePhoneNumberFromString(raw);
    if (parsed?.isValid()) return null;

    const country = parsed?.country ?? parsePhoneValue(raw).country;
    const length = validatePhoneNumberLength(raw, country);

    switch (length) {
        case "TOO_SHORT":
        case "NOT_A_NUMBER":
            // NOT_A_NUMBER here means "nothing but a calling code so far".
            return "tooShort";
        case "TOO_LONG":
            return "tooLong";
        case "INVALID_COUNTRY":
            return "invalidCountry";
        default:
            return "invalid";
    }
}

/** Convenience predicate — `true` only for a complete, dialable number. */
export function isValidPhone(value: string | null | undefined): boolean {
    return validatePhone(value) === null;
}

/**
 * Final normalisation before a value leaves the app.
 *
 * Returns strict E.164 (`+237670000000`) or `null` if the value is not a valid
 * number — callers must treat `null` as "do not submit". Nothing should reach
 * the backend without passing through here.
 */
export function toE164(value: string | null | undefined): string | null {
    const raw = (value ?? "").trim();
    if (!raw) return null;
    const parsed = parsePhoneNumberFromString(raw);
    return parsed?.isValid() ? parsed.number : null;
}

/**
 * Best-effort E.164 for values that may have been entered without a country
 * selector (the login identifier, legacy stored numbers). Falls back to the
 * given country when the value carries no `+`.
 */
export function toE164WithCountry(
    value: string | null | undefined,
    country: CountryCode
): string | null {
    const raw = (value ?? "").trim();
    if (!raw) return null;
    const parsed = raw.startsWith("+")
        ? parsePhoneNumberFromString(raw)
        : parsePhoneNumberFromString(raw, country);
    return parsed?.isValid() ? parsed.number : null;
}

// ─── Country search ──────────────────────────────────────────────────────────

/**
 * Filters the country list for the selector's search box. Matches on name,
 * ISO-2 code and calling code, so "cam", "cm", "237" and "+237" all find
 * Cameroon.
 */
export function searchCountries(
    query: string,
    names: Record<string, string> = {}
): readonly CountryMeta[] {
    const q = query.trim().toLowerCase().replace(/^\+/, "");
    if (!q) return COUNTRIES;

    return COUNTRIES.filter((c) => {
        const localised = names[c.iso2]?.toLowerCase() ?? "";
        return (
            c.name.toLowerCase().includes(q) ||
            localised.includes(q) ||
            c.iso2.toLowerCase() === q ||
            c.callingCode.startsWith(q)
        );
    });
}
