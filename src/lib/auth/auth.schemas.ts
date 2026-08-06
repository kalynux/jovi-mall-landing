import { z } from "zod";
import type { UiRole } from "./auth.types";
import { PhoneSchema } from "@/lib/phone/phone.schema";
import { phoneErrorMessage, toE164, validatePhone } from "@/lib/phone/phone";

// ─── Role Schema ─────────────────────────────────────────────────────────────
// Use z.enum() directly — avoids .transform() which widens the inferred type
// from the literal union to `string`, breaking react-hook-form type inference.
const UI_ROLE_VALUES = ["vendor", "agency", "agent", "customer"] as const;
export const UiRoleSchema = z.enum(UI_ROLE_VALUES);

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
            message: `Must be at least ${BUSINESS_NAME_MIN} characters`,
            path: [path],
        });
        return;
    }
    if (trimmed.length > BUSINESS_NAME_MAX) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Must be at most ${BUSINESS_NAME_MAX} characters`,
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
        password: z.string().min(6, "Password must be at least 6 characters"),
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
                message: "Email is required",
                path: ["identifier"],
            });
            return;
        }
        if (!z.string().email().safeParse(data.identifier).success) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Invalid email",
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
        email: z.string().email("Invalid email").optional().or(z.literal("")),
        name: z.string().min(2, "Name must be at least 2 characters").trim(),
        password: z
            // Backend minimum is 6 characters (api-doc/auth/README.md).
            .string()
            .min(6, "Password must be at least 6 characters"),
        role: UiRoleSchema,
        /** Seeds Store.name — see refineBusinessName. */
        business_name: z.string().optional(),
        /** Seeds Magazin.name — see refineBusinessName. */
        agency_name: z.string().optional(),
    })
    .superRefine((data, ctx) => {
        if (data.role === "vendor") {
            // Email is required for vendors
            if (!data.email?.trim()) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Email is required for vendors",
                    path: ["email"],
                });
            }
            refineBusinessName(
                data.business_name,
                "business_name",
                "Business name is required for vendors",
                ctx
            );
        }
        if (data.role === "agency") {
            refineBusinessName(
                data.agency_name,
                "agency_name",
                "Agency name is required",
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
                message: "Name is required",
                path: ["name"],
            });
        }
        // vendor additionally requires business_name (seeds their Store)
        if (data.role === "vendor") {
            refineBusinessName(
                data.business_name,
                "business_name",
                "Business name is required for vendors",
                ctx
            );
        }
        // agency additionally requires agency_name (seeds their Magazin)
        if (data.role === "agency") {
            refineBusinessName(
                data.agency_name,
                "agency_name",
                "Agency name is required",
                ctx
            );
        }
    });

export type AddRoleFormValues = z.infer<typeof AddRoleSchema>;
