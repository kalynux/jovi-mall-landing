/**
 * The price of a booking and the customer's one reminder — the `pricing` and
 * `reminder` blocks on every customer booking read (backend 2026-11-03,
 * `api-doc/customer/FRONTEND-CHANGELOG-booking-price-proposal.md` and
 * `FRONTEND-CHANGELOG-booking-reminder.md`).
 *
 * ── Render it, never work it out ─────────────────────────────────────────────
 *
 * The server decides what is owed and what may be pressed. `pricing.topup` is
 * what a paid booking still owes, `pricing.amountPaid` what it has paid, and
 * `reminder.canSend` whether the button exists. Nothing here subtracts
 * `priceSnapshot` from anything: a difference is only ever read.
 *
 * ── `priceSnapshot` is now the AGREED price ──────────────────────────────────
 *
 * It moves when a proposal is accepted, so it no longer says what was booked or
 * what was paid. `agreedPrice` reads `pricing.currentPrice` and falls back to it
 * only for an API older than the block, where the two are the same number.
 *
 * Plain functions with no API import, so `node --test` can load this file.
 */

export type BookingPriceProposalStatus = "open" | "accepted" | "declined" | "withdrawn" | "lapsed";

/** Only the vendor proposes, so there is never a price for the customer to type. */
export interface BookingPriceProposal {
  status: BookingPriceProposalStatus;
  amount: number;
  previousAmount: number;
  proposedAt?: string | null;
  expiresAt: string;
  answeredAt?: string | null;
}

/** Past `dueAt` the booking is cancelled and what was paid is refunded. */
export interface BookingTopup {
  amount: number;
  dueAt: string;
}

export interface BookingPricing {
  /** What the customer booked at. The floor: a proposal never goes below it. */
  originalPrice: number;
  currentPrice: number;
  /** Towards the agreed price. `0` unless `paymentStatus` is `paid`. */
  amountPaid: number;
  proposal: BookingPriceProposal | null;
  /** `null` on a cancelled booking, whatever was due when it was cancelled. */
  topup: BookingTopup | null;
}

/** Computed for the reader: `sentAt` is the customer's, `receivedAt` the vendor's. */
export interface BookingReminder {
  canSend: boolean;
  sentAt: string | null;
  receivedAt: string | null;
}

interface PricedBooking {
  status: string;
  priceSnapshot: number;
  pricing?: BookingPricing | null;
}

/** The price to show and to charge the first payment at. */
export function agreedPrice(b: PricedBooking): number {
  return b.pricing?.currentPrice ?? b.priceSnapshot;
}

/** What was booked at, for showing beside the agreed price, or `null` when they match. */
export function changedFromPrice(b: PricedBooking): number | null {
  const p = b.pricing;
  return p && p.originalPrice !== p.currentPrice ? p.originalPrice : null;
}

/** A proposed price waiting for the customer's answer, or `null`. */
export function openPriceProposal(b: PricedBooking): BookingPriceProposal | null {
  return b.pricing?.proposal?.status === "open" ? b.pricing.proposal : null;
}

/**
 * The customer declined and the vendor has not confirmed since, so the next
 * cancel skips the vendor's policy. Once the booking is confirmed that is over.
 */
export function declinedPriceWaivesPolicy(b: PricedBooking): boolean {
  return b.status === "pending" && b.pricing?.proposal?.status === "declined";
}

/**
 * Whether taking this new price sends money back: the customer has paid more
 * than it. It only decides a sentence. The server does the refund, and it
 * arrives in the `refund` block.
 */
export function priceDropRefunds(b: PricedBooking, newPrice: number): boolean {
  return b.pricing ? newPrice < b.pricing.amountPaid : false;
}

/**
 * What a completed appointment still owes, without any price difference.
 *
 * ⚠ Since 2026-11-03 `GET …/balance` adds a difference into `outstanding`, while
 * `finalPrice` stays `null` until the appointment is settled. A screen that reads
 * `outstanding > 0` as "settled above the quote" would say so about a booking
 * nobody has settled. `topupDue` is optional for an API older than the field.
 */
export function settledBalanceOwed(balance: { outstanding: number; topupDue?: number }): number {
  return Math.max(0, balance.outstanding - (balance.topupDue ?? 0));
}
