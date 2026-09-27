/**
 * Proving a phone number with a six-digit WhatsApp code — `/api/me/phone/verify/*`.
 *
 * ── This is how the storefront completes a phone change ──────────────────────
 *
 * Owner decision, 2026-09-21: a customer changing their number gets a code on
 * WhatsApp at the NEW number, instead of being told to message the bot from it.
 *
 *     PATCH /api/me/phone          { phone }   → pending, nothing moves yet
 *     POST  /api/me/phone/verify/request       → code sent to the NEW number
 *     POST  /api/me/phone/verify/confirm { code } → login_phone swaps
 *
 * The older proof — a WhatsApp *connection* on the new number, then
 * `POST /api/me/phone/confirm` — still exists, but only for the bot surface.
 * The storefront must not send anyone through it.
 *
 * The code goes out as free text inside Meta's 24-hour window and as the
 * approved AUTHENTICATION template outside it, so the user never has to message
 * the bot first — and must never be told to. By the time
 * `PHONE_VERIFICATION_DELIVERY_FAILED` comes back, every route was tried.
 *
 * Confirming also moves the account's WhatsApp link off the number being given
 * up, so a recycled SIM does not stay this customer to the bot.
 *
 * See api-doc/me/phone-verification.md and api-doc/me/contact-change.md.
 */
import { apiFetch } from "@/lib/api/client";

/**
 * The backend's default resend cooldown (`PHONE_VERIFY_RESEND_COOLDOWN_SECONDS`).
 *
 * Used only to grey out "send a new code" straight after a send, so a double tap
 * does not earn a 429. The server stays the authority: a
 * `PHONE_VERIFICATION_RESEND_TOO_SOON` carries `details.retryAfterSeconds`, and
 * that figure replaces this one.
 */
export const RESEND_COOLDOWN_SECONDS = 60;

/** What is verifiable and whether a code is in flight. */
export interface PhoneVerificationState {
  /** `+237•••••3456`, or `null` when the account has no number at all. */
  phoneMasked: string | null;
  /**
   * `true` while a phone change is pending: the code proves the NEW number and
   * confirming it swaps the account's identifier. `false`: the code proves the
   * number already on the account, in place.
   */
  completesPendingChange: boolean;
  /** A live, unexpired code exists. */
  pending: boolean;
  expiresAt: string | null;
}

export interface PhoneCodeSent {
  phoneMasked: string;
  expiresAt: string;
  /**
   * `"text"` inside the 24-hour window, `"template"` otherwise. Reported for
   * support, not for branching — it deliberately does not say which template.
   */
  delivery: "text" | "template";
}

/** GET /api/me/phone/verify — free, no side effect. */
export async function getPhoneVerification(): Promise<PhoneVerificationState> {
  return apiFetch<PhoneVerificationState>("/api/me/phone/verify");
}

/**
 * POST /api/me/phone/verify/request — **no body.**
 *
 * The server picks the target: the pending number if a change is in flight,
 * otherwise the current one. `PATCH /api/me/phone` does not send the code
 * itself, so the caller must make this request right after it.
 *
 * Refusals: `PHONE_VERIFICATION_RESEND_TOO_SOON` (429,
 * `details.retryAfterSeconds`), `PHONE_VERIFICATION_DELIVERY_FAILED` (502,
 * retryable), `PHONE_VERIFICATION_NO_TARGET` (422).
 *
 * The cooldown is checked before a new code is minted, so a refused resend
 * leaves the code already in the person's hand working.
 */
export async function requestPhoneCode(): Promise<PhoneCodeSent> {
  return apiFetch<PhoneCodeSent>("/api/me/phone/verify/request", { method: "POST" });
}

/**
 * POST /api/me/phone/verify/confirm — spend the code.
 *
 * ⚠ The body is `.strict()` and takes **only** `code`: the number was fixed
 * when the code was minted, and sending `phone` alongside it is a 400.
 *
 * `changed: true` means the login phone moved; `false` means the existing
 * number was verified in place.
 *
 * Refusals: `PHONE_VERIFICATION_CODE_INVALID` (422, `details.attemptsLeft` —
 * let them retype), `PHONE_VERIFICATION_CODE_EXPIRED` (422) and
 * `PHONE_VERIFICATION_TOO_MANY_ATTEMPTS` (429) — both mean "request a new
 * code". Completing a change can also answer the `CONTACT_CHANGE_*` refusals:
 * `EXPIRED`, `NOT_PENDING`, `IDENTIFIER_TAKEN`.
 */
export async function confirmPhoneCode(code: string): Promise<{ phone: string; changed: boolean }> {
  return apiFetch<{ phone: string; changed: boolean }>("/api/me/phone/verify/confirm", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}
