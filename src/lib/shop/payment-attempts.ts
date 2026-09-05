/**
 * The last payment this device started for a checkout group.
 *
 * ── Why the client has to remember this at all ───────────────────────────────
 *
 * `POST /api/payments/verify` is the only call that forces the gateway to be
 * re-asked *now*, and it takes a `transactionId`. Nothing on the order side ever
 * returns one: `GET /api/customer/orders/group/:cartId` carries statuses and
 * totals and no payment reference, and there is no "the transaction for this
 * cart" endpoint to look one up with. So the id exists for exactly one moment —
 * the `initiate` response — and if the storefront does not write it down, the
 * shopper's "check my payment" button has nothing to check with.
 *
 * ── Why the alternatives were rejected ───────────────────────────────────────
 *
 *   - **Calling `initiate` again to re-derive the id.** It is idempotent only
 *     while the transaction is live; on a `FAILED` or `CANCELLED` one it falls
 *     through and creates a *fresh* transaction, which on mobile money means a
 *     second prompt pushed to the handset. A button labelled "check" must never
 *     be able to start a payment.
 *   - **Not verifying at all, just re-reading the order.** That is the fallback
 *     below and it is genuinely useful — webhooks and the backend's re-verify
 *     sweep settle the order without anyone polling — but it only sees what has
 *     already landed. The whole point of the button is the shopper who approved
 *     the prompt thirty seconds ago and whose callback has not arrived yet.
 *
 * ── What this is not ─────────────────────────────────────────────────────────
 *
 * Not a source of truth, and never treated as one. It is a per-device hint: a
 * shopper who paid on their phone and opens the order on a laptop has no entry
 * here, and the caller must still work. Losing it costs the forced re-check,
 * nothing more.
 *
 * Goes through `platform/storage` rather than `localStorage` for the reason
 * `recent-searches` does — on a device that means Capacitor Preferences, which
 * an OS storage sweep does not clear.
 */
import { get, remove, set } from "@/lib/platform/storage";

const KEY = "wi-mall.shop.payment-attempts";

/**
 * How many groups to remember at once.
 *
 * One entry per checkout, and only the ones still worth checking on matter — a
 * shopper with more than a handful of orders paid-but-unsettled at the same
 * moment is not a real situation. Bounded because this is a single stored
 * string that would otherwise grow for the life of the install.
 */
const MAX = 8;

/**
 * How long an entry is worth keeping.
 *
 * A mobile-money transaction settles in minutes or never; the backend's sweep
 * has long since resolved anything older than this, so verifying against a
 * week-old id would ask the gateway about something it has closed. The order
 * itself is still the answer at that point.
 */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface Attempt {
  cartId: string;
  transactionId: string;
  /** Epoch ms, for the TTL above. */
  at: number;
}

function isAttempt(value: unknown): value is Attempt {
  if (typeof value !== "object" || value === null) return false;
  const a = value as Partial<Attempt>;
  return (
    typeof a.cartId === "string" &&
    typeof a.transactionId === "string" &&
    typeof a.at === "number"
  );
}

/** Newest first, expired entries dropped. `[]` for anything unreadable. */
async function read(): Promise<Attempt[]> {
  try {
    const raw = await get(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const fresh = Date.now() - TTL_MS;
    // Filter rather than trust: this string is hand-editable, and what comes
    // out of it is sent to the payments API as a transaction id.
    return parsed.filter(isAttempt).filter((a) => a.at > fresh);
  } catch {
    return [];
  }
}

async function write(list: Attempt[]): Promise<void> {
  if (list.length === 0) {
    await remove(KEY);
    return;
  }
  await set(KEY, JSON.stringify(list.slice(0, MAX)));
}

/**
 * Note the transaction that was just started for a group.
 *
 * Call it at every `initiate` call site. Replaces any earlier entry for the same
 * cart — a retry supersedes the attempt it is retrying, and the old id would
 * verify to `FAILED` forever.
 *
 * Never rejects: a preference that cannot be written is not worth failing a
 * payment over, and the caller is mid-navigation to the success screen.
 */
export async function rememberPaymentAttempt(
  cartId: string,
  transactionId: string,
): Promise<void> {
  try {
    const rest = (await read()).filter((a) => a.cartId !== cartId);
    await write([{ cartId, transactionId, at: Date.now() }, ...rest]);
  } catch {
    // As above.
  }
}

/** The transaction last started for this group on this device, if any. */
export async function readPaymentAttempt(cartId: string): Promise<string | null> {
  const found = (await read()).find((a) => a.cartId === cartId);
  return found?.transactionId ?? null;
}

/**
 * Drop a group's entry once its transaction has reached an end state.
 *
 * Settled either way: a `SUCCEEDED` id has nothing left to tell us, and a
 * `FAILED` one would answer every future check with a refusal that belongs to
 * an attempt the shopper has already moved on from.
 */
export async function forgetPaymentAttempt(cartId: string): Promise<void> {
  try {
    await write((await read()).filter((a) => a.cartId !== cartId));
  } catch {
    // As above.
  }
}
