/**
 * The customer proposes their own delivery fee (ADR-A12, 2026-10-14) —
 * `api-doc/customer/delivery-fee-changes.md` § Propose your own delivery fee.
 *
 * On a parcel whose delivery the customer pays, the customer may name a fee of
 * their own — higher or lower — and the delivery company accepts or declines.
 * The parcel is not picked up until it answers.
 *
 * 🔴 **No money arithmetic.** An accepted higher fee shows `topup.amount`, the
 * server's figure — never "proposed − current". These helpers only decide which
 * card to draw, whether the button shows, and whether what was typed is a
 * whole amount.
 */
import type { DeliveryFeeProposal, OrderDeliveryFees } from "./customer.types";

export type FeeShipment = OrderDeliveryFees["shipments"][number];

/** The same window as every fee change: with a delivery company, before pickup. */
const PROPOSAL_WINDOW: readonly string[] = ["assigned", "handing_over"];

export const REASON_MIN = 3;
export const REASON_MAX = 500;

/**
 * Whether "Propose a different fee" shows on this parcel. Only the payer may
 * propose — a shop-paid parcel answers `422 …_NOT_PAYER` — and only while
 * nothing else waits on it (`409 …_ALREADY_PENDING`).
 */
export function canProposeFee(shipment: FeeShipment): boolean {
  return (
    shipment.deliveryPayer === "customer" &&
    shipment.pendingProposalId === null &&
    PROPOSAL_WINDOW.includes(shipment.status)
  );
}

/** Proposals the customer may make on one parcel; withdrawn ones do not count. */
export const MAX_OWN_PROPOSALS = 2;

/**
 * Whether the customer has used their proposals on this parcel, read from the
 * proposal list — so the button stays hidden after a reload, not only after
 * the server has answered `422 …_LIMIT_REACHED` once. That answer still wins
 * if the server ever counts differently (the screen remembers it too).
 */
export function proposalLimitReached(proposals: readonly DeliveryFeeProposal[], shipmentId: string): boolean {
  const used = proposals.filter(
    (p) => p.raisedBy === "you" && p.shipmentId === shipmentId && p.status !== "withdrawn",
  ).length;
  return used >= MAX_OWN_PROPOSALS;
}

/**
 * Where the customer's own proposal stands, or `null` when it is not theirs.
 *
 *   - `waiting` — unanswered: edit or withdraw;
 *   - `pay`     — accepted, higher, online: the difference is due (pay, or
 *                 decline = take it back);
 *   - `closed`  — accepted and applied, declined, or withdrawn.
 *
 * Read from `availableActions` and `topup` alone, so a state the API grows
 * later falls to `closed` (no buttons) rather than to a button it would refuse.
 */
export function ownProposalStage(p: DeliveryFeeProposal): "waiting" | "pay" | "closed" | null {
  if (p.raisedBy !== "you") return null;
  if (p.topup?.status === "awaiting_payment" && p.availableActions.includes("pay")) return "pay";
  if (p.availableActions.includes("withdraw") || p.availableActions.includes("edit")) return "waiting";
  return "closed";
}

/**
 * What was typed in the amount field, as a whole amount — or `null`.
 *
 * Plain digits, or digits grouped in threes — so `1 000`, `1.000` and `1,000`
 * (how people write money here) all read as a thousand — while `12.5`, `1,50`
 * or `-3` read as nothing rather than as a figure the customer did not mean.
 * A parse, not arithmetic: the figure is sent as typed.
 */
export function parseWholeAmount(input: string): number | null {
  const trimmed = input.trim();
  if (!/^(\d+|\d{1,3}([\s  .,]\d{3})+)$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length > 9 ? null : Number(digits);
}

/** The reason as the server will judge it: trimmed, 3–500 characters. */
export function reasonIsValid(reason: string): boolean {
  const n = reason.trim().length;
  return n >= REASON_MIN && n <= REASON_MAX;
}
