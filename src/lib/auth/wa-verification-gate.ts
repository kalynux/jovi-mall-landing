import type { AuthRoleEntity } from "./auth.types";

/**
 * Pure gate function — zero UI imports.
 *
 * Returns `true` when the current role entity requires WhatsApp verification
 * before the user may proceed to their dashboard.
 *
 * Verification is considered complete only when BOTH conditions hold:
 *   1. `role_entity.wa.verified === true`
 *   2. `role_entity.wa.wa_phone_id` is a non-empty string
 *
 * If either is missing/falsy the gate is active.
 *
 * This is the single source of truth for the WA gate decision.
 * No other module should derive this condition independently.
 */
export function requiresWaVerification(roleEntity: AuthRoleEntity): boolean {
    return !(
        roleEntity.wa?.verified === true && Boolean(roleEntity.wa?.wa_phone_id)
    );
}
