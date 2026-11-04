/**
 * What a mobile-money wait needs to know, and nothing that needs a screen.
 *
 * The contract is `api-doc/FRONTEND-CHANGELOG-novasend-moon-sarl.md`. When a
 * charge's `instructions` name a `payeeName`, the phone shows a merchant the
 * customer has never heard of, so the wait has to say who to expect; and on some
 * networks no prompt arrives at all until the customer dials `ussdCode`. Every
 * value comes from the answer. This app never names the merchant or the code.
 *
 * Pure apart from the small session store at the foot, so `node --test` can load
 * it (a `*.api.ts` module cannot be imported there).
 */
import type { PaymentInstructions, PaymentLimits, PaymentProvider } from "./payments.api";

/**
 * How the customer starts the confirmation on their phone.
 *
 *   - `dial` — nothing reaches the phone until they dial the code.
 *   - `prompt` — a request appears by itself; the code is only the fallback.
 *   - `unknown` — this answer does not say, so the server's own `message` is shown.
 */
export type HandsetMode = "dial" | "prompt" | "unknown";

export interface HandsetStep {
  payeeName: string;
  ussdCode: string | null;
  /** The server's sentence, French then English. Only shown in `unknown`. */
  message: string | null;
  mode: HandsetMode;
}

/**
 * The step to put first on the waiting screen, or `null` when the answer names
 * no payee — and then the screen stays exactly as it was before this existed.
 *
 * `provider` is what the customer holds, which is allowed to decide this; the
 * aggregator never is. Pass the answer's own `provider` first: on a reused live
 * attempt that is the stored one, not what was just sent.
 */
export function handsetStepOf(
  instructions: PaymentInstructions | null | undefined,
  provider: PaymentProvider | null | undefined,
): HandsetStep | null {
  const payeeName = instructions?.payeeName?.trim();
  if (!payeeName) return null;
  const ussdCode = instructions?.ussdCode?.trim() || null;
  const mode: HandsetMode =
    provider === "ORANGE" && ussdCode ? "dial" : provider === "MTN" ? "prompt" : "unknown";
  return { payeeName, ussdCode, message: instructions?.message?.trim() || null, mode };
}

/**
 * A `tel:` link for a USSD code, or `null` for anything that is not one.
 *
 * `#` must travel as `%23`: unencoded it starts a URL fragment, and the dialer
 * receives the code cut off at the first `#`. A code with a sentence around it
 * gets no link, and stays readable as text.
 */
export function dialHref(ussdCode: string): string | null {
  return /^[*#0-9]+$/.test(ussdCode) ? `tel:${encodeURIComponent(ussdCode)}` : null;
}

/** The pace of every wait: one minute at this rate, which is all most gateways need. */
export const POLL_MS = 4_000;
const POLL_ATTEMPTS = 15;

/** Past that minute, for a wait that can take minutes. Half an hour in all. */
const LONG_POLL_MS = 10_000;
const LONG_POLL_ATTEMPTS = POLL_ATTEMPTS + (29 * 60_000) / LONG_POLL_MS;

/**
 * How long to wait before the next `verify`, or `null` to stop asking.
 *
 * `longWait` is for a charge that names a payee: the customer may still be
 * finding the dialer when the first minute ends, and the money can land minutes
 * after that. Stopping is never a verdict. Whatever the caller does at `null`, it
 * must not say the payment failed; only a `FAILED` or `CANCELLED` status does.
 *
 * @param attempts how many checks have run so far
 */
export function nextPollDelay(attempts: number, longWait: boolean): number | null {
  if (attempts < POLL_ATTEMPTS) return POLL_MS;
  if (longWait && attempts < LONG_POLL_ATTEMPTS) return LONG_POLL_MS;
  return null;
}

/**
 * Whether `/options` already says this amount will be refused.
 *
 * `limits` are in XAF, so another currency is left to the server's own
 * `422 PAYMENT_AMOUNT_OUT_OF_RANGE`. No limits means none are known, not none exist.
 */
export function amountOutsideLimits(
  amount: number,
  currency: string,
  limits: PaymentLimits | undefined,
): boolean {
  if (!limits || currency !== "XAF") return false;
  return amount < limits.min || amount > limits.max;
}

// ─── Surviving a reload ──────────────────────────────────────────────────────
//
// Tapping the `tel:` link sends the customer to the dialer, and a phone may well
// discard the tab behind it. So the step is kept for the session, keyed on the
// transaction (or the booking, whose resumed wait has no transaction id yet).
//
// ⚠ Deliberately NOT a query parameter, unlike `ussd` and `note`. Those only ever
// render as text. A payee name and a one-tap dial link read from the URL would let
// a crafted wi-mall.com link offer "confirm with <anyone>" and dial any USSD code,
// including a money transfer.

const STORAGE_PREFIX = "wi-mall.shop.handset-step.";

/** For the one navigation that must survive storage being blocked. */
const memory = new Map<string, HandsetStep>();

/** `null` forgets: a fresh attempt without a payee must not inherit an old one's. */
export function rememberHandsetStep(key: string, step: HandsetStep | null): void {
  if (step) memory.set(key, step);
  else memory.delete(key);
  try {
    if (step) sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(step));
    else sessionStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    /* blocked storage costs a reload the step, never the payment */
  }
}

function isHandsetStep(value: unknown): value is HandsetStep {
  if (typeof value !== "object" || value === null) return false;
  const s = value as Partial<HandsetStep>;
  return (
    typeof s.payeeName === "string" &&
    (s.mode === "dial" || s.mode === "prompt" || s.mode === "unknown") &&
    (s.ussdCode === null || typeof s.ussdCode === "string") &&
    (s.message === null || typeof s.message === "string")
  );
}

export function readHandsetStep(key: string): HandsetStep | null {
  const held = memory.get(key);
  if (held) return held;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return isHandsetStep(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
