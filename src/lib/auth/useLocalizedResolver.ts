"use client";
import { useTranslations } from "next-intl";
import {
    AUTH_FIELD_ERROR_PREFIX,
    AUTH_FIELD_ERROR_VALUES,
} from "./auth.schemas";
import { PHONE_ERROR_PREFIX } from "@/lib/phone/phone";
import { lookupMessage } from "./error-translator";

/**
 * Wraps a react-hook-form resolver so every validation message comes out in the
 * visitor's language.
 *
 *     const { ... } = useForm<LoginFormValues>({
 *         resolver: useLocalizedResolver(zodResolver(LoginSchema)),
 *     });
 *
 * ── Why here and not at each `error={errors.x?.message}` ─────────────────────
 *
 * The schemas in `auth.schemas.ts` are module-level constants, evaluated once at
 * import time with no React render around them — so they emit *keys* rather than
 * sentences (LOCALISATION.md §3). Something has to turn those back into copy,
 * and there are two places it could go: every call site that renders a field
 * error, or the one seam every field error passes through on its way there.
 *
 * This is that seam. Six forms render roughly twenty error slots between them,
 * and the count only grows — resolving per call site means each new field is a
 * fresh chance to forget, with no failure louder than a raw
 * `auth.fieldErrors.emailRequired` appearing under an input. Resolving here is
 * total by construction: a field added tomorrow is localised without anybody
 * doing anything.
 *
 * ── Only OUR keys are touched ────────────────────────────────────────────────
 *
 * A message that carries neither prefix is passed through untouched, because it
 * is the backend's own per-field text and the server already wrote it in the
 * shopper's language (`mapApiErrors` → `translateFieldCode`). Translating it
 * again is not possible and overwriting it would lose the only specific thing
 * the server said. Same contract `usePhoneErrorText` has always had.
 *
 * `PhoneField` still resolves phone codes itself — it is used outside these
 * forms too. Doing it in both places is harmless: by the time the field sees the
 * message it is already prose, `parsePhoneErrorMessage` returns null, and it is
 * passed through.
 */

/** Keys whose values are never a message, and must not be walked into. */
const SKIP_KEYS = new Set(["ref"]);

/**
 * Rewrite every `message` in a react-hook-form error tree, in place.
 *
 * In place because the object is RHF's own and is about to be handed straight
 * back to it — rebuilding it would mean reproducing a shape (`root`, nested
 * field paths, `types`) that is not ours to reproduce.
 *
 * `ref` is skipped: on a registered field it holds the DOM node, and recursing
 * into an HTMLInputElement walks the whole document.
 */
function localizeMessages(node: unknown, resolve: (message: string) => string): void {
    if (Array.isArray(node)) {
        for (const item of node) localizeMessages(item, resolve);
        return;
    }
    if (!node || typeof node !== "object") return;

    const record = node as Record<string, unknown>;

    if (typeof record.message === "string") {
        record.message = resolve(record.message);
    }

    // `criteriaMode: "all"` collects every failed rule here rather than only the
    // first. None of these forms set it today, but a message left untranslated
    // because of a prop somebody turned on later is not a good failure mode.
    if (record.types && typeof record.types === "object") {
        const types = record.types as Record<string, unknown>;
        for (const [rule, value] of Object.entries(types)) {
            if (typeof value === "string") types[rule] = resolve(value);
        }
    }

    for (const [key, value] of Object.entries(record)) {
        if (key === "message" || key === "types" || SKIP_KEYS.has(key)) continue;
        localizeMessages(value, resolve);
    }
}

/**
 * The generic is the resolver's own signature, passed straight through, so the
 * wrapped resolver types exactly as `zodResolver(Schema)` did — including the
 * input/output split the `.transform()` on `LoginSchema` and `MagicCodeSchema`
 * introduces, which a hand-written `Resolver<T>` annotation would flatten.
 */
type ResolverFn<TArgs extends unknown[], TResult> = (...args: TArgs) => TResult;

export function useLocalizedResolver<TArgs extends unknown[], TResult>(
    resolver: ResolverFn<TArgs, TResult>
): ResolverFn<TArgs, TResult> {
    // Root-scoped: the messages are absolute dotted keys, so there is no
    // namespace to scope to. `tKey` is the house name for this (§2).
    const tKey = useTranslations();

    const resolve = (message: string): string => {
        if (
            !message.startsWith(AUTH_FIELD_ERROR_PREFIX) &&
            !message.startsWith(PHONE_ERROR_PREFIX)
        ) {
            return message;
        }
        // `lookupMessage` treats both next-intl miss behaviours — throwing, and
        // echoing the key back — as a miss, so a key that is not in the
        // catalogue degrades to itself rather than crashing the form.
        return lookupMessage(tKey, message, AUTH_FIELD_ERROR_VALUES) ?? message;
    };

    // Not memoised, deliberately. `zodResolver(Schema)` is already rebuilt on
    // every render at each call site, so there is nothing stable to memoise
    // against, and RHF reads the resolver from a per-render ref anyway.
    return ((...args: TArgs) =>
        Promise.resolve(resolver(...args)).then((result) => {
            localizeMessages((result as { errors?: unknown })?.errors, resolve);
            return result;
        })) as ResolverFn<TArgs, TResult>;
}
