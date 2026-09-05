/**
 * The mobile-money numbers behind this device's saved payment methods.
 *
 * ── Why the client has to remember these at all ──────────────────────────────
 *
 * A saved mobile-money method *is* a phone number — `AddPaymentMethodPayload`
 * sends the same E.164 value as both `gateway_customer_id` and
 * `gateway_instrument_id`, because for a wallet the customer and the instrument
 * are the same thing. But the backend treats those two fields as secrets and
 * **never returns them** on any endpoint (see `customer/payment-methods.md`,
 * "Security model"). What comes back is `provider`, `brand`, `last4` and a
 * display label — enough to name the wallet, not enough to charge it.
 *
 * That is right for a card, where the number is the gateway's business. It is
 * awkward for mobile money, where the number is what `POST /api/payments/initiate`
 * has to be handed in `channel.phoneNumber`. So without this, "saved for faster
 * checkout" can only preselect the network and still make the shopper type
 * their own wallet number back in.
 *
 * This closes that gap on the device that saved the method: the number is
 * written down at the one moment the app holds it — the add form — and read
 * back when checkout preselects that method.
 *
 * ── What this is not ─────────────────────────────────────────────────────────
 *
 * Not a source of truth, and never treated as one. The saved methods themselves
 * live on the server; this only fills a field the shopper can always overwrite.
 * A shopper who saved a wallet on their phone and checks out on a laptop has no
 * entry here and simply types the number, which is exactly today's behaviour.
 *
 * Nor is it a second store to keep in sync: every read is checked against the
 * server's own `last4` before it is used, so an entry left behind by a deleted
 * and re-added method can never fill a number that is not the one on the
 * account. A mismatch is discarded, not repaired.
 *
 * Goes through `platform/storage` rather than `localStorage` for the reason
 * `payment-attempts` does — on a device that means Capacitor Preferences, which
 * an OS storage sweep does not clear.
 */
import { get, remove, set } from "@/lib/platform/storage";

const KEY = "wi-mall.shop.wallet-numbers";

/**
 * Ten — the backend's own per-user cap on saved methods
 * (`PAYMENT_METHOD_LIMIT_REACHED`), so this can hold every method a user is
 * allowed to have and still never grow without bound.
 */
const MAX = 10;

interface Wallet {
  /** The saved payment method's server id. */
  id: string;
  /** E.164, as it was sent to `POST /api/me/payment-methods`. */
  number: string;
}

function isWallet(value: unknown): value is Wallet {
  if (typeof value !== "object" || value === null) return false;
  const w = value as Partial<Wallet>;
  return typeof w.id === "string" && typeof w.number === "string";
}

/** Newest first. `[]` for anything unreadable rather than throwing. */
async function read(): Promise<Wallet[]> {
  try {
    const raw = await get(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Filter rather than trust: this string is hand-editable, and what comes
    // out of it is what a payment prompt would be sent to.
    return parsed.filter(isWallet);
  } catch {
    return [];
  }
}

async function write(list: Wallet[]): Promise<void> {
  if (list.length === 0) {
    await remove(KEY);
    return;
  }
  await set(KEY, JSON.stringify(list.slice(0, MAX)));
}

/**
 * Note the number a saved mobile-money method was created with.
 *
 * Call it with the id from the `POST /api/me/payment-methods` response — the
 * method has to exist server-side before there is an id to key on.
 *
 * Never rejects: a preference that cannot be written costs a prefilled field
 * next time, and nothing else.
 */
export async function rememberWalletNumber(id: string, e164: string): Promise<void> {
  try {
    const rest = (await read()).filter((w) => w.id !== id);
    await write([{ id, number: e164 }, ...rest]);
  } catch {
    // As above.
  }
}

/**
 * The number behind a saved method, if this device is the one that saved it.
 *
 * `last4` is the server's, and it is the check that makes this safe to prefill:
 * ids are not reused, but a stale entry is cheap insurance against ever putting
 * one wallet's number under another wallet's label. A method saved without a
 * `last4` cannot be verified, so it is not answered for.
 */
export async function readWalletNumber(id: string, last4: string | null | undefined): Promise<string | null> {
  if (!last4) return null;
  const found = (await read()).find((w) => w.id === id);
  if (!found) return null;
  return found.number.replace(/\D/g, "").slice(-4) === last4 ? found.number : null;
}

/** Drop a method's number once the method itself is gone. */
export async function forgetWalletNumber(id: string): Promise<void> {
  try {
    await write((await read()).filter((w) => w.id !== id));
  } catch {
    // As above.
  }
}
