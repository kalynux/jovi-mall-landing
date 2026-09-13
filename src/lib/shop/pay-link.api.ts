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
import { absoluteUrl } from "@/lib/site";
import { payPath } from "./shop.routes";

/**
 * What the page may do with this transaction right now.
 *
 * 🔴 **`settled` is checked before `expired`, server-side, and the order is the
 * decision.** A customer who paid and comes back an hour later must be told they
 * PAID — telling them their link expired invites a second payment, which is the
 * one outcome a payment page must never invite.
 */
export type PayLinkState = "payable" | "settled" | "closed" | "expired";

/**
 * What the money is for — facts, not a sentence.
 *
 * The page composes the wording, and that split was the backend's explicit
 * decision rather than a convenience. **This is the one reader the API cannot
 * localise for**: every other page is served to somebody with an account and a
 * `preferred_language`, while the holder of a pay link has neither and may not
 * exist in the database at all. A sentence composed server-side would arrive in
 * English on a page otherwise translated into five languages — English in the
 * very line that says what the money is for. The reader's locale is in the URL
 * they opened, so the page knows it and the server does not.
 *
 * It exists because the page previously read, in full, *"Amount due — 24 000
 * FCFA"*. The payer is **by design** often not the person who ordered, which
 * makes this the one payment screen where they have no other way to know what
 * they are paying for — and the one screen where they are about to type card
 * details, so a page naming no merchant is shaped exactly like a phishing page.
 */
export interface PayLinkPaidFor {
  kind: "order" | "booking";
  /** The handle the payer can match against a message. `null` on a legacy row. */
  reference: string | null;
  /** Greater than 1 when one payment settles a multi-vendor basket. */
  orderCount: number;
  /** `null` for a booking. */
  itemCount: number | null;
  /**
   * ⚠ **Always `[]` for a booking, and that is not an oversight to fill in.**
   *
   * A shop's name is already a public storefront page, so naming it tells a
   * stranger only that somebody bought something. A *service provider's* name is
   * frequently the sensitive fact itself — a clinic, a lawyer — and the platform
   * cannot tell which vendors are which. A booking travels as its reference and
   * its amount; the payer confirms with whoever sent them the link. **Do not
   * fill this in client-side from another endpoint.**
   */
  sellers: string[];
}

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
  /**
   * What is being paid for. **Never null** on a current backend.
   *
   * Optional here only so a page served against a backend older than 2026-09-07
   * degrades to the amount alone rather than crashing — which is what this
   * screen showed before the field existed.
   */
  paidFor?: PayLinkPaidFor;
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

/* ─── Minting one ─────────────────────────────────────────────────────────── */

export interface MintedPayLink {
  /** `pl_` + 64 hex. The credential; treat it like one. */
  token: string;
  /**
   * The absolute URL the backend built, or `null` when its `STOREFRONT_URL` is
   * unset.
   *
   * ⚠ `null` is a real deployment state, not an error — see {@link payLinkUrl},
   * which is what callers should use.
   */
  url: string | null;
  expiresAt: string;
}

/**
 * Mint a shareable payment link for a transaction.
 *
 * ⚠ **A second mint REVOKES the first, and that is the only revocation there
 * is.** At most one link per transaction is ever live. That is what makes
 * "they lost the message, send it again" safe, and what stops a forwarded link
 * outliving its purpose — but it also means **this must never run on page
 * load**. Call it from a deliberate tap, and tell the shopper that re-sending
 * kills the link they sent before.
 *
 * ⚠ **A mobile-money transaction cannot have one** (`422
 * PAYMENT_LINK_NOT_APPLICABLE`): it completes on the payer's own handset
 * against the payer's own number, so a page would have nothing to do. Pay links
 * are a card path, which is why the caller creates a `STRIPE` transaction
 * first. `422 PAYMENT_LINK_NOT_PAYABLE` means it is already settled, failed or
 * cancelled; `404` means unknown, malformed, or somebody else's —
 * indistinguishable on purpose.
 */
export async function mintPayLink(transactionId: string): Promise<MintedPayLink> {
  return apiFetch<MintedPayLink>(
    `/api/payments/${encodeURIComponent(transactionId)}/pay-link`,
    { method: "POST" },
  );
}

/**
 * The URL to actually send someone.
 *
 * Prefers what the backend built, and falls back to composing it from this
 * deployment's own origin. The fallback is not a workaround: `url: null` only
 * means the *API* has no `STOREFRONT_URL` configured, and this app is the
 * storefront — it knows its own address with more authority than the backend
 * does. The token is identical either way, so the composed link resolves to the
 * same session.
 *
 * ⚠ Always absolute. This link is opened by somebody who is not on the site,
 * frequently on a different device, from a chat message — a relative path
 * pasted into WhatsApp is not a link at all.
 */
export function payLinkUrl(minted: MintedPayLink): string {
  return minted.url ?? absoluteUrl(payPath(minted.token));
}
