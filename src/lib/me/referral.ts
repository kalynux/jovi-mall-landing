/**
 * The referral program, as the page reads it — types and the decisions built on
 * them. No fetching here, so `npm test` can import it (see `referral.api.ts`).
 *
 * Contract: api-doc/me/referrals.md. Rules the copy must not contradict:
 * api-doc/FRONTEND-CHANGELOG-referrals.md.
 *
 * ⚠ **Every rate, duration, wait and minimum comes from the response.** They are
 * set by Wi-Mall and can differ per partner, so none of them appears in code or
 * in the catalogues, not even as a default. That includes the wait before a
 * commission counts as earned: no field carries it, so the copy names no figure.
 *
 * ⛔ The lists carry no order, product, vendor or commission on purpose, because
 * a commission reveals a vendor's sales and an order reveals what a person bought.
 * Never ask for them.
 */

export type ReferralStatus = "none" | "pending" | "active" | "rejected" | "suspended" | "terminated";
/**
 * `provider` (2026-11-08): a service provider, who pays Wi-Mall for plans and
 * credits rather than commission on sales. A seller referred as `vendor` still
 * earns on sales only.
 */
export type EarningCategory = "vendor" | "customer" | "agency" | "provider";
export type ReferredCategory = EarningCategory | "agent";
/** Where a destination was read from. `referral` is the one saved on this page. */
export type PayoutSource = "vendor" | "agency" | "agent" | "referral";

export interface ReferralProgram {
  enabled: boolean;
  minPayoutAmount: number;
  rewardWaitDays: number;
}

export interface ReferralLinks {
  registerUrl: string | null;
  whatsappUrl: string | null;
  telegramUrl: string | null;
}

export interface ReferralBalances {
  /** Rewards still in the wait. */
  pending: number;
  available: number;
  reserve: number;
  requested: number;
  /** ⚠ What the partner owes back. It runs the other way: never add it to the rest. */
  clawback: number;
  currency: string;
}

export interface MaskedPayoutMethod {
  method: "mobile_money" | "bank" | "card";
  is_preferred?: boolean;
  mobile_money: { provider: string; phone_number_masked: string; account_name: string } | null;
  bank: { bank_name: string; account_number_masked: string; account_name: string } | null;
  card: { brand: string; number_masked: string; card_holder_name: string } | null;
}

export interface PayoutDestination {
  source: PayoutSource | null;
  editableHere: boolean;
  method: MaskedPayoutMethod | null;
}

/** Someone who never applied gets `program`, `status` and `canApply` and nothing else. */
export interface ReferralOverview {
  program: ReferralProgram;
  status: ReferralStatus;
  canApply: boolean;
  statusReason?: string | null;
  code?: string | null;
  /** False while suspended or terminated: the link registers people but earns nothing. */
  codeActive?: boolean;
  links?: ReferralLinks | null;
  appliedAt?: string;
  approvedAt?: string | null;
  terms?: Partial<Record<EarningCategory, { ratePercent: number; durationMonths: number }>>;
  balances?: ReferralBalances;
  balanceFrozen?: boolean;
  canWithdraw?: boolean;
  payoutDestination?: PayoutDestination;
  referred?: { total: number; earning: number };
}

export interface ReferredAccount {
  id: string;
  /** Masked by the backend. */
  name: string;
  category: string;
  registeredAt: string;
  /** `null` for an agent, who is recorded and never earns. */
  expiresAt: string | null;
  earning: boolean;
  totalEarned: number;
}

export interface ReferralReward {
  id: string;
  name: string;
  category: string;
  /** What it is worth now, after any refund. */
  amount: number;
  currency: string;
  status: string;
  earnedAt: string;
  availableFrom: string;
  /** A refund reduced it. */
  adjusted: boolean;
  /**
   * On a **provider** reward, what the provider paid for (2026-11-08). `null`
   * on every other reward. ⛔ The amount the provider paid is never published
   * and must never be asked for (owner RS-7).
   */
  paymentKind?: "plan" | "credits" | null;
}

export interface ReferralPayout {
  id: string;
  amount: number;
  currency: string;
  status: string;
  destination: MaskedPayoutMethod | null;
  rejectionReason: string | null;
  requestedAt: string;
  resolvedAt: string | null;
}

/** `GET /api/public/referral/:code`. An unusable code answers `valid: false`, links without a code. */
export interface ReferralLookup extends ReferralLinks {
  valid: boolean;
  code: string | null;
}

// ─── The code in a link ──────────────────────────────────────────────────────

/** Mirrors `normalizeReferralCode` in the backend's referral-rules.ts. */
const CODE_PATTERN = /^[A-Z0-9]{4,20}$/;

/**
 * `?ref=` as something worth sending, or `null`.
 *
 * Not only tidiness: the API caps `referral_code` at 40 characters, and a longer
 * one fails validation. "A bad code never refuses a registration" holds for a
 * code it can read, so a mangled link must not reach the form's payload.
 */
