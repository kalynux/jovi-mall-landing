/**
 * Is cash on delivery on offer for this basket and this account?
 *
 * The cart quote answers it before the pay screen (`cashOnDelivery`,
 * `api-doc/customer/cart.md`) by running checkout's own rule, and checkout can
 * still refuse with a `422 COD_*` when something changed in between. Both are
 * folded into one `CodRefusal` here, so the screen has a single thing to read.
 *
 * ⚠ `customer_restricted` (2026-10-10) is about the ACCOUNT: an administrator
 * switched cash on delivery off for this customer. No shop is to blame and no
 * change to the basket helps, so it never names a shop — and the
 * administrator's reason is never sent, so there is no "why" to show either.
 *
 * Pure on purpose — no JSX, no `ApiError` import — so `npm test` can load it.
 */
import type { CartQuote, CashOnDeliveryReason } from "./customer.types";

/** `unknown`: the rules could not be checked, or a reason this build predates. */
export type CodRefusalReason = CashOnDeliveryReason | "unknown";

export interface CodRefusal {
  reason: CodRefusalReason;
  /** The shops that refuse. Empty whenever the refusal is not about a shop. */
  vendorIds: string[];
}

/** The reasons a shop can be named for: taking its items out restores the option. */
const ABOUT_A_SHOP: ReadonlySet<string> = new Set<CashOnDeliveryReason>([
  "vendor_not_accepted",
  "agency_not_supported",
  "order_amount_exceeds_limit",
]);

const NOT_ABOUT_A_SHOP: ReadonlySet<string> = new Set<CashOnDeliveryReason>([
  "digital_items",
  "customer_restricted",
]);

/** The checkout refusal each quote reason predicts, read the other way round. */
const REASON_BY_CODE: Record<string, CashOnDeliveryReason> = {
  COD_CUSTOMER_RESTRICTED: "customer_restricted",
  COD_VENDOR_NOT_ACCEPTED: "vendor_not_accepted",
  COD_AGENCY_NOT_SUPPORTED: "agency_not_supported",
  COD_ORDER_AMOUNT_EXCEEDS_LIMIT: "order_amount_exceeds_limit",
  COD_NOT_AVAILABLE_FOR_DIGITAL: "digital_items",
};

function refusal(reason: unknown, vendorIds: unknown): CodRefusal {
  if (typeof reason === "string" && ABOUT_A_SHOP.has(reason)) {
    const ids = Array.isArray(vendorIds)
      ? vendorIds.filter((id): id is string => typeof id === "string" && id !== "")
      : [];
    return { reason: reason as CashOnDeliveryReason, vendorIds: ids };
  }
  // Shop ids are dropped on everything else, an unknown reason included: basket
  // advice is only safe where the reason is known to be a shop's.
  return {
    reason: typeof reason === "string" && NOT_ABOUT_A_SHOP.has(reason) ? (reason as CashOnDeliveryReason) : "unknown",
    vendorIds: [],
  };
}

/**
 * The quote's verdict, or `null` while cash on delivery is on offer.
 *
 * ⚠ Gated on `available === false`. An API that predates the field sends no
 * verdict at all, and that is not a refusal — checkout still decides.
 */
export function codRefusalOf(quote: Pick<CartQuote, "cashOnDelivery"> | null | undefined): CodRefusal | null {
  const verdict = quote?.cashOnDelivery;
  if (!verdict || verdict.available !== false) return null;
  return refusal(verdict.reason, verdict.vendorIds);
}

/**
 * A checkout that was refused as cash on delivery, or `null` for any other
 * error. Nothing was reserved or created, and retrying cannot pass.
 *
 * Duck-typed against `{ code, details }` rather than `instanceof ApiError`.
 * Only `COD_VENDOR_NOT_ACCEPTED` names a shop (`details.vendorId`).
 */
export function codRefusalFromError(error: unknown): CodRefusal | null {
  if (!error || typeof error !== "object") return null;
  const { code, details } = error as { code?: unknown; details?: unknown };
  const reason = typeof code === "string" ? REASON_BY_CODE[code] : undefined;
  if (!reason) return null;
  const vendorId = (details as { vendorId?: unknown } | null | undefined)?.vendorId;
  return refusal(reason, [vendorId]);
}

/**
 * The shops whose items could be taken out to keep cash on delivery for the
 * rest — so only when some other shop would be left in the basket.
 */
export function codRemovableShops(refused: CodRefusal, basketVendorIds: readonly (string | undefined)[]): string[] {
  const inBasket = new Set(basketVendorIds.filter(Boolean));
  const named = refused.vendorIds.filter((id) => inBasket.has(id));
  return named.length > 0 && named.length < inBasket.size ? named : [];
}
