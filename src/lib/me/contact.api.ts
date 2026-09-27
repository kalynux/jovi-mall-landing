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
 * A contact change is not a credential change: it signs no device out. Only
 * `PATCH /api/me/password` does that.
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
 * address**, pointing at
 * `{STOREFRONT_URL}/account/confirm-email?token=…&app={role}`.
 *
 * That `app=` hint is the *only* thing about the flow that is role-aware, and it
 * is stamped here — at the authenticated half — because the confirm half has no
 * session to read a role from. It decides nothing about the change itself; it
 * decides which dashboard the success screen offers a way back to. See
 * `lib/me/confirm-origin.ts`.
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
 * The phone confirm *is* authenticated, because it spends a code sent to the
 * account's pending number. That asymmetry is the design, not an oversight.
 *
 * Being on the auth router, this inherits the **credential rate-limit bucket**
 * (20/min) rather than the general one — it spends a bearer secret, which is
 * what that bucket is for.
 *
 * ⚠ `CONTACT_CHANGE_IDENTIFIER_TAKEN` can arrive **here**, not only at request
 * time: the address was free when the change was opened and somebody claimed it
 * in the hour since. The service re-checks deliberately — without it the swap
 * hits the sparse unique index and answers 500 instead of 409.
 *
 * Returns the address that is now the account's sign-in, so the success screen
 * can name it rather than saying "your email" about a value the person may have
 * typed an hour ago on another device.
 */
export async function confirmEmailChange(token: string): Promise<{ email: string }> {
  return apiFetch<{ email: string }>("/api/auth/email-change/confirm", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

/** DELETE /api/me/email/pending — `409 CONTACT_CHANGE_NOT_PENDING` if nothing is in flight. */
export async function cancelEmailChange(): Promise<void> {
  await apiFetch<unknown>("/api/me/email/pending", { method: "DELETE" });
}

/* ── Phone ────────────────────────────────────────────────────────────────── */

/**
 * PATCH /api/me/phone — open a phone change. E.164 only.
 *
 * **Window: 24 hours** for the change itself; each code it is confirmed with
 * lives 10 minutes, and a new one can be requested inside the window.
 *
 * ⚠ **This does not send the code.** Follow it with `requestPhoneCode()` from
 * `phone-verification.api.ts`, then `confirmPhoneCode()` — the storefront's only
 * way to complete a phone change (owner decision, 2026-09-21).
 *
 * `POST /api/me/phone/confirm` — the connection proof, "message the bot from
 * your new number, then confirm" — is deliberately not wrapped here. It stays on
 * the backend for the bot surface only, and the storefront must not send
 * customers through it.
 */
export async function requestPhoneChange(phone: string): Promise<PendingContactChange> {
  const data = await apiFetch<{ pendingPhone: PendingContactChange }>("/api/me/phone", {
    method: "PATCH",
    body: JSON.stringify({ phone }),
  });
  return data.pendingPhone;
}

/** DELETE /api/me/phone/pending */
export async function cancelPhoneChange(): Promise<void> {
  await apiFetch<unknown>("/api/me/phone/pending", { method: "DELETE" });
}
