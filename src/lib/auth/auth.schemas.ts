import { z } from "zod";
import type { UiRole } from "./auth.types";
import { PhoneSchema } from "@/lib/phone/phone.schema";
import { phoneErrorMessage, toE164, validatePhone } from "@/lib/phone/phone";

// ─── Role Schema ─────────────────────────────────────────────────────────────
// Use z.enum() directly — avoids .transform() which widens the inferred type
// from the literal union to `string`, breaking react-hook-form type inference.
const UI_ROLE_VALUES = ["customer", "vendor", "agency", "agent"] as const;
export const UiRoleSchema = z.enum(UI_ROLE_VALUES);

// ─── Field-error keys ────────────────────────────────────────────────────────
/**
 * **A schema never returns a sentence. It returns a key.**
 *
 * These schemas are module-level constants, built once at import time, outside
 * any React render — so there is no `useTranslations` to call and no locale to
 * read. That is the same wall `lib/shop/*` hit, and the same answer applies
 * (LOCALISATION.md §3): the module names the string, the call site resolves it.
 *
 * Here the "call site" is `useLocalizedResolver`, which wraps `zodResolver` and
 * translates every message as react-hook-form's error object is built. Doing it
 * there rather than at each `error={errors.x?.message}` is what makes this total:
 * a field added tomorrow is localised without anybody remembering to wrap it.
 *
 * `AUTH_FIELD_ERROR_PREFIX` is what keeps ours distinguishable from a backend
 * field message, which must be passed through untouched — the server already
 * wrote it in the shopper's language. Exactly the contract `phoneErrorMessage` /
 * `parsePhoneErrorMessage` established in `lib/phone/phone.ts`.
 */
export const AUTH_FIELD_ERROR_PREFIX = "auth.fieldErrors." as const;

/** Absolute catalogue key for one field-error code. */
function fieldError(code: string): string {
    return `${AUTH_FIELD_ERROR_PREFIX}${code}`;
}

/**
 * Reads a code back out of a Zod message. `null` for anything that did not come
 * from this module, so callers can pass those through.
 */
export function parseAuthFieldError(message: string | undefined): string | null {
    if (!message?.startsWith(AUTH_FIELD_ERROR_PREFIX)) return null;
    return message.slice(AUTH_FIELD_ERROR_PREFIX.length);
}

// ─── The numeric rules ───────────────────────────────────────────────────────
/**
 * Named because the catalogue interpolates them. "Password must be at least 6
 * characters" is one sentence with one number in it, not a sentence glued to a
 * number (§4) — so the message carries `{passwordMin}` and the value comes from
 * here, which keeps the rule and the copy from drifting apart.
 */
/** Backend minimum on register and login (api-doc/auth/README.md). */
const PASSWORD_MIN = 6;
/** The backend's stricter PasswordStrengthSchema, used on reset. */
const RESET_PASSWORD_MIN = 8;
const NAME_MIN = 2;
const IDENTIFIER_MIN = 3;
const CODE_MAX = 32;

// ─── Business name ───────────────────────────────────────────────────────────
/**
 * `business_name` / `agency_name` are NOT stored on the role profile.
 *
 * On register/add-role the backend puts the person's own `name` on the role
 * profile as `display_name`, then seeds the business name onto a *separate*
 * document — `Store.name` for a vendor, `Magazin.name` for an agency
 * (auth.service.ts → ensureStoreForVendor / ensureMagazinForAgency). This is
 * why the returned `role_entity` has no `business_name` / `agency_name` field.
 *
 * Both target schemas bound the name to 2–100 chars, but the auth endpoint
 * itself does not validate it: a shorter value is silently padded
 * ("A" → "A Store") and a longer one is truncated at 100. Enforce the real
 * bounds here so the name the user typed is the name that gets saved.
 */
const BUSINESS_NAME_MIN = 2;
/** Exported so the forms can cap the input at the same length the backend stores. */
export const BUSINESS_NAME_MAX = 100;

/** Roles whose business name is stored away from the role profile. */
export const ROLES_WITH_BUSINESS_NAME: readonly UiRole[] = ["vendor", "agency"];

/**
 * Every value an `auth.fieldErrors.*` message may interpolate, handed to `t()`
 * as one object. next-intl ignores the ones a given message does not name, so
 * the resolver does not have to know which key wants which number.
 */
export const AUTH_FIELD_ERROR_VALUES = {
    businessNameMin: String(BUSINESS_NAME_MIN),
    businessNameMax: String(BUSINESS_NAME_MAX),
    passwordMin: String(PASSWORD_MIN),
    resetPasswordMin: String(RESET_PASSWORD_MIN),
    nameMin: String(NAME_MIN),
    identifierMin: String(IDENTIFIER_MIN),
    codeMax: String(CODE_MAX),
} as const;

