/**
 * The Bargain link's text, against `api-doc/public/bargain-deep-link.md` and the
 * grammar jovi-mall parses it with (`bot-commands/domain/bargain-entry.ts`):
 * `/bargain <product> <variant> <note>` and `/start bargain_<product>_<variant>`.
 *
 * Run with `npm test`. The Telegram handle is read from the environment when
 * `lib/constants` is first evaluated, so it is set before the dynamic import.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME = "WiMallBot";
const { bargainTelegramUrl, bargainWhatsAppText, bargainWhatsAppUrl, isBargainTarget } = await import("./bargain");

const PID = "6ab0d1fe865937d254d5cba7";
const VID = "6ab0d1fe865937d254d5cba8";

test("WhatsApp: the command is the first line, both ids named, the sentence on line 2", () => {
  const text = bargainWhatsAppText({ productId: PID, variantId: VID }, "Hello");
  assert.equal(text, `/bargain ${PID} ${VID}\nHello`);
  assert.equal(text[0], "/");
});

test("WhatsApp: the newline travels URL-encoded", () => {
  assert.match(bargainWhatsAppUrl({ productId: PID, variantId: VID }, "Hi"), new RegExp(`${VID}%0AHi$`));
});

test("Telegram: the start payload is bargain_<pid>_<vid>, 57 characters", () => {
  const url = bargainTelegramUrl({ productId: PID, variantId: VID });
  assert.equal(url, `https://t.me/WiMallBot?start=bargain_${PID}_${VID}`);
  assert.equal(new URL(url!).searchParams.get("start")!.length, 57);
});

test("a malformed or empty id is no target", () => {
  assert.equal(isBargainTarget({ productId: PID, variantId: VID }), true);
  assert.equal(isBargainTarget({ productId: "abc", variantId: VID }), false);
  assert.equal(isBargainTarget({ productId: PID, variantId: "" }), false);
});
