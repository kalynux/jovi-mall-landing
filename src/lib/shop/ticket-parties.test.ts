/**
 * Who is on a ticket, against
 * `api-doc/customer/FRONTEND-CHANGELOG-ticket-followers.md`.
 *
 * Run with `npm test`.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { joinedRoleOf, ticketRoleLabelKey } from "./ticket-parties";

test("every role the backend can put on a ticket has a name", () => {
  for (const role of ["customer", "vendor", "agency", "agent", "admin"]) {
    assert.equal(ticketRoleLabelKey(role), `shop.support.roles.${role}`);
  }
});

test("the signed-in customer reads as themself, not as a customer", () => {
  assert.equal(ticketRoleLabelKey("customer", true), "shop.support.roles.self");
});

test("a role this build does not know has no label rather than a missing message", () => {
  assert.equal(ticketRoleLabelKey("moderator"), null);
  assert.equal(ticketRoleLabelKey(""), null);
});

test("the follower-added system note names the role that joined", () => {
  // The exact string `TicketFollowerService.addFollower` writes.
  assert.equal(joinedRoleOf("User added as follower (Role: agent)"), "agent");
  assert.equal(joinedRoleOf("User added as follower (Role: vendor)"), "vendor");
  assert.equal(joinedRoleOf("  User added as follower (Role: agency)\n"), "agency");
});

test("every other system note is left as the backend wrote it", () => {
  assert.equal(joinedRoleOf("User removed from followers"), null);
  assert.equal(joinedRoleOf("Ticket closed"), null);
  assert.equal(joinedRoleOf('Status changed from "open" to "resolved"'), null);
  // A customer typing the sentence into a reply is not a system note, and the
  // caller only asks about notes flagged `is_system_note` — but a sentence that
  // merely contains it must not match either.
  assert.equal(joinedRoleOf("fyi: User added as follower (Role: agent) yesterday"), null);
});
