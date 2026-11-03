/**
 * The referral program — `/api/me/referral` and `/api/public/referral/:code`.
 * Contract: api-doc/me/referrals.md. Types and decisions: `./referral`.
 *
 * The partner belongs to the person, not to the role they are signed in as, so
 * nothing role-specific is ever sent.
 */
import { apiFetch, apiFetchList } from "@/lib/api/client";
import type {
  PayoutDestination,
  ReferralLookup,
  ReferralOverview,
  ReferralPayout,
  ReferralReward,
  ReferredAccount,
} from "./referral";

const PAGE_SIZE = 20;

/** GET /api/me/referral — everything the page needs to decide what to show. */
export function getReferralOverview(): Promise<ReferralOverview> {
  return apiFetch<ReferralOverview>("/api/me/referral");
}

/**
 * POST /api/me/referral/application
 *
 * `termsAccepted` is `z.literal(true)` on the wire: accepting the Partner Terms
 * is what an application is. The body is `.strict()`, so an empty message is
 * left out rather than sent blank.
 */
export function applyToReferralProgram(motivation: string): Promise<{ status: string; appliedAt: string }> {
  const message = motivation.trim();
  return apiFetch("/api/me/referral/application", {
    method: "POST",
    body: JSON.stringify({ termsAccepted: true, ...(message ? { motivation: message } : {}) }),
  });
}

export function listReferredAccounts(page: number) {
  return apiFetchList<ReferredAccount>(`/api/me/referral/referred?page=${page}&limit=${PAGE_SIZE}`);
}

export function listReferralRewards(page: number) {
  return apiFetchList<ReferralReward>(`/api/me/referral/rewards?page=${page}&limit=${PAGE_SIZE}`);
}

export function listReferralPayouts(page: number) {
  return apiFetchList<ReferralPayout>(`/api/me/referral/payouts?page=${page}&limit=${PAGE_SIZE}`);
}

/** POST /api/me/referral/payout — no body: the whole available balance always goes. */
export function requestReferralPayout(): Promise<ReferralPayout> {
  return apiFetch<ReferralPayout>("/api/me/referral/payout", { method: "POST" });
}

/**
 * PUT /api/me/referral/payout-method
 *
 * `account_name` is required by the shared payout schema, even though the page
 * reads as "add a number".
 */
export function setReferralPayoutMethod(input: {
  provider: string;
  phoneNumber: string;
  accountName: string;
}): Promise<PayoutDestination> {
  return apiFetch<PayoutDestination>("/api/me/referral/payout-method", {
    method: "PUT",
    body: JSON.stringify({
      method: "mobile_money",
      mobile_money: {
        provider: input.provider,
        phone_number: input.phoneNumber,
        account_name: input.accountName,
      },
    }),
  });
}

/** GET /api/public/referral/:code — no sign-in, and it says nothing about the partner. */
export function lookupReferralCode(code: string): Promise<ReferralLookup> {
  return apiFetch<ReferralLookup>(`/api/public/referral/${encodeURIComponent(code)}`);
}
