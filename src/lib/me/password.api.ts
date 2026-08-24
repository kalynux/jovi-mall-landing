/**
 * Changing the account password — `PATCH /api/me/password`.
 *
 * Role-agnostic: the password lives on the **User** record, not on any role
 * entity, so there is exactly one per account however many roles it holds.
 *
 * ⚠ **Most customers have no password they know.** An account is created by the
 * bot with a system-generated one, and sign-in is a magic link or code — so this
 * screen is only meaningful to somebody who has been through a password reset,
 * or to a vendor/agency/agent account. It is not the customer's ordinary path.
 *
 * See api-doc/me/password.md.
 */
import { apiFetch } from "@/lib/api/client";

/**
 * The backend's strength policy, restated so the form can fail fast rather than
 * spend a round trip to be told the same thing.
 *
 * Kept as one source for the checks and the copy: a list that disagrees with the
 * validator is worse than no list, because it teaches a rule that is not real.
 */
export const PASSWORD_RULES = [
  { test: (v: string) => v.length >= 8, label: "At least 8 characters" },
  { test: (v: string) => /[A-Z]/.test(v), label: "An uppercase letter" },
  { test: (v: string) => /[a-z]/.test(v), label: "A lowercase letter" },
  { test: (v: string) => /[0-9]/.test(v), label: "A number" },
  { test: (v: string) => /[^A-Za-z0-9]/.test(v), label: "A special character" },
] as const;

export function passwordMeetsPolicy(value: string): boolean {
  return PASSWORD_RULES.every((rule) => rule.test(value));
}

/**
 * PATCH /api/me/password
 *
 * 🔴 **This signs every other device out, and re-issues this one's credentials.**
 *
 * The change invalidates every token minted under the old password — including
 * the pair this request arrived with — so the response carries a replacement
 * `Set-Cookie` for both `access_token` and `refresh_token` and the caller stays
 * signed in. Every *other* session is signed out on its next request, where it
 * sees the terminal `AUTH_PASSWORD_CHANGED`.
 *
 * ⚠ **A client that discards cookies from this response finds itself logged
 * out.** `apiFetch` sends `credentials: "include"`, so the browser build stores
 * them as a matter of course.
 *
 * ⚠ **The bearer build is a different story.** This endpoint sets cookies; it
 * does not return a `tokens` pair, and nothing on the server can rewrite a
 * native client's `Authorization` header. So a Capacitor build's stored pair is
 * dead the moment this succeeds, and the caller must send the user back through
 * sign-in rather than assume the session survived. See {@link PASSWORD_CHANGE_ENDS_BEARER_SESSION}.
 *
 * Unlike most of the API this answers with **no `data` key** — just
 * `{ success, message }` — which `apiFetch` returns whole.
 */
export async function changePassword(
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  await apiFetch<{ success?: boolean; message?: string }>("/api/me/password", {
    method: "PATCH",
    body: JSON.stringify({ oldPassword, newPassword }),
  });
}

/**
 * Whether a successful password change leaves this build signed in.
 *
 * A browser keeps its session: the response's `Set-Cookie` replaces the pair it
 * just invalidated. A bearer client does not — no cookie jar takes part, and the
 * stored pair was minted under the old password.
 */
export const PASSWORD_CHANGE_ENDS_BEARER_SESSION = true;