function refineBusinessName(
    value: string | undefined,
    path: "business_name" | "agency_name",
    requiredMessage: string,
    ctx: z.RefinementCtx
) {
    const trimmed = value?.trim() ?? "";

    if (!trimmed) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: requiredMessage, path: [path] });
        return;
    }
    if (trimmed.length < BUSINESS_NAME_MIN) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: fieldError("businessNameTooShort"),
            path: [path],
        });
        return;
    }
    if (trimmed.length > BUSINESS_NAME_MAX) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: fieldError("businessNameTooLong"),
            path: [path],
        });
    }
}

// ─── Login ───────────────────────────────────────────────────────────────────
/**
 * The backend takes a single `identifier` that may be either a phone number or
 * an email. The form asks which one is being entered, because a phone number
 * needs a country selector and E.164 normalisation and an email must not get
 * either — one field cannot honestly be both.
 *
 * `identifier_type` drives the UI only; it is stripped before submit.
 */
export const IDENTIFIER_TYPES = ["phone", "email"] as const;
export const IdentifierTypeSchema = z.enum(IDENTIFIER_TYPES);
export type IdentifierType = (typeof IDENTIFIER_TYPES)[number];

export const LoginSchema = z
    .object({
        identifier_type: IdentifierTypeSchema,
        identifier: z.string().trim(),
        password: z.string().min(PASSWORD_MIN, fieldError("passwordTooShort")),
        role: UiRoleSchema.optional(),
    })
    .superRefine((data, ctx) => {
        if (data.identifier_type === "phone") {
            const error = validatePhone(data.identifier, { required: true });
            if (error) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: phoneErrorMessage(error),
                    path: ["identifier"],
                });
            }
            return;
        }

        if (!data.identifier) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: fieldError("emailRequired"),
                path: ["identifier"],
            });
            return;
        }
        if (!z.string().email().safeParse(data.identifier).success) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: fieldError("emailInvalid"),
                path: ["identifier"],
            });
        }
    })
    // Normalise here rather than in the page so every caller of LoginSchema
    // gets an E.164 identifier, not just the one that remembered to convert.
    .transform((data) => ({
        ...data,
        identifier:
            data.identifier_type === "phone"
                ? (toE164(data.identifier) ?? data.identifier)
                : data.identifier,
    }));

export type LoginFormValues = z.infer<typeof LoginSchema>;

// ─── Register ────────────────────────────────────────────────────────────────
export const RegisterSchema = z
    .object({
        // Validated against the selected country's numbering rules and emitted
        // as strict E.164. The backend's own rule is a floor of 10 digits
        // (api-doc/auth/README.md); every number that satisfies its country's
        // plan and carries a calling code clears it.
        phone: PhoneSchema,
        email: z.string().email(fieldError("emailInvalid")).optional().or(z.literal("")),
        name: z.string().min(NAME_MIN, fieldError("nameTooShort")).trim(),
        password: z
            // Backend minimum is 6 characters (api-doc/auth/README.md).
            .string()
            .min(PASSWORD_MIN, fieldError("passwordTooShort")),
        role: UiRoleSchema,
        /** Seeds Store.name — see refineBusinessName. */
        business_name: z.string().optional(),
        /** Seeds Magazin.name — see refineBusinessName. */
        agency_name: z.string().optional(),
    })
    .superRefine((data, ctx) => {
        /**
         * ⚠️ **`email` is required for a vendor, and api-doc says otherwise.**
         *
         * api-doc/auth/README.md § POST /auth/register marks `email` "Optional
         * for **every** role, including vendor". The vendor *model* disagrees:
         * `email: { type: String, required: true, unique: true }`
         * (jovi-mall/src/modules/vendors/vendor.model.ts:387). It is the only
         * one of the four role models that does — agency, agent and customer all
         * register without one.
         *
         * The disagreement is not academic: `POST /auth/register` with a vendor
         * and no email answers **500 INTERNAL_SERVER_ERROR**, not a 400, because
         * the Mongoose validation error escapes as an unhandled failure.
         * Verified against the running backend, 2026-08-20.
         *
         * So this rule stays until the backend is fixed, and it is kept here
         * rather than left to the server on purpose: a client-side "Email is
         * required" is a field the user can fix, while the alternative is an
         * opaque "Something went wrong" with a requestId.
         */
        if (data.role === "vendor" && !data.email?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: fieldError("emailRequiredVendor"),
                path: ["email"],
            });
        }
        if (data.role === "vendor") {
            refineBusinessName(
                data.business_name,
                "business_name",
                fieldError("businessNameRequired"),
                ctx
            );
        }
        if (data.role === "agency") {
            refineBusinessName(
                data.agency_name,
                "agency_name",
                fieldError("agencyNameRequired"),
                ctx
            );
        }
    });

export type RegisterFormValues = z.infer<typeof RegisterSchema>;

