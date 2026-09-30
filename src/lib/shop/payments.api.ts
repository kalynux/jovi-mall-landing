/**
 * Paying for a checkout group.
 *
 * ⚠️ **`initiate`, `verify` and `authorize` answer flat — no `data` key.** They
 * are among the endpoint families the backend builds by hand rather than through
 * the response interceptor, so `apiFetch` returns the whole body and those types
 * are the *full response*, not a payload. `GET /payments/options` is the
 * exception: it uses the standard envelope, so `apiFetch` unwraps it.
 *
 * One payment settles the whole group. A cart with two sellers becomes two
 * orders sharing one `cartId`, and `initiatePayment({ cartId })` pays for both
 * in a single transaction that fans out at settlement — which is why the cart id
 * and not an order id is what the storefront sends.
 *
 * `initiate` is **idempotent**: initiating twice returns the existing
 * transaction rather than charging twice, so a double-tapped pay button is safe.
 *
 * ── Provider, never aggregator (ADR-A08, 2026-09-30) ─────────────────────────
 *
 * The shop sends what the shopper pays WITH (`provider`: MTN, ORANGE…) and the
 * server decides which company moves the money. An administrator can switch
 * that company at runtime with no release, so nothing in this app may name it,
 * choose it, or branch on it. What the screen does next is decided by the
 * `instructions` on the answer — see `nextPaymentStep`. The contract is
 * `api-doc/payments/routing.md`.
 */
import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/auth/auth.types";

/**
 * What the customer pays with. The server's catalogue, in its order.
 *
 * `/options` never lists anything outside it, but a read (a stored transaction,
 * a pay-link session) is typed `string` wherever it is shown, not this union.
 */
export const PAYMENT_PROVIDERS = ["MTN", "ORANGE", "MOOV", "CARD"] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export function isPaymentProvider(value: unknown): value is PaymentProvider {
  return typeof value === "string" && (PAYMENT_PROVIDERS as readonly string[]).includes(value);
}

/** The mobile networks a Cameroon number can be read as. Used in the mismatch refusal. */
export type MobileProvider = Exclude<PaymentProvider, "CARD">;

/**
 * One entry of `GET /api/payments/options`.
 *
 * `flow` says which screen to *prepare*, never which one to show: the charge
 * follows whatever is active when `initiate` runs, so `nextPaymentStep` reads
 * the answer instead.
 */
export interface PaymentProviderOption {
  provider: PaymentProvider;
  kind: "MOBILE_MONEY" | "CARD";
  flow: "PUSH" | "OTP" | "CARD_ELEMENT" | "REDIRECT";
  /** The `channel` fields the charge requires. `["phoneNumber"]`, or `[]` for a card. */
  fields: string[];
  /** `true` exactly when `flow` is `OTP`. */
  mayRequireOtp: boolean;
  /** Only on a `CARD_ELEMENT` entry: the Stripe key to load Stripe.js with. */
  publishableKey?: string;
}

/**
 * What can be paid with, right now.
 *
 * Unauthenticated and `no-store`, so call it every time a pay screen or sheet
 * opens. **An empty array is a valid answer**: an administrator switched online
 * payment off. Entries whose `provider` this build does not know are dropped —
 * there is no label or artwork to draw them with.
 */
export async function getPaymentOptions(): Promise<PaymentProviderOption[]> {
  const data = await apiFetch<{ providers?: unknown }>("/api/payments/options", {
    cache: "no-store",
  });
  const list = Array.isArray(data?.providers) ? data.providers : [];
  return list.filter(
    (entry): entry is PaymentProviderOption =>
      typeof entry === "object" && entry !== null && isPaymentProvider((entry as { provider?: unknown }).provider)
  );
}

/**
 * The charge provider behind a SAVED method, or `null` when it cannot be paid
 * with directly.
 *
 * Since 2026-09-30 a saved method's `provider` IS the charge vocabulary — the
 * server reads old `mtn_momo` rows back as `MTN` — so this is a pass-through
 * for the three wallets. `CARD` (a card saved long ago) and `null` (an old
 * wallet whose network is unknown) are listed, but never pre-selected.
 */
export function providerForSavedWallet(saved: string | null | undefined): MobileProvider | null {
  return saved === "MTN" || saved === "ORANGE" || saved === "MOOV" ? saved : null;
}

export interface PaymentChannel {
  /** E.164. Mobile money debits this number. */
  phoneNumber?: string;
  customerEmail?: string;
  customerName?: string;
}

/** The body every charging door takes besides its own id. */
export interface ChargeRequest {
  provider: PaymentProvider;
  channel: PaymentChannel;
}

/**
 * How the shopper completes the payment. **Branch on which fields are present**
 * — the same provider comes back with a different shape after an aggregator
 * switch. `message` is the server's own copy for the step.
 */
export interface PaymentInstructions {
  ussdCode?: string;
  /** Collect the SMS code and send it to `authorizePayment`. Nothing is charged until then. */
  requiresOtp?: boolean;
  /** Open this page; the payment completes there. Reserved, unused today. */
  redirectUrl?: string;
  /** A card charge: confirmed by Stripe's Payment Element. */
  clientSecret?: string;
  chargedAmount?: number;
  chargedCurrency?: string;
  message?: string;
  expiresAt?: string;
}

export interface InitiatePaymentResponse {
  success: boolean;
  transactionId: string;
  status: string;
  /**
   * What this attempt is charged on. On a reused live attempt it is the STORED
   * one — possibly not what was just sent, and `null` on an attempt opened
   * before 2026-09-30.
   */
  provider?: PaymentProvider | null;
  /** Absent on a refusal, which carries its reason in `message` instead. */
  instructions?: PaymentInstructions;
  message?: string;
}

