/**
 * The customer's view of a refund — the `refund` block on orders and bookings
 * (backend 2026-10-05, `api-doc/customer/orders.md` § The `refund` block).
 *
 * ── Render it, never work it out ─────────────────────────────────────────────
 *
 * Every number comes from the block. A mobile-money refund is sent back by
 * transfer minus a fee (2% by default, but an administrator sets it), so the
 * app never multiplies anything: `netAmount` is what the customer receives,
 * `grossAmount` and `feePercent` are only there to explain the difference.
 *
 * ── "Failed" does not exist here ─────────────────────────────────────────────
 *
 * The backend has no customer status for a failed transfer — it reads
 * `in_progress`, because the team retries it or pays it by hand and the
 * customer is still owed the money. `refundStatusOf` folds anything outside the
 * six documented words into `in_progress` too, so a status the API grows later
 * (or leaks) can never put "failed" on a customer's screen.
 *
 * ── Independent of `paymentStatus` and `deliveryFeeRefund` ───────────────────
 *
 * `paymentStatus` turns `refunded` only when the WHOLE order is refunded — an
 * order can stay `paid` with a completed partial refund. `deliveryFeeRefund` is
 * the separate delivery-fee ledger. Neither decides whether this panel shows;
 * `refund !== null` does.
 */
import type { IconName } from "@/components/shop/ds";

export type RefundStatus =
  | "requested"
  | "waiting_for_cash"
  | "sending"
  | "in_progress"
  | "completed"
  | "declined";

/** `null` while the team has not decided how to send it. */
export type RefundChannel = "card_refund" | "payout" | "external";

export interface CustomerRefund {
  status: RefundStatus;
  /** What the refund is worth, before the transfer fee. */
  grossAmount: number;
  /** The transfer fee kept; 0 for a card refund. */
  feeAmount: number;
  /** For the copy only ("minus a 2% transfer fee"); 0 for a card refund. */
  feePercent: number;
  /** ⭐ What the customer receives — the amount to show. */
  netAmount: number;
  currency: string;
  channel: RefundChannel | null;
  /** The number it goes to, already masked by the API; `null` for a card refund. */
  destinationMasked: string | null;
  /** COD only: approved, waiting for the courier's cash to reach the platform. */
  waitingForCash: boolean;
  /** ISO instant once completed. */
  completedAt: string | null;
}

type Tone = "brand" | "neutral" | "success" | "warning" | "danger" | "info";

const KNOWN: readonly RefundStatus[] = [
  "requested",
  "waiting_for_cash",
  "sending",
  "in_progress",
  "completed",
  "declined",
];

/** The status to render. Anything undocumented reads as `in_progress` — see the header. */
export function refundStatusOf(refund: CustomerRefund): RefundStatus {
  return KNOWN.includes(refund.status) ? refund.status : "in_progress";
}

/** Badge tone and icon per status. Copy lives in `shop.refund.*`. */
export const REFUND_CHIP: Record<RefundStatus, { tone: Tone; icon: IconName }> = {
  requested: { tone: "info", icon: "hourglass" },
  waiting_for_cash: { tone: "warning", icon: "banknote" },
  sending: { tone: "info", icon: "send" },
  in_progress: { tone: "info", icon: "refresh-cw" },
  completed: { tone: "success", icon: "circle-check-big" },
  declined: { tone: "danger", icon: "circle-x" },
};

/**
 * Whether to print the fee line. Only the API's own `feeAmount` decides — a
 * card refund carries 0 and must never mention a fee.
 */
export function refundHasFee(refund: CustomerRefund): boolean {
  return refund.channel !== "card_refund" && refund.feeAmount > 0;
}
