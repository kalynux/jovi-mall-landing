/**
 * Answering an administrator's request to close the shopping account —
 * `api-doc/me/role-closure.md` (ADR-A10, 2026-10-04).
 *
 * ── How this differs from `account-closure.api.ts` ───────────────────────────
 *
 * That file is the shopper closing their own account, on their own initiative
 * (`POST /api/me/close`, ADR-A02). This one is the other door: an administrator
 * ASKS, nothing changes, and the shopper answers — confirm or decline — while
 * signed in. Confirming runs the same anonymise-and-retain closure, so the same
 * wording rule holds: say "close", never "delete" (ADR-A02 D-2).
 *
 * It closes the CUSTOMER role only. A person who also holds a shop, an agency
 * or an agent role keeps those, and `outcome.accountClosed` says which case
 * this was.
 *
 * ── Nothing here names a user or a role ──────────────────────────────────────
 *
 * All three routes read both from the session — the request answered is the
 * one for the role the session is signed in as. Sending either would be
 * rejected by the `.strict()` bodies anyway, and must never be added.
 */
import { apiFetch } from "@/lib/api/client";

/**
 * The exact phrase `POST /confirm` requires — a `z.literal` on the backend
 * (`ROLE_CLOSURE_CONFIRMATION_PHRASE`), and the same eleven characters
 * self-closure uses. A wire value: never translated.
 */
export const ROLE_CLOSURE_CONFIRMATION = "CLOSE MY ACCOUNT";

/** `note` is capped at 500 characters by `DeclineRoleClosureSchema`. */
export const DECLINE_NOTE_MAX = 500;

export type ClosureRequestStatus = "pending" | "confirmed" | "declined" | "cancelled" | "expired";

/**
 * What must be settled before the closure can go through, evaluated at read
 * time. A customer can only get the first two; the type stays open (`string`)
 * because the vocabulary is the backend's and grows with it — an unknown code
 * still has to render as *something*, not crash the screen.
 */
export interface ClosureBlocker {
  code: "orders_in_flight" | "bookings_upcoming" | (string & {});
  count: number;
  /** Money blockers only (never a customer's). */
  amount?: number;
  currency?: string;
}

/** What confirming forfeits. Never blocks; shown before the button. */
export interface ClosureWarning {
  code: "prepaid_plan_forfeited" | "credit_balance_forfeited" | (string & {});
  planCode: string | null;
  expiresAt: string | null;
  amount: number | null;
}

export interface ClosureOutcome {
  closedAt: string;
  /**
   * `false`: only the customer role closed, the person still holds another
   * (a shop, an agency…) and can sign in to it. `true`: it was their last role,
   * so the whole account is closed and there is nothing to sign in to.
   */
  accountClosed: boolean;
  endedRelationships: number;
}

export interface ClosureRequest {
  id: string;
  role: string;
  /** Effective, not stored: a pending row past `expiresAt` reads `expired`. */
  status: ClosureRequestStatus;
  /** The administrator's own words. Shown verbatim, never translated. */
  reason: string;
  requestedAt: string;
  expiresAt: string;
  warnings: ClosureWarning[];
  /** Live on the GET; `null` on the confirm and decline answers. */
  blockers: ClosureBlocker[] | null;
  /** Enable the confirm button on this, not on `blockers.length`. */
  canConfirm: boolean;
  outcome: ClosureOutcome | null;
}

/**
 * `GET /api/me/closure-request` — the pending request, or `null`.
 *
 * `null` is the ordinary answer ("nothing is waiting"), not an error, which is
 * why the screen cannot hand this to `ResourceView`: that component reads a
 * null payload as "still loading".
 */
export function getClosureRequest(): Promise<ClosureRequest | null> {
  return apiFetch<ClosureRequest | null>("/api/me/closure-request");
}

/**
 * `POST /api/me/closure-request/confirm` — irreversible.
 *
 * The server clears the auth cookies on the way out; the caller still has to
 * end the client's side of the session (a bearer pair, the provider's state),
 * which `useAuth().logout` does.
 *
 * Refusals: `422 ROLE_CLOSURE_BLOCKED` with `details.blockers`,
 * `409 ROLE_CLOSURE_REQUEST_EXPIRED`, `404 ROLE_CLOSURE_REQUEST_NOT_FOUND`.
 */
export function confirmClosureRequest(): Promise<ClosureRequest> {
  return apiFetch<ClosureRequest>("/api/me/closure-request/confirm", {
    method: "POST",
    body: JSON.stringify({ confirm: ROLE_CLOSURE_CONFIRMATION }),
  });
}

/** `POST /api/me/closure-request/decline` — the note is optional. */
export function declineClosureRequest(note?: string): Promise<ClosureRequest> {
  const trimmed = note?.trim();
  return apiFetch<ClosureRequest>("/api/me/closure-request/decline", {
    method: "POST",
    body: JSON.stringify(trimmed ? { note: trimmed } : {}),
  });
}