export interface VerifyPaymentResponse {
  success: boolean;
  transactionId: string;
  status: string;
  message?: string;
}

/**
 * A transaction status that will never change again.
 *
 * `initiate` can answer with one: the charge is attempted synchronously, and a
 * refusal comes back on that same response rather than through the webhook. The
 * success screen otherwise treats every fresh transaction as pending and polls
 * `verify` for a minute — so without this check a shopper whose payment was
 * already declined watches "Waiting for your payment" for sixty seconds before
 * being told what the server said immediately.
 */
export const isSettledFailure = (status: string): boolean =>
  status === "FAILED" || status === "CANCELLED";

/**
 * What the screen does after a charge starts.
 *
 * Read off `instructions` and nothing else, in this order: a code step blocks
 * everything (nothing reaches the handset until it is done, whatever `/options`
 * said), a redirect or a card form is somewhere else to go, and anything else
 * means the prompt is on its way to the phone.
 */
export type PaymentStep =
  | { kind: "otp" }
  | { kind: "redirect"; url: string }
  | { kind: "card" }
  | { kind: "phone" };

export function nextPaymentStep(instructions: PaymentInstructions | undefined): PaymentStep {
  if (instructions?.requiresOtp) return { kind: "otp" };
  if (instructions?.redirectUrl) return { kind: "redirect", url: instructions.redirectUrl };
  if (instructions?.clientSecret) return { kind: "card" };
  return { kind: "phone" };
}

/**
 * Pay for a checkout group.
 *
 * The backend also accepts `{ orderId }` for a single order, and the storefront
 * deliberately does not use it: a group is charged once, the shopper was told
 * so at checkout, and `initiatePaymentForCart` already filters to the orders
 * that are still payable — so one cancelled order inside a group does not need
 * a per-order call to avoid being re-charged.
 */
export async function initiatePayment(
  input: { cartId: string } & ChargeRequest
): Promise<InitiatePaymentResponse> {
  return apiFetch<InitiatePaymentResponse>("/api/payments/initiate", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * Poll after the shopper approves on their handset.
 *
 * Mobile money is asynchronous — `initiate` returns with the prompt sent, not
 * with the money taken — so the success screen verifies rather than assuming.
 */
export async function verifyPayment(transactionId: string): Promise<VerifyPaymentResponse> {
  return apiFetch<VerifyPaymentResponse>("/api/payments/verify", {
    method: "POST",
    body: JSON.stringify({ transactionId }),
  });
}

/**
 * Relay the shopper's SMS code, when `initiate` answered `requiresOtp`.
 *
 * Order, cart and booking payments all use this one route. The payment is
 * still `PENDING` afterwards: the code authorises the charge, and the shopper
 * then confirms it on the handset as usual — so the answer carries fresh
 * `instructions` for that step.
 *
 * Refusals: `PAYMENT_OTP_INVALID` (`details.attemptsRemaining`),
 * `PAYMENT_OTP_ATTEMPTS_EXCEEDED` (the transaction is now `FAILED`) and
 * `PAYMENT_OTP_NOT_REQUIRED`.
 */
export async function authorizePayment(
  transactionId: string,
  code: string
): Promise<InitiatePaymentResponse> {
  return apiFetch<InitiatePaymentResponse>(
    `/api/payments/${encodeURIComponent(transactionId)}/authorize`,
    { method: "POST", body: JSON.stringify({ code }) }
  );
}

/**
 * The three refusals a charge can meet before anything is written.
 *
 * Every one of them means nothing was charged, so the form stays as it is and
 * the shopper corrects and presses Pay again.
 */
export type ProviderRefusal =
  /** The number's prefix names another network. `detected` is MTN or ORANGE. */
  | { code: "PAYMENT_PROVIDER_PHONE_MISMATCH"; provider: PaymentProvider | null; detected: MobileProvider }
  /**
   * The choice was switched off after the screen loaded. `offered` is the fresh
   * list — `[]` means online payment is now off — or `null` when the refusal
   * carried none, and the caller re-reads `/options` instead of guessing.
   */
  | { code: "PAYMENT_PROVIDER_UNAVAILABLE"; provider: PaymentProvider | null; offered: PaymentProvider[] | null }
  /** Only an old-style body can get this — a bug in the build if it ever shows. */
  | { code: "PAYMENT_PROVIDER_REQUIRED" };

export function readProviderRefusal(error: unknown): ProviderRefusal | null {
  if (!(error instanceof ApiError)) return null;
  const details = (error.details ?? {}) as Record<string, unknown>;
  const provider = isPaymentProvider(details.provider) ? details.provider : null;

  switch (error.code) {
    case "PAYMENT_PROVIDER_PHONE_MISMATCH": {
      const detected = details.detected;
      // Without a readable network there is nothing specific to say; the
      // caller's generic ladder still has the code's own sentence.
      if (detected !== "MTN" && detected !== "ORANGE" && detected !== "MOOV") return null;
      return { code: error.code, provider, detected };
    }
    case "PAYMENT_PROVIDER_UNAVAILABLE": {
      const offered = Array.isArray(details.offered) ? details.offered.filter(isPaymentProvider) : null;
      return { code: error.code, provider, offered };
    }
    case "PAYMENT_PROVIDER_REQUIRED":
      return { code: error.code };
    default:
      return null;
  }
}
