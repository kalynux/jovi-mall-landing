/**
 * Who is on a support ticket, and how each of them is named.
 *
 * Pure, and kept apart from `tickets.api.ts` so it can be tested without the
 * API client. The contract is
 * `api-doc/customer/FRONTEND-CHANGELOG-ticket-followers.md`: since 2026-10-09 a
 * ticket about an order is followed by the order's seller, delivery company and
 * courier, and any of them may write a public reply.
 */

/** The roles a follower or a note author can hold — the backend's `ActorRole`. */
const TICKET_ROLES: ReadonlySet<string> = new Set([
  "customer",
  "vendor",
  "agency",
  "agent",
  "admin",
]);

/**
 * `vendor` → `shop.support.roles.vendor` ("Seller").
 *
 * `isSelf` is the signed-in customer's own entry, which reads "You" rather than
 * "Customer". A role this build has no name for returns `null`, and the caller
 * shows the person's name alone.
 */
export function ticketRoleLabelKey(role: string, isSelf = false): string | null {
  if (isSelf) return "shop.support.roles.self";
  return TICKET_ROLES.has(role) ? `shop.support.roles.${role}` : null;
}

/**
 * The role named by a "User added as follower (Role: agent)" system note, or
 * `null` for any other note.
 *
 * System notes are English sentences the backend writes, with no code beside
 * them, so this one is recognised by its text in order to be said in the
 * customer's language. Every other system note is shown as the backend wrote it.
 */
export function joinedRoleOf(content: string): string | null {
  const match = /^User added as follower \(Role: ([a-z_]+)\)$/.exec(content.trim());
  return match ? match[1] : null;
}