export function cleanReferralCode(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/**
 * What a registration form sends as `referral_code`.
 *
 * A lookup that failed says nothing about the code, and the backend decides
 * anyway, so the link's code still goes. Only an explicit `valid: false` drops it.
 */
export function referralCodeToSend(
  cleaned: string | null,
  lookup: ReferralLookup | null,
): string | null {
  if (!cleaned) return null;
  if (!lookup) return cleaned;
  return lookup.valid ? (lookup.code ?? cleaned) : null;
}

// ─── What the page shows ─────────────────────────────────────────────────────

export interface ReferralView {
  /** Nothing to do yet: the program is not open and this person has no history. */
  closed: boolean;
  reviewing: boolean;
  /** Which "this ended or stopped" notice to lead with. */
  notice: "rejected" | "suspended" | "terminated" | null;
  form: boolean;
  share: boolean;
  /** The code still shows, with a note that it earns nothing. */
  deadCode: boolean;
  terms: boolean;
  /** Balances and history. Earned rewards stay recorded for a former partner. */
  money: boolean;
  destination: boolean;
  /** An active partner whose link stopped counting because the program is off. */
  paused: boolean;
}

export function referralView(o: ReferralOverview): ReferralView {
  const { status } = o;
  const notice =
    status === "rejected" || status === "suspended" || status === "terminated" ? status : null;
  const active = status === "active";
  const everPartner = active || status === "suspended" || status === "terminated";

  return {
    closed: status === "none" && !o.canApply,
    reviewing: status === "pending",
    notice,
    form: o.canApply && (status === "none" || status === "rejected" || status === "terminated"),
    share: active && o.codeActive !== false && !!o.links,
    deadCode: (status === "suspended" || status === "terminated") && !!o.code,
    terms: active && !!o.terms,
    money: (active || notice !== null) && !!o.balances,
    destination: everPartner && !!o.payoutDestination,
    paused: active && !o.program.enabled,
  };
}

export type WithdrawBlocker = "frozen" | "inProgress" | "owes" | "belowMinimum" | "noDestination";

/**
 * Why there is no withdraw button. `canWithdraw` alone decides the button; this
 * only words the line that replaces it, most useful reason first.
 */
export function withdrawBlocker(o: ReferralOverview): WithdrawBlocker | null {
  if (o.canWithdraw || !o.balances) return null;
  if (o.balanceFrozen) return "frozen";
  if (o.balances.requested > 0) return "inProgress";
  if (o.balances.clawback > 0) return "owes";
  if (o.balances.available < o.program.minPayoutAmount) return "belowMinimum";
  return o.payoutDestination?.method ? null : "noDestination";
}

/** The balances that add up to something the partner holds, in display order. Never `clawback`. */
export function balanceRows(b: ReferralBalances): { key: "available" | "pending" | "requested" | "reserve"; amount: number }[] {
  return [
    { key: "available" as const, amount: b.available },
    { key: "pending" as const, amount: b.pending },
    ...(b.requested > 0 ? [{ key: "requested" as const, amount: b.requested }] : []),
    ...(b.reserve > 0 ? [{ key: "reserve" as const, amount: b.reserve }] : []),
  ];
}

/** Where a role's destination is edited. The agent app has one screen and no web page. */
export const PAYOUT_PAGE: Record<Exclude<PayoutSource, "referral">, string> = {
  vendor: "/dashboard/account/payout",
  agency: "/dashboard/account/payout",
  agent: "",
};

// ─── Rows ────────────────────────────────────────────────────────────────────

export function referredState(row: ReferredAccount): "earning" | "ended" | "neverEarns" {
  if (row.expiresAt === null) return "neverEarns";
  return row.earning ? "earning" : "ended";
}

/** A whole refund shows as 0, whatever `amount` still says. */
export function rewardShownAmount(row: ReferralReward): number {
  return row.status === "reversed" ? 0 : row.amount;
}

export type RewardStatus = "held" | "released" | "reversed";
export function rewardStatusOf(status: string): RewardStatus {
  return status === "released" || status === "reversed" ? status : "held";
}

export type PayoutStatus = "pending" | "processing" | "paid" | "rejected" | "failed";
/** A status this build does not know reads as still open, never as a verdict. */
export function payoutStatusOf(status: string): PayoutStatus {
  return status === "processing" || status === "paid" || status === "rejected" || status === "failed"
    ? status
    : "pending";
}

const CATEGORIES: readonly string[] = ["customer", "vendor", "provider", "agency", "agent"];
export function knownCategory(category: string): ReferredCategory | null {
  return CATEGORIES.includes(category) ? (category as ReferredCategory) : null;
}

// ─── Payout destination, as text ─────────────────────────────────────────────

/** `provider` is free text on the wire: `mtn` here, `MTN Mobile Money` from the vendor app. */
export function payoutProviderName(provider: string): string {
  const p = provider.trim().toLowerCase();
  if (p.startsWith("mtn")) return "MTN Mobile Money";
  if (p.startsWith("orange")) return "Orange Money";
  if (p.startsWith("moov")) return "Moov Money";
  return provider;
}

/** All three kinds, since a role's stored destination may predate mobile-money-only. */
export function maskedPayout(
  method: MaskedPayoutMethod | null | undefined,
): { name: string; number: string; holder: string } | null {
  if (method?.mobile_money) {
    return {
      name: payoutProviderName(method.mobile_money.provider),
      number: method.mobile_money.phone_number_masked,
      holder: method.mobile_money.account_name,
    };
  }
  if (method?.bank) {
    return {
      name: method.bank.bank_name,
      number: method.bank.account_number_masked,
      holder: method.bank.account_name,
    };
  }
  if (method?.card) {
    return {
      name: method.card.brand,
      number: method.card.number_masked,
      holder: method.card.card_holder_name,
    };
  }
  return null;
}

// ─── Sharing ─────────────────────────────────────────────────────────────────

/**
 * "Send this to a contact" links.
 *
 * Not `links.whatsappUrl`: that one opens the bot with the code prefilled, so it
 * is for the person being invited. A partner tapping it would message the bot
 * themselves. It is offered to copy instead.
 */
export function shareIntents(url: string, message: string): { whatsapp: string; telegram: string } {
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`,
  };
}
