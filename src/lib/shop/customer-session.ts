import { ApiError, type AuthStatus, type Role } from "@/lib/auth/auth.types";

/**
 * Which sessions the shop's own API will serve.
 *
 * ── Signed in is not the same as signed in as a customer ─────────────────────
 *
 * One account can hold four roles, and a web session is scoped to exactly one
 * of them: `GET /auth/me` answers the account's `roles` AND the single `role`
 * the cookie was minted for. Every owner-scoped route the shop calls — profile,
 * cart, wishlist, orders, bookings, tickets, notifications — is
 * `requireRole(['customer'])`, and `requireRole` answers any other role with
 * `403 AUTH_ROLE_NOT_FOUND`.
 *
 * So `status === "authenticated"` alone was the wrong test for "may this page
 * call the customer API". A vendor who opened the shop from the marketing site
 * got a page of 403s, rendered as "Something went wrong — the requested role
 * was not found on your account" beside a "Try again" that could never work,
 * because retrying the same cookie asks the same question.
 *
 * These are the two halves of that test, named once.
 */

/** Signed in, and scoped to the customer role — the only session the shop API serves. */
export function isCustomerSession(status: AuthStatus, role: Role | null): boolean {
  return status === "authenticated" && role === "customer";
}

/**
 * Signed in, but as a vendor, an agency or an agent.
 *
 * Every customer route answers this session `403 AUTH_ROLE_NOT_FOUND`, so a
 * shop screen that needs an account shows `CustomerOnlyNotice` instead of
 * asking. `role !== null` because a session we could not scope is not one we
 * can name to the person holding it.
 */
export function isBusinessSession(status: AuthStatus, role: Role | null): boolean {
  return status === "authenticated" && role !== null && role !== "customer";
}

/**
 * The refusal `requireRole(['customer'])` sends a business session.
 *
 * Code, not status: a 403 is also a suspended vendor, a closed account and a
 * dozen business-rule refusals, and none of those is fixed by changing role.
 */
export function isWrongRoleError(err: unknown): boolean {
  return err instanceof ApiError && err.code === "AUTH_ROLE_NOT_FOUND";
}
