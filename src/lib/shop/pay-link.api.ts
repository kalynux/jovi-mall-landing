/**
 * The hosted payment page's read — `GET /api/payments/session/:token`.
 *
 * ── Why this is not `getTransaction` with the auth taken off ─────────────────
 *
 * The whole feature is that the person paying is often not the person who
 * ordered: a mother places an order, her son opens the link and pays, and he has
 * no account. So the read has to work with no session — and the backend
 * deliberately did NOT open `GET /api/payments/:transactionId` up to do it.
 * Transaction ids are the only thing standing between one customer and another's
 * payment record, so an unauthenticated read on them is a record any caller can
 * walk by incrementing.
 *
 * What travels instead is a 256-bit opaque handle that exists only on
 * transactions somebody deliberately minted a link for, expires (30 minutes by
 * default, matched to the checkout stock hold), and is superseded by the next
 * mint. **Never build a URL in this flow out of an id.**
 *
 * ── The envelope ─────────────────────────────────────────────────────────────
 *
 * ⚠ This is the one `/api/payments/*` route that answers `{ success, data }`
 * like everything else — its siblings (`initiate`, `verify`, `:id`) are built by
 * hand and answer flat, which is why `payments.api.ts` types those as the whole
 * body. `apiFetch` unwraps this one, so `PayLinkSession` is the payload.
 */
import { apiFetch } from "@/lib/api/client";

/**
 * What the page may do with this transaction right now.
 *
 * 🔴 **`settled` is checked before `expired`, server-side, and the order is the
 * decision.** A customer who paid and comes back an hour later must be told they
 * PAID — telling them their link expired invites a second payment, which is the
 * one outcome a payment page must never invite.
 */
export type PayLinkState = "payable" | "settled" | "closed" | "expired";

export interface PayLinkSession {
  /** Poll `POST /api/payments/verify` with this once the card is confirmed. */
  transactionId: string;
  state: PayLinkState;
  gateway: string;
  /** What the customer agreed to pay, in the catalogue's currency. */
  amount: number;
  currency: string;
  /**
   * What Stripe will actually charge, in the account's presentment currency.
   *
   * The Stripe account settles in USD while the catalogue is priced in XAF, so
   * the number the Payment Element renders is **not** `amount`. Both are sent
   * because a page showing only one of them is lying to somebody: XAF alone
   * contradicts the card statement, USD alone contradicts the order.
   */
  chargedAmount: number | null;
  chargedCurrency: string | null;
  /** ⚠ Present only while `state === 'payable'`. `null` in every other state. */
  clientSecret: string | null;
  /** `null` when the backend has no card key configured — the page says so. */
  publishableKey: string | null;
  expiresAt: string;
}

/**
 * Resolve a pay link.
 *
 * ⚠ **A malformed token, an unknown one and a superseded one all answer the same
 * `404 PAYMENT_LINK_NOT_FOUND`**, on purpose: any difference between them is an
 * oracle telling a caller whether their guess had the right shape.
 *
 * An **expired** link is the one exception and resolves normally, with
 * `state: "expired"` — the page's whole job at that point is to say the link
 * lapsed and offer a fresh one, and a 404 would render "this payment does not
 * exist" to somebody looking at their own order.
 */
export async function getPayLinkSession(token: string): Promise<PayLinkSession> {
  return apiFetch<PayLinkSession>(
    `/api/payments/session/${encodeURIComponent(token)}`,
  );
}

/**
 * The shape a token has, checked before it reaches the network.
 *
 * Not a security control — the unguessability of the stored value is that — but
 * it saves a round trip on a link that was truncated by a chat client, which is
 * the common way one arrives broken. The backend applies the identical rule and
 * answers the same 404 either way, so nothing is disclosed by checking early.
 */
export function isPayLinkToken(value: string): boolean {
  return /^pl_[0-9a-f]{64}$/.test(value);
}
