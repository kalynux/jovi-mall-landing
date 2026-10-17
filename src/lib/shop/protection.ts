/**
 * Wi-Mall Protection — the `protection` block on a customer's order and booking
 * (backend 2026-10-10, `api-doc/customer/FRONTEND-CHANGELOG-wi-mall-protection.md`).
 *
 * Wi-Mall can settle a problem out of a purchase's money only while it still
 * holds that money. The window opens at delivery (an order) or when the seller
 * marks the service completed (a booking), and a problem reported inside it
 * puts the seller's payment on hold until the request ends.
 *
 * ── Render it, never work it out ─────────────────────────────────────────────
 *
 * The length of the window is the backend's setting, and it has already changed
 * once. Nothing here counts days or adds them to a date: the deadline is
 * `endsAt`, and `days` exists for copy that has no date to show.
 *
 * ── A display hint ───────────────────────────────────────────────────────────
 *
 * The block is computed from the order alone, so it can lag the real release of
 * the money by up to a day, in the customer's favour. What actually happened to
 * a request is `holds_earnings` on the ticket — read that after creating one.
 */
import type { TicketEntityType, TicketType } from "./tickets.api";

export interface CustomerProtection {
  /** The configured window. For copy only — the deadline is `endsAt`. */
  days: number;
  /** Delivery, or the service marked completed. `null` until then. */
  startsAt: string | null;
  /** When the window closes. `null` before it opens **and while the money is on hold**. */
  endsAt: string | null;
  status: "not_started" | "active" | "ended";
  /** The seller's payment is paused right now, whatever the reason. */
  onHold: boolean;
  /** …and the reason is this customer's own problem report. */
  problemReported: boolean;
}

/** The four things a screen can say about a `protection` block. */
export type ProtectionView =
  | { kind: "none" }
  | { kind: "active"; endsAt: string }
  | { kind: "on_hold" }
  | { kind: "ended"; endsAt: string };

const NONE: ProtectionView = { kind: "none" };

/**
 * Which notice to draw.
 *
 * `none` covers more than "not delivered yet": an API older than the field, a
 * booking completed before 2026-10-10 (no dates), a status this build does not
 * know, and money on hold for a reason that is not the customer's own report (a
 * refund in progress, a card dispute) — the changelog asks for nothing special
 * there. Anything without the date its sentence needs is `none` too, so no
 * notice is ever drawn around a hole.
 */
export function protectionViewOf(protection: CustomerProtection | null | undefined): ProtectionView {
  if (!protection) return NONE;
  if (protection.status === "active") {
    if (protection.endsAt) return { kind: "active", endsAt: protection.endsAt };
    return protection.problemReported ? { kind: "on_hold" } : NONE;
  }
  if (protection.status === "ended" && protection.endsAt) {
    return { kind: "ended", endsAt: protection.endsAt };
  }
  return NONE;
}

/* ── Reporting a problem ─────────────────────────────────────────────────── */

/** What a "Report a problem" button can be about. */
export type ProblemSubject = "ORDER" | "BOOKING";

/**
 * The ticket types that count as a problem report — the only ones that can put
 * the seller's payment on hold. Mirrors the backend's list
 * (`src/modules/tickets/domain/problem-report.rule.ts`).
 *
 * `INVOICE_REQUEST`, `ADDRESS_CHANGE`, `BOOKING_RESCHEDULE` and
 * `POLICY_QUESTION` are deliberately absent: a complaint filed under one of
 * them is created normally and holds nothing.
 */
export const PROBLEM_TICKET_TYPES: readonly TicketType[] = [
  "ORDER_ISSUE",
  "ORDER_CANCELLATION",
  "ORDER_REFUND",
  "ORDER_DISPUTE",
  "ORDER_FULFILLMENT",
  "PAYMENT_ISSUE",
  "CHARGEBACK",
  "BOOKING_ISSUE",
  "BOOKING_CANCELLATION",
  "PRODUCT_ISSUE",
  "SHIPPING_ISSUE",
  "DELIVERY_DELAY",
  "DELIVERY_CONFIRMATION",
  "GENERAL_SUPPORT",
  "OTHER",
];

/**
 * The type the ticket form starts on for each subject. Every one is a problem
 * type, so a complaint opened from an order or a booking holds the payment
 * unless the customer picks something else on purpose.
 */
export const DEFAULT_TICKET_TYPE = {
  ORDER: "ORDER_ISSUE",
  BOOKING: "BOOKING_ISSUE",
  PRODUCT: "PRODUCT_ISSUE",
  OTHER: "GENERAL_SUPPORT",
} as const satisfies Partial<Record<TicketEntityType, TicketType>>;

/**
 * What the new-ticket form was opened about, from its query string
 * (`?about=ORDER&id=…`, written by `reportProblemPath`). `null` for a form
 * opened on its own, or for anything else in those two parameters — the id is
 * checked by the backend on create, so a wrong one is a refused ticket, never a
 * ticket about someone else's order.
 */
export function ticketPrefillOf(params: {
  get(name: string): string | null;
}): { entityType: ProblemSubject; entityId: string } | null {
  const about = params.get("about");
  const id = params.get("id")?.trim();
  if (!id || (about !== "ORDER" && about !== "BOOKING")) return null;
  return { entityType: about, entityId: id };
}

/**
 * Which wording a ticket's on-hold banner takes. A parcel belongs to an order,
 * so a `SHIPMENT` ticket speaks of the order.
 */
export function heldPurchaseOf(entityType: TicketEntityType): "order" | "booking" {
  return entityType === "BOOKING" ? "booking" : "order";
}
