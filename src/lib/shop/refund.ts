/**
 * The customer's view of a refund — the `refund` block on orders and bookings
 * (backend 2026-10-05, `api-doc/customer/orders.md` § The `refund` block).
 *
 * ── Render it, never work it out ─────────────────────────────────────────────
 *
 * Every number comes from the block. Since 2026-10-22 a refund can lose two
 * fees — the payment provider's, kept when the customer paid, and the transfer
 * fee to send it back — each only where it happened, and none when the seller
 * cancelled a paid order (the seller pays them). Administrators set the rates,
 * so the app never multiplies anything: `netAmount` is what the customer
 * receives, and `lines` (or, from an older API, `grossAmount` and
 * `feePercent`) only explain the difference.
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

/** The line codes the API documents (2026-10-22); copy lives in `shop.refund.lines.*`. */
export type RefundLineCode =
  | "refund_amount"
  | "payment_fee"
  | "transfer_fee"
  | "fees_paid_by_seller"
  | "you_receive";

export interface RefundLine {
  /** Switch on this for the copy; a code the app does not know falls back to `label`. */
  code: RefundLineCode | (string & {});
  /** The API's English label. */
  label: string;
  /** Signed: a fee is negative, `fees_paid_by_seller` is 0 (a note, not money). */
  amount: number;
  /** The percent behind a fee line, else `null`. */
  percent: number | null;
}

export interface CustomerRefund {
  status: RefundStatus;
  /** What the refund is worth, before any fee. */
  grossAmount: number;
  /** Everything deducted (payment fee + transfer fee since 2026-10-22); 0 when the seller pays. */
  feeAmount: number;
  /** The TRANSFER fee percent; 0 for a card refund. */
  feePercent: number;
  /** 🆕 2026-10-22 — kept by the payment provider when the customer paid; 0 for cash on delivery. */
  paymentFee?: number;
  paymentFeePercent?: number;
  /** 🆕 2026-10-22 — to send the money back; 0 for a card refund. */
  transferFee?: number;
  /** 🆕 2026-10-22 — `seller` when the seller cancelled after payment: the customer receives everything. */
  feesPaidBy?: "customer" | "seller";
  /**
   * 🆕 2026-10-22 — the refund line by line, adding up: refund − fees = you
   * receive. Optional until the backend that sends it is deployed.
   */
  lines?: RefundLine[];
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
 * The lines to list under the refund, or `null` when they would say nothing
 * the headline amount does not. The API only sends a fee line where that fee
 * happened (no transfer line on a card refund, no payment line on cash on
 * delivery) and a `fees_paid_by_seller` note when the seller carries them, so
 * the list is rendered as sent — never filtered, re-ordered or summed here.
 */
export function refundLines(refund: CustomerRefund): RefundLine[] | null {
  const lines = refund.lines;
  if (!lines?.length) return null;
  const explains = lines.some((l) => l.code !== "refund_amount" && l.code !== "you_receive");
  return explains ? lines : null;
}

/**
 * Whether to print the one-sentence fee line — the fallback for a block with
 * no `lines` (an API from before 2026-10-22). Only the API's own `feeAmount`
 * decides, and a card refund back then never carried a fee.
 */
export function refundHasFee(refund: CustomerRefund): boolean {
  return !refund.lines?.length && refund.channel !== "card_refund" && refund.feeAmount > 0;
}
