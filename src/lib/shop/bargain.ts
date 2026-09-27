import { EXTERNAL_LINKS, buildWhatsAppUrl } from "@/lib/constants";

/**
 * Bargaining from the web: the storefront never negotiates, it hands the
 * shopper to the bot with the product already named.
 *
 * ── The contract (agreed with the backend, 2026-09-27) ───────────────────────
 *
 * - **WhatsApp** pre-fills `/bargain <productId> <variantId>` on the FIRST line.
 *   n8n tests only the first character of a message for a command, so anything
 *   before it — even a greeting — turns the whole message into free text for the
 *   AI, which may or may not open a haggle. The command stays English in every
 *   locale; only the courtesy sentence on the second line is translated, and the
 *   backend ignores it.
 * - **Telegram** cannot pre-fill a message to a bot. The only carrier is
 *   `t.me/<bot>?start=<payload>`, which Telegram delivers as
 *   `/start bargain_<productId>_<variantId>` — 57 characters of the 64 allowed,
 *   and no `:` because the payload admits only `[A-Za-z0-9_-]`.
 * - **Always the selected variant**: whether a price is negotiable is a
 *   per-variant fact. Quantity is never sent; the bot opens at 1.
 *
 * ⛔ **Deploy order: backend first.** Until jovi-mall answers `/bargain` and
 * reads the `/start` argument, WhatsApp replies "unknown command" and Telegram
 * sends its welcome, and the product is lost either way. So the whole feature —
 * the button AND the card marker — is behind `NEXT_PUBLIC_BARGAIN_ENABLED`,
 * which stays off in `.env.production` until both channels are tested on a phone.
 */

/** The feature switch. Anything but the literal `"true"` is off. */
export const BARGAIN_ENABLED = process.env.NEXT_PUBLIC_BARGAIN_ENABLED === "true";

/** Not localised, like every command in `BOT_COMMANDS`. */
export const BARGAIN_COMMAND = "/bargain";

/**
 * A Mongo ObjectId. The bot answers a malformed id with its generic
 * "unrecognised action", so an id that fails this draws no button at all.
 */
const OBJECT_ID = /^[0-9a-f]{24}$/i;

export interface BargainTarget {
  productId: string;
  variantId: string;
}

export function isBargainTarget(target: BargainTarget): boolean {
  return OBJECT_ID.test(target.productId) && OBJECT_ID.test(target.variantId);
}

/**
 * The pre-filled WhatsApp text. `sentence` is the translated courtesy line;
 * it follows a newline so the command stays the message's first character.
 */
export function bargainWhatsAppText({ productId, variantId }: BargainTarget, sentence: string): string {
  return `${BARGAIN_COMMAND} ${productId} ${variantId}\n${sentence}`;
}

export function bargainWhatsAppUrl(target: BargainTarget, sentence: string): string {
  return buildWhatsAppUrl(bargainWhatsAppText(target, sentence));
}

/** `null` when no Telegram bot name is configured — the caller then goes straight to WhatsApp. */
export function bargainTelegramUrl({ productId, variantId }: BargainTarget): string | null {
  const handle = EXTERNAL_LINKS.telegramBotName.replace(/^@/, "");
  if (!handle) return null;
  return `https://t.me/${handle}?start=bargain_${productId}_${variantId}`;
}
