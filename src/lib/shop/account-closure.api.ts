/**
 * Closing a customer account — `POST /api/me/close`.
 *
 * ── Why this says "close" and never "delete" ─────────────────────────────────
 *
 * The backend anonymises and retains: the person's name, contact details and
 * saved addresses are stripped, and the order rows survive without them,
 * because they are business records that other parties (vendors, agencies, the
 * tax position) also rely on. ADR-A02 D-2 forbids describing that as a deletion
 * or as satisfying a legal right to erasure, and the route's own doc comment
 * says so — `POST` rather than `DELETE` for exactly that reason.
 *
 * Both app stores require an in-app way to close an account, and both accept
 * retention that is disclosed. So the promise this screen makes has to be the
 * narrow, true one, and the copy in `close/page.tsx` is written from the
 * sentence the endpoint itself returns on success.
 *
 * The route is `requireAuth` and customer-only; it resolves the account from
 * the token, so a caller can only ever close their own.
 */
import { apiFetch } from "@/lib/api/client";

/**
 * The exact phrase the shopper has to type.
 *
 * Mirrors `ACCOUNT_CLOSURE_CONFIRMATION` in the backend's `user.validator.ts`,
 * where it is a `z.literal` — so this is not a formality the client can soften.
 * Case and spacing must match, which is why the form compares against this
 * constant rather than checking the text loosely.
 */
export const ACCOUNT_CLOSURE_CONFIRMATION = "CLOSE MY ACCOUNT";

export interface AccountClosureResult {
  /** ISO instant the account was closed, from the server's clock. */
  closedAt: string;
}

/**
 * Close and anonymise the signed-in customer's own account.
 *
 * Refuses (422) when the account holds a non-customer role, or when orders are
 * still in flight — a shopper mid-delivery cannot vanish from the record the
 * courier is working from. Both arrive as `ApiError` with a code, so the caller
 * shows the backend's own sentence rather than inventing one.
 *
 * On success every token minted before this instant is refused, so the caller
 * MUST end the session immediately: the app is otherwise left holding a
 * credential that 403s on the next request.
 */
export async function closeAccount(confirm: string): Promise<AccountClosureResult> {
  return apiFetch<AccountClosureResult>("/api/me/close", {
    method: "POST",
    body: JSON.stringify({ confirm }),
  });
}
