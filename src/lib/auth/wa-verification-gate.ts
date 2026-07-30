import type { AuthRoleEntity } from "./auth.types";

/**
 * Pure gate function — zero UI imports.
 *
 * Returns `true` when the current role entity still requires WhatsApp
 * verification before the user may proceed to their dashboard.
 *
 * The role entity may express verification in one of two shapes, so we accept
 * either as "done":
 *   A. a nested `wa` object — verified when `wa.verified === true` AND
 *      `wa.wa_phone_id` is a non-empty string (fully linked). api-doc/whatsapp/README.md
 *      §2 confirms `wa_phone_id` is the identifier that proves a live link, OR
 *   B. a top-level `phone_verified === true` flag — the only verification field
 *      in the documented role_entity payloads (api-doc/auth/README.md).
 *
 * No single doc covers both, so accepting either is the only reading consistent
 * with both — and it avoids permanently trapping a user at the gate when the
 * backend omits the `wa` object. If NEITHER signal is present the gate stays
 * active.
 *
 * This is the single source of truth for the WA gate decision.
 * No other module should derive this condition independently.
 */
export function requiresWaVerification(roleEntity: AuthRoleEntity): boolean {
    if (!roleEntity) return true;

    const waLinked =
        roleEntity.wa?.verified === true && Boolean(roleEntity.wa?.wa_phone_id);
    const phoneVerified = roleEntity.phone_verified === true;

    return !(waLinked || phoneVerified);
}
