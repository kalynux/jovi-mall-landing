import { z } from "zod";
import {
    phoneErrorMessage,
    toE164,
    validatePhone,
    type PhoneErrorCode,
} from "./phone";

/**
 * Zod schemas for the app's phone value contract (see phone.ts).
 *
 * Messages are stable codes (`phone.errors.tooShort`), not sentences — every
 * form renders them through the same `phone.errors.*` i18n namespace, which is
 * what keeps the wording identical on register, login and checkout.
 */

function issue(ctx: z.RefinementCtx, code: PhoneErrorCode) {
    ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: phoneErrorMessage(code),
    });
}

/**
 * A required phone number.
 *
 * Validates against the numbering rules of the country the value names, then
 * **transforms to strict E.164** — so anything downstream of `parse()` is
 * guaranteed normalised and no caller has to remember to convert.
 */
export const PhoneSchema = z
    .string()
    .trim()
    .superRefine((value, ctx) => {
        const error = validatePhone(value, { required: true });
        if (error) issue(ctx, error);
    })
    .transform((value) => toE164(value) ?? value);

/**
 * An optional phone number: `""`/absent passes and normalises to `undefined`,
 * but anything actually typed must be a complete, valid number.
 */
export const OptionalPhoneSchema = z
    .string()
    .trim()
    .optional()
    .superRefine((value, ctx) => {
        const error = validatePhone(value, { required: false });
        if (error) issue(ctx, error);
    })
    .transform((value) => (value ? (toE164(value) ?? value) : undefined));
