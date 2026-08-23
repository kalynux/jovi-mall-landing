import { AuthError } from "@/lib/auth/auth.types";
import { isNetworkError } from "@/lib/errors/is-network-error";

/**
 * What a failed cart write means, decided once.
 *
 * ── Why this is not inside CartProvider ──────────────────────────────────────
 *
 * It was, and that is how it went wrong. The provider's `addItem` **returns**
 * its failures rather than throwing them, so the `try/catch` every calling
 * screen wraps around the add never sees one — those catches only ever fire for
 * `resolveQuickAdd`, the catalogue read that runs first and is usually served
 * from the HTTP cache. A shopper with no signal therefore hit a branch nobody
 * had looked at, and was shown the raw engine string: literally
 * **"Failed to fetch"** on Android's WebView, or **"signal timed out"** from the
 * 20s deadline in `lib/api/client.ts`.
 *
 * Pulling the ladder out here makes it a pure function of the error, which is
 * the only reason it can be exercised at all — the version that lived in a
 * `useCallback` inside a `"use client"` component could be typechecked and
 * nothing more. Same discipline as `order-status.ts`, which mirrors the
 * server's payable filter so it can be reasoned about away from a screen.
 */

/** Everything `addItem` can answer other than success. */
export type CartAddFailure =
  /** A different product type is already in the cart; ask, then retry with `replace`. */
  | { kind: "type_conflict"; current: "physical" | "digital"; incoming: "physical" | "digital" }
  /** Services are booked, not carted. */
  | { kind: "service_not_allowed" }
  /** One digital product per cart, quantity 1. */
  | { kind: "digital_limit" }
  /**
   * The request never reached the server.
   *
   * Its own outcome rather than an `error` carrying a message, because it is the
   * one failure the shopper can act on and the only one whose words cannot come
   * from the server — there was no server. Being a `kind` also puts it in the
   * exhaustive switch each caller already writes, so a new "add to cart" button
   * cannot quietly inherit the generic line.
   *
   * Only reachable signed in: an anonymous add is a localStorage write.
   */
  | { kind: "offline" }
  | { kind: "error"; message: string };

/**
 * The message to show for `{ kind: "offline" }`.
 *
 * The only copy of this sentence. Four screens add to the cart and each used to
 * write its own failure line, which is how the shop came to describe the same
 * dead connection two different ways — and how two of those screens came to not
 * describe it at all, one falling out of a `switch` in silence and one
 * navigating to a product page instead.
 */
export const CART_OFFLINE_MESSAGE = "No connection — check your network and try again.";

/**
 * The message for a failure we could not name.
 *
 * **Only an `AuthError` message is shown.** `AuthError` and its `ApiError`
 * subclass are built in exactly one place — `throwResponseError` in
 * `lib/api/client.ts` — from a body the backend wrote for a person. Every other
 * `Error` arriving here is an engine string, and passing those through is the
 * bug described at the top of this file.
 */
function unnamedFailureMessage(error: unknown): string {
  return error instanceof AuthError ? error.message : "Something went wrong. Please try again.";
}

/**
 * Classify a rejected cart write.
 *
 * `current`/`incoming` are the cart's product type and the one being added;
 * they are needed because `CART_MIXED_PRODUCT_TYPES` only tells us there was a
 * clash, not between what.
 *
 * ── The order matters ────────────────────────────────────────────────────────
 *
 * Backend codes are read FIRST, and connectivity only after. `isNetworkError`
 * consults a platform connectivity probe (`lib/native/network.ts` on a device)
 * that answers for the moment it is asked, not for the moment the request was
 * made — so on a connection that has just come back it can still say "offline"
 * while a real 409 sits in hand. Asking it first turned genuine conflicts into
 * "check your network", which is the same lie in the other direction.
 *
 * `instanceof AuthError` is what settles it: those are constructed only after a
 * response has been read, so their presence is proof the request arrived.
 */
export function classifyCartAddFailure(
  error: unknown,
  current: "physical" | "digital" | null,
  incoming: "physical" | "digital"
): CartAddFailure {
  const code = (error as { code?: string }).code;

  if (code === "CART_MIXED_PRODUCT_TYPES" && current) {
    return { kind: "type_conflict", current, incoming };
  }
  if (code === "CART_DIGITAL_LIMIT_REACHED" || code === "CART_DIGITAL_QUANTITY_MUST_BE_ONE") {
    return { kind: "digital_limit" };
  }
  if (code === "CART_SERVICE_PRODUCT_NOT_ALLOWED") {
    return { kind: "service_not_allowed" };
  }

  if (!(error instanceof AuthError) && isNetworkError(error)) {
    return { kind: "offline" };
  }

  return { kind: "error", message: unnamedFailureMessage(error) };
}
