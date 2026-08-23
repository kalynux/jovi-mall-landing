/**
 * Which Cameroonian mobile-money network a number belongs to.
 *
 * ── Why the storefront needs this at all ─────────────────────────────────────
 *
 * `POST /api/payments/initiate` takes a **gateway** and a **channel**, and they
 * are not the same question. The gateway (NotchPay) is ours and is never shown.
 * The `channel.phoneOperator` is the shopper's network, and NotchPay's direct
 * charge takes an explicit `cm.mtn` / `cm.orange` — it will not work it out from
 * the number.
 *
 * The backend does derive it, in `payments/domain/cm-operator.ts` — but read
 * the order of trust there:
 *
 *     const stated = (declared || '').toUpperCase();
 *     if (stated === 'MTN' || stated === 'ORANGE') return stated;
 *
 * **A declared operator always beats the number.** So a shopper who taps "MTN
 * Mobile Money" and types an Orange number gets `cm.mtn` sent for an Orange
 * number, and the payment is declined at the gateway with nothing on screen
 * explaining why. The backend's own comment names that as the outcome worth
 * avoiding — it just cannot avoid it, because by then the wrong answer has
 * already been declared.
 *
 * This table is that same derivation, moved to where the number is typed, so
 * the tile matches the number by default and the declaration is right.
 *
 * ⚠ **It is a mirror, so it must not drift.** If the ranges below stop matching
 * `PREFIX_RANGES` in the backend file, the storefront will confidently declare
 * an operator the backend would have derived differently. Change both together.
 */

import { isValidPhone, parsePhoneValue } from "@/lib/phone";

/** The operators the mobile-money gateways can actually charge in Cameroon. */
export type CameroonMobileOperator = "MTN" | "ORANGE";

/**
 * Prefix ranges for the 9-digit national number, which always starts with 6.
 * Copied from the backend, deliberately narrow — an unlisted range answers
 * "unsupported" rather than inventing a network.
 *
 *   MTN     650-654, 670-679, 680-684
 *   ORANGE  655-659, 685-689, 690-699
 *
 * 660-669 is Nexttel and 62x is Camtel. Neither is a mobile-money rail either
 * gateway supports, so both fall through — which is a real answer, not a gap.
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
  /** A complete number on a network no gateway can charge. Say so. */
  | { status: "unsupported" }
  /** Still being typed, or too partial to judge. Say nothing. */
  | { status: "unknown" };

const UNKNOWN: OperatorDetection = { status: "unknown" };

/**
 * Read the network off a phone-field value.
 *
 * Three states rather than `operator | null`, because "still typing" and "this
 * number cannot be charged" want opposite things from the UI: the first must
 * stay silent, and the second must warn. Collapsing them — which is what the
 * backend's `null` does, correctly, for its own purposes — would put a red
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
