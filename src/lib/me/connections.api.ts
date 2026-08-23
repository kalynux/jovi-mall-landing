/**
 * Messaging connections — `/api/me/connections`.
 *
 * One mechanism connects any messaging channel to a platform account, replacing
 * the two flows that disagreed on almost everything: the WhatsApp `/link:CODE`
 * verification (`POST /auth/request-wa-verification` +
 * `GET /webhooks/whatsapp/link/status`) and the Telegram deep-link token. All of
 * those endpoints are **deleted**, not deprecated — see
 * api-doc/connections/README.md § "What was removed".
 *
 * Two things about the design are worth holding on to, because they are what the
 * UI has to be shaped around:
 *
 * **The bot mints the code, not the platform.** The user sends `/connect` in the
 * chat and types the six characters it replies with. So the user never carries a
 * platform secret into a chat window, and the platform never has to trust a
 * webhook's claim about who sent a message.
 *
 * **The connection binds to the User, not to a role.** Somebody who is both a
 * vendor and a customer connects once and it holds everywhere. The old
 * `update_other_roles` flag existed to paper over the opposite, and is gone.
 */
import { apiFetch } from "@/lib/api/client";

export type MessagingChannel = "whatsapp" | "telegram";

export interface ConnectionHowTo {
    /** The command to send in the chat — `/connect`. */
    command: string;
    /** `@JoviMallBot`, or similar. */
    botHandle: string;
    /**
     * Opens the chat, pre-filling the command on WhatsApp only — Telegram
     * cannot. **May be `null`** when the bot is not configured server-side;
     * show `command` and `botHandle` as text then, because the flow still works.
     */
    deepLink: string | null;
}

export interface MessagingConnection {
    channel: MessagingChannel;
    /** The only flag that decides Connect vs Disconnect. */
    connected: boolean;
    /** WhatsApp profile name or Telegram display name. May be `null`. */
    displayName: string | null;
    /**
     * `••••1234` for WhatsApp, `@handle` for Telegram. **May be `null`** —
     * render `displayName` alone then.
     *
     * There is no phone number or chat id anywhere in this response, by design:
     * the raw messaging identifier never leaves the backend, and this hint is
     * not reversible.
     */
    identityHint: string | null;
    connectedAt: string | null;
    /** Present **only** while `connected` is false. */
    howToConnect?: ConnectionHowTo;
}

/**
 * GET /api/me/connections
 *
 * Every channel, connected or not, in one call. **Iterate the array** — do not
 * hardcode two cards, or a third channel ships invisible.
 */
export async function listConnections(): Promise<MessagingConnection[]> {
    const data = await apiFetch<{ connections: MessagingConnection[] }>(
        "/api/me/connections"
    );
    return data?.connections ?? [];
}

/**
 * POST /api/me/connections — redeem a bot-issued code.
 *
 * **The client does not say which channel it is redeeming**; the code carries
 * that. One input box, one button.
 *
 * ⚠️ Send the code **exactly as the user typed it**. The server is already
 * case-insensitive and forgiving about dashes and spaces, and reads `O` as `0`
 * and `I`/`L` as `1` — normalising here only introduces a second opinion.
 *
 * A code is single-use **even when the redeem fails**: it is spent by the
 * attempt. So every error means "send /connect again", never "retry this code".
 * `CONNECTION_CODE_EXPIRED` and `CONNECTION_CODE_INVALID` are genuinely
 * different and should read differently — expiry is the common case and the fix
 * is a new code, while invalid means check what you typed.
 */
export async function redeemConnectionCode(
    code: string
): Promise<MessagingConnection> {
    return apiFetch<MessagingConnection>("/api/me/connections", {
        method: "POST",
        body: JSON.stringify({ code }),
    });
}

/**
 * DELETE /api/me/connections/:channel
 *
 * `404 MESSAGING_CONNECTION_NOT_FOUND` when nothing is connected there.
 */
export async function disconnectChannel(channel: MessagingChannel): Promise<void> {
    await apiFetch<null>(`/api/me/connections/${channel}`, { method: "DELETE" });
}
