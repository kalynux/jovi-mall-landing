import { z } from "zod";
import type { UiRole } from "./auth.types";

// ─── Role Schema ─────────────────────────────────────────────────────────────
// Use z.enum() directly — avoids .transform() which widens the inferred type
// from the literal union to `string`, breaking react-hook-form type inference.
const UI_ROLE_VALUES = ["vendor", "agency", "agent", "customer"] as const;
export const UiRoleSchema = z.enum(UI_ROLE_VALUES);

// ─── Login ───────────────────────────────────────────────────────────────────
export const LoginSchema = z.object({
    identifier: z.string().min(1, "Phone number or email is required").trim(),
    password: z.string().min(6, "Password must be at least 6 characters"),
    role: UiRoleSchema.optional(),
});

export type LoginFormValues = z.infer<typeof LoginSchema>;

// ─── Register ────────────────────────────────────────────────────────────────
export const RegisterSchema = z
    .object({
        phone: z
            .string()
            .trim()
            // Backend requires at least 10 digits (api-doc/auth/README.md).
            // Count digits only so formatting (spaces, +, -) doesn't inflate length.
            .refine((v) => v.replace(/\D/g, "").length >= 10, {
                message: "Enter a valid phone number (at least 10 digits)",
            }),
        email: z.string().email("Invalid email").optional().or(z.literal("")),
        name: z.string().min(2, "Name must be at least 2 characters").trim(),
        password: z
            // Backend minimum is 6 characters (api-doc/auth/README.md).
            .string()
            .min(6, "Password must be at least 6 characters"),
        role: UiRoleSchema,
        business_name: z.string().optional(),
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
            if (!data.business_name?.trim()) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: "Business name is required for vendors",
                    path: ["business_name"],
                });
            }
        }
        if (data.role === "agency" && !data.agency_name?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Agency name is required",
                path: ["agency_name"],
            });
        }
    });

export type RegisterFormValues = z.infer<typeof RegisterSchema>;

// ─── Add Role ────────────────────────────────────────────────────────────────
export const AddRoleSchema = z
    .object({
        role: UiRoleSchema,
        name: z.string().optional(),
        business_name: z.string().optional(),
        agency_name: z.string().optional(),
    })
    .superRefine((data, ctx) => {
        // name is required for every non-customer role
        if (data.role !== "customer" && !data.name?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Name is required",
                path: ["name"],
            });
        }
        // vendor additionally requires business_name
        if (data.role === "vendor" && !data.business_name?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Business name is required for vendors",
                path: ["business_name"],
            });
        }
        // agency additionally requires agency_name
        if (data.role === "agency" && !data.agency_name?.trim()) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Agency name is required",
                path: ["agency_name"],
            });
        }
    });

export type AddRoleFormValues = z.infer<typeof AddRoleSchema>;
