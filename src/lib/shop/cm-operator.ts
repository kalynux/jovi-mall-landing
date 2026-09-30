/**
 * Which Cameroonian mobile-money network a number belongs to.
 *
 * ── Why the storefront needs this at all ─────────────────────────────────────
 *
 * A charge names a **provider** (MTN, ORANGE…), and since 2026-09-30 the server
 * checks it against the number before anything is written
 * (`checkChargeRequest` in `payments/domain/payment-routing.ts`):
 *
 *   - the number's **prefix** is read, and nothing else;
 *   - a prefix that names a *different* network than the chosen provider is
 *     refused with `422 PAYMENT_PROVIDER_PHONE_MISMATCH` (`details.detected`);
 *   - a prefix the table does not know (Nexttel 66x, Camtel 62x, a ported or
 *     foreign number) is **accepted**, and the shopper's choice wins;
 *   - `CARD` does not look at the number at all.
 *
 * ⚠ This used to be the opposite. The old contract let a *declared* operator
 *   beat the number, so this file's job was to make the declaration match the
 *   prefix. The server now refuses a contradiction instead, so the picker uses
 *   this table twice: to pre-select the tile from what is typed, and — through
 *   `providerMismatch` — to say "this number is on MTN" before the pay button
 *   rather than after a 422. It never silently flips a tile the shopper tapped.
 *
 * ⚠ **It is a mirror, so it must not drift.** If the ranges below stop matching
 * `PREFIX_RANGES` in the backend's `payments/domain/cm-operator.ts`, the shop
 * will either block a number the server would take, or let through one it will
 * refuse. Change both together.
 */

import { isValidPhone, parsePhoneValue } from "@/lib/phone";

/** The networks the prefix table can name. */
export type CameroonMobileOperator = "MTN" | "ORANGE";

/**
 * Prefix ranges for the 9-digit national number, which always starts with 6.
 * Copied from the backend, deliberately narrow — an unlisted range answers
 * "unsupported" rather than inventing a network.
 *
 *   MTN     650-654, 670-679, 680-684
 *   ORANGE  655-659, 685-689, 690-699
 *
 * 660-669 is Nexttel and 62x is Camtel. Neither is in the table, so both fall
 * through — and the server then charges whatever the shopper chose.
 */
const PREFIX_RANGES: readonly {
  from: number;
  to: number;
  operator: CameroonMobileOperator;
}[] = [
  { from: 650, to: 654, operator: "MTN" },
  { from: 655, to: 659, operator: "ORANGE" },
  { from: 670, to: 679, operator: "MTN" },
  { from: 680, to: 684, operator: "MTN" },
  { from: 685, to: 689, operator: "ORANGE" },
  { from: 690, to: 699, operator: "ORANGE" },
];

export type OperatorDetection =
  /** The number names its network. Select this tile. */
  | { status: "detected"; operator: CameroonMobileOperator }
  /** A complete number the table cannot place. The shopper's choice stands. */
  | { status: "unsupported" }
  /** Still being typed, or too partial to judge. Say nothing. */
  | { status: "unknown" };

const UNKNOWN: OperatorDetection = { status: "unknown" };

/**
 * Read the network off a phone-field value.
 *
 * Three states rather than `operator | null`, because "still typing" and "we
 * cannot place this number" want opposite things from the UI: the first must
 * stay silent, and the second earns a hint. Collapsing them — which is what
 * the backend's `null` does, correctly, for its own purposes — would put a
 * warning under a field after the first digit.
 */
export function detectCameroonOperator(value: string | null | undefined): OperatorDetection {
  if (!value) return UNKNOWN;

  const { country, national } = parsePhoneValue(value);

  // A different country entirely. Silent until the number is complete, because
  // until then the country selector may simply not have caught up.
  if (country !== "CM") {
    return isValidPhone(value) ? { status: "unsupported" } : UNKNOWN;
  }

  const digits = national.replace(/\D/g, "");
  // Cameroonian mobile numbers are nine digits and start with 6. Anything
  // shorter is half-typed; anything else is a landline or a typo, and the
  // prefix table below would answer nonsense for it.
  if (digits.length < 9) return UNKNOWN;
  if (digits.length > 9 || !digits.startsWith("6")) return { status: "unsupported" };

  const prefix = Number(digits.slice(0, 3));
  const match = PREFIX_RANGES.find((r) => prefix >= r.from && prefix <= r.to);
  return match ? { status: "detected", operator: match.operator } : { status: "unsupported" };
}

/**
 * The network a number is on, when it contradicts the chosen provider.
 *
 * Exactly the server's mismatch rule, so a `null` here is a number the server
 * will not refuse as a mismatch: a card, a half-typed or unplaceable number, or
 * one on the chosen network. `MOOV` has no prefix of its own in the table, so an
 * MTN or Orange number chosen as Moov is a mismatch too.
 */
export function providerMismatch(
  provider: string | null | undefined,
  value: string | null | undefined,
): CameroonMobileOperator | null {
  if (provider !== "MTN" && provider !== "ORANGE" && provider !== "MOOV") return null;
  const detection = detectCameroonOperator(value);
  if (detection.status !== "detected") return null;
  return detection.operator === provider ? null : detection.operator;
}