// ─── Add Role ────────────────────────────────────────────────────────────────
export const AddRoleSchema = z
    .object({
        role: UiRoleSchema,
        name: z.string().optional(),
        /** Seeds Store.name — see refineBusinessName. */
        business_name: z.string().optional(),
        /** Seeds Magazin.name — see refineBusinessName. */
        agency_name: z.string().optional(),
    })
    .superRefine((data, ctx) => {
        // name is required for every non-customer role — it lands on the role
        // profile itself (display_name for vendor/agency, name for agent).
        if (data.role !== "customer" && !data.name?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: fieldError("nameRequired"),
                path: ["name"],
            });
        }
        // vendor additionally requires business_name (seeds their Store)
        if (data.role === "vendor") {
            refineBusinessName(
                data.business_name,
                "business_name",
                fieldError("businessNameRequired"),
                ctx
            );
        }
        // agency additionally requires agency_name (seeds their Magazin)
        if (data.role === "agency") {
            refineBusinessName(
                data.agency_name,
                "agency_name",
                fieldError("agencyNameRequired"),
                ctx
            );
        }
    });

export type AddRoleFormValues = z.infer<typeof AddRoleSchema>;

// ─── Password reset ──────────────────────────────────────────────────────────

/**
 * `POST /api/auth/forgot-password` takes an email **or** an E.164 phone in one
 * field.
 *
 * Not validated into one shape or the other here on purpose: the backend accepts
 * both, and guessing which the user meant in order to reject the other is how a
 * legitimate identifier gets refused before it is ever sent. A non-empty string
 * is the real rule; the endpoint answers 200 either way.
 */
export const ForgotPasswordSchema = z.object({
    identifier: z.string().trim().min(IDENTIFIER_MIN, fieldError("identifierRequired")),
});

export type ForgotPasswordFormValues = z.infer<typeof ForgotPasswordSchema>;

/**
 * `POST /api/auth/reset-password`.
 *
 * ⚠️ **Stricter than `RegisterSchema` above, and that is not a mistake.** Reset
 * uses the backend's `PasswordStrengthSchema` — 8 characters with an upper, a
 * lower, a digit and a symbol — which `PATCH /api/me/password` also enforces,
 * while registration still accepts 6 characters with no complexity rule. The two
 * genuinely disagree server-side; mirroring the loose rule here would let a user
 * submit a password the API then rejects.
 */
export const ResetPasswordSchema = z
    .object({
        password: z
            .string()
            .min(RESET_PASSWORD_MIN, fieldError("resetPasswordTooShort"))
            .regex(/[a-z]/, fieldError("passwordNeedsLowercase"))
            .regex(/[A-Z]/, fieldError("passwordNeedsUppercase"))
            .regex(/[0-9]/, fieldError("passwordNeedsDigit"))
            .regex(/[^A-Za-z0-9]/, fieldError("passwordNeedsSymbol")),
        confirm: z.string(),
    })
    .refine((data) => data.password === data.confirm, {
        message: fieldError("passwordMismatch"),
        path: ["confirm"],
    });

export type ResetPasswordFormValues = z.infer<typeof ResetPasswordSchema>;

// ─── Passwordless customer sign-in ───────────────────────────────────────────

/**
 * `POST /api/auth/magic/code` — the 8-character code the bot replies with,
 * paired with the phone or email it was minted for.
 *
 * The identifier is validated the same way `LoginSchema` validates its own: a
 * phone gets the country selector and E.164 normalisation, an email does not,
 * and the form asks which is being entered rather than guessing.
 *
 * ⚠️ **`code` is deliberately barely validated.** The server is already
 * forgiving about case, spacing, dashes, `O`/`0` and `I`/`L`, and it wants the
 * string verbatim (api-doc/auth/magic-login.md). A client-side strip or
 * uppercase is a second opinion that can only disagree with the first — so the
 * rule here is "not empty, not absurd", and the server decides.
 */
export const MagicCodeSchema = z
    .object({
        identifier_type: IdentifierTypeSchema,
        identifier: z.string().trim(),
        code: z
            .string()
            .trim()
            .min(1, fieldError("codeRequired"))
            .max(CODE_MAX, fieldError("codeTooLong")),
    })
    .superRefine((data, ctx) => {
        if (data.identifier_type === "phone") {
            const error = validatePhone(data.identifier, { required: true });
            if (error) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: phoneErrorMessage(error),
                    path: ["identifier"],
                });
            }
            return;
        }

        if (!data.identifier) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: fieldError("emailRequired"),
                path: ["identifier"],
            });
            return;
        }
        if (!z.string().email().safeParse(data.identifier).success) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: fieldError("emailInvalid"),
                path: ["identifier"],
            });
        }
    })
    .transform((data) => ({
        ...data,
        identifier:
            data.identifier_type === "phone"
                ? (toE164(data.identifier) ?? data.identifier)
                : data.identifier,
    }));

export type MagicCodeFormValues = z.infer<typeof MagicCodeSchema>;
