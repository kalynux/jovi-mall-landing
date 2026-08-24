/**
 * Changing the email or phone an account signs in with — `/api/me/{contact,email,phone}`.
 *
 * ── The one rule that shapes all of this ─────────────────────────────────────
 *
 * **The identifier does not move until the change is proved.** `login_email` and
 * `login_phone` are what `POST /api/auth/login` resolves an account by, so a
 * flow that wrote the new value first and flagged it unverified would be
 * unrecoverable from a typo: the account could no longer be signed into, and the
 * correction form is behind the sign-in.
 *
 * So a request writes a **pending block and nothing else**. Exactly one write
 * ever moves the identifier, and it clears the pending block in the same `$set`.
 *
 * Shared across every role — `/api/me` carries `requireAuth` and no
 * `requireRole`. The owner is resolved from the token, never from a body.
 *
 * See api-doc/me/contact-change.md.
 */
import { apiFetch } from "@/lib/api/client";

/** A change that has been requested but not yet proved. */
export interface PendingContactChange {
  /** The value being proved. Echoed because the account holder typed it. */
  target: string;
  requestedAt: string;
  expiresAt: string;
}

/**
 * What you sign in with, and what is in flight.
 *
 * Never carries the token or its hash — a pending change is durable, so the
 * collection deliberately holds only a SHA-256 of the credential.
 */
export interface ContactState {
  email: string | null;
  phone: string | null;
  pendingEmail: PendingContactChange | null;
  pendingPhone: PendingContactChange | null;
}

/** GET /api/me/contact */
export async function getContact(): Promise<ContactState> {
  return apiFetch<ContactState>("/api/me/contact");
}

/* ── Email ────────────────────────────────────────────────────────────────── */

/**
 * PATCH /api/me/email — open an email change.
 *
 * Nothing about the account changes yet. A confirmation link goes to **the new
 * address**, pointing at `{STOREFRONT_URL}/account/confirm-email?token=…`.
 *
 * **Window: 1 hour** — deliberately shorter than the 24-hour registration
 * verification window, because that token proves an address somebody just typed
 * into a signup form and costs nothing if it lapses, whereas this one bounds a
 * change to an identifier the account already signs in with.
 */
export async function requestEmailChange(email: string): Promise<PendingContactChange> {
  const data = await apiFetch<{ pendingEmail: PendingContactChange }>("/api/me/email", {
    method: "PATCH",
    body: JSON.stringify({ email }),
  });
  return data.pendingEmail;
}

/**
 * POST /api/auth/email-change/confirm — spend the emailed token.
 *
 * 🔴 **This is not under `/api/me`, and it carries no `requireAuth`.** It is the
 * single most likely thing in this flow to get wrong.
 *
 * The link is read in a mail client, which is routinely not the browser that
 * started the change and often not even the same device. Requiring a session
 * would make the flow fail for exactly the people it exists for. The token *is*
 * the credential and it names the account.
 *
 * ⚠ **The storefront must POST the token, never GET it.** A `GET` that mutates
 * is spent by whatever prefetches the mail — link scanners, corporate relays,
 * the mail client's own preview — so the landing page reads `?token=` and calls
 * this.
 *
 * The phone confirm *is* authenticated, because its proof is a property of the
 * account and needs the session to be looked up at all. That asymmetry is the
 * design, not an oversight.
 *
 * Being on the auth router, this inherits the **credential rate-limit bucket**
 * (20/min) rather than the general one — it spends a bearer secret, which is
 * what that bucket is for.
 */
export async function confirmEmailChange(token: string): Promise<void> {
  await apiFetch<unknown>("/api/auth/email-change/confirm", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

/** DELETE /api/me/email/pending — `404 CONTACT_CHANGE_NOT_PENDING` if nothing is in flight. */
export async function cancelEmailChange(): Promise<void> {
  await apiFetch<unknown>("/api/me/email/pending", { method: "DELETE" });
}

/* ── Phone ────────────────────────────────────────────────────────────────── */

/**
 * PATCH /api/me/phone — open a phone change. E.164 only.
 *
 * **Window: 24 hours**, longer than email, because the proof is not *delivered*:
 * the person has to go and message the bot from the new number, possibly on a
 * handset that is not in the room. Still bounded, because an unbounded pending
 * request would be completed by the next WhatsApp connection made for any reason
 * at all, months later.
 */
export async function requestPhoneChange(phone: string): Promise<PendingContactChange> {
  const data = await apiFetch<{ pendingPhone: PendingContactChange }>("/api/me/phone", {
    method: "PATCH",
    body: JSON.stringify({ phone }),
  });
  return data.pendingPhone;
}

/**
 * POST /api/me/phone/confirm — **takes no body.**
 *
 * 🔴 **There is no OTP. The proof is a WhatsApp connection.**
 *
 * There is no SMS provider in this service, and a WhatsApp message to a number
 * that has not messaged us falls outside the 24-hour service window — so it
 * would have to be an approved paid template billed to a credit wallet, and a
 * customer has no wallet. What the platform already has is the *inbound*
 * direction: a `channel_connections` row exists only because a message arrived
 * **from that number** and the account holder redeemed the resulting code while
 * signed in. That is a stronger proof of control than an OTP.
 *
 * So the pending number must match a WhatsApp connection on the caller's own
 * account. Two consequences worth stating rather than burying:
 *
 *  - **An account with no WhatsApp connection cannot change its phone here.**
 *  - **A Telegram connection does not count** — a `chat_id` bears no relation to
 *    any phone number.
 *
 * Both surface as `CONTACT_CHANGE_PHONE_UNPROVEN`, which the UI routes to the
 * connections screen: connect WhatsApp first, then come back and confirm.
 */
export async function confirmPhoneChange(): Promise<void> {
  await apiFetch<unknown>("/api/me/phone/confirm", { method: "POST" });
}

/** DELETE /api/me/phone/pending */
export async function cancelPhoneChange(): Promise<void> {
  await apiFetch<unknown>("/api/me/phone/pending", { method: "DELETE" });
}
