"use client";

/**
 * Connect WhatsApp or Telegram to the account — `/api/me/connections`.
 *
 * The direction is inverted from the flow this replaced: **the bot mints the
 * code and the user redeems it here**, rather than the platform minting a code
 * the user carries into a chat window. So this component cannot "send" anything;
 * all it can do is tell the person which command to send, and take the six
 * characters that come back.
 *
 * The copy has to hold that line in all five languages. Every catalogue keeps the
 * shopper as the sender — *you* send the command, the bot answers with a code —
 * and none of them may promise that Wi-Mall will message anyone from this screen,
 * because it cannot. `openApp` hands the person over to the chat app; that is the
 * whole of what this screen can do for them.
 *
 * It sits above the delivery-channel switches because the two are different
 * steps and both are required: connecting a channel makes it *possible* to
 * deliver there, enabling it in preferences makes it *happen*. A channel that is
 * enabled but not connected delivers nothing, which reads as us being broken —
 * so the connect step goes first, visibly.
 *
 * Contract: api-doc/connections/README.md.
 */
import { useCallback, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { AccountCard, ResourceView } from "./AccountShell";
import { Badge, Button, ConfirmDialog, Icon, type IconName } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { translateError } from "@/lib/auth/error-translator";
import {
  disconnectChannel,
  listConnections,
  redeemConnectionCode,
  type MessagingChannel,
  type MessagingConnection,
} from "@/lib/me/connections.api";
import { useApiResource } from "@/lib/shop/useApiResource";

/** Module scope, so these name keys rather than sentences — LOCALISATION.md §3. */
const CHANNEL_META: Record<MessagingChannel, { labelKey: string; icon: IconName }> = {
  whatsapp: { labelKey: "shop.channels.names.whatsapp", icon: "message-circle" },
  telegram: { labelKey: "shop.channels.names.telegram", icon: "send" },
};

/**
 * A channel added server-side should still appear without a frontend release, and
 * it has no catalogue entry yet — so the key is nullable and the call site falls
 * back to the raw id. Handing an unknown id to `tKey` would print
 * `shop.channels.names.slack` into the row instead.
 */
function metaFor(channel: MessagingChannel): { labelKey: string | null; icon: IconName } {
  return CHANNEL_META[channel] ?? { labelKey: null, icon: "message-circle" };
}

export function ChatChannels() {
  const connections = useApiResource<MessagingConnection[]>(() => listConnections());
  const t = useTranslations("shop.channels");

  return (
    <>
      <p className="ds-overline" style={{ marginBottom: 8 }}>
        {t("heading")}
      </p>
      <p className="muted" style={{ fontSize: 12.5, marginBottom: 10, lineHeight: 1.5 }}>
        {t("intro")}
      </p>

      <ResourceView
        status={connections.status}
        error={connections.error}
        data={connections.data}
        onRetry={connections.reload}
        errorFallback={t("loadFailed")}
      >
        {(rows) => (
          <AccountCard style={{ padding: 0, marginBottom: 20, overflow: "hidden" }}>
            {/* Iterate rather than hardcode two cards — a channel added
                server-side should appear without a frontend release. */}
            {rows.map((row, i) => (
              <ChannelRow
                key={row.channel}
                connection={row}
                last={i === rows.length - 1}
                onChanged={connections.reload}
              />
            ))}
          </AccountCard>
        )}
      </ResourceView>
    </>
  );
}

// ─── One channel ─────────────────────────────────────────────────────────────

function ChannelRow({
  connection,
  last,
  onChanged,
}: {
  connection: MessagingConnection;
  last: boolean;
  onChanged: () => void;
}) {
  const t = useTranslations("shop.channels");
  const tErrors = useTranslations("errors");
  const tKey = useTranslations();
  const format = useFormatter();
  const { flash, flashError } = useToast();

  const [redeeming, setRedeeming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [code, setCode] = useState("");

  /** The channel's display name, or its raw id when the catalogue has none. */
  const nameOf = useCallback(
    (channel: MessagingChannel) => {
      const { labelKey } = metaFor(channel);
      return labelKey ? tKey(labelKey) : channel;
    },
    [tKey],
  );

  const { icon } = metaFor(connection.channel);
  const label = nameOf(connection.channel);
  const howTo = connection.howToConnect;

  const submit = useCallback(async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      // Verbatim: the server is already forgiving about case, dashes, spaces,
      // O/0 and I/L, and a second opinion here could only disagree with it.
      const next = await redeemConnectionCode(code);
      flash(t("connectedToast", { channel: nameOf(next.channel) }));
      setCode("");
      setRedeeming(false);
      onChanged();
    } catch (err) {
      // A code is spent by the attempt even when it fails, so the honest
      // message is always "get a new one" — which is what the CONNECTION_CODE_*
      // copy says. Never invite a retry of the same code.
      flashError(translateError(tErrors, err, t("connectFailed")));
    } finally {
      setBusy(false);
    }
  }, [code, flash, flashError, nameOf, onChanged, t, tErrors]);

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      await disconnectChannel(connection.channel);
      flash(t("disconnectedToast", { channel: label }));
      onChanged();
    } catch (err) {
      flashError(translateError(tErrors, err, t("disconnectFailed")));
    } finally {
      setBusy(false);
      setConfirmDisconnect(false);
    }
  }, [connection.channel, label, flash, flashError, onChanged, t, tErrors]);

  return (
    <div
      style={{
        padding: 14,
        borderBottom: last ? "none" : "1px solid var(--border-subtle)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <Icon name={icon} size={19} style={{ color: "var(--text-muted)" }} />

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)" }}>
            {label}
          </div>
          {connection.connected ? (
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              {/* identityHint may be null — then the display name stands alone,
                  and if that is null too the connected date still says enough.
                  The raw phone number and chat id never leave the backend. */}
              {[connection.displayName, connection.identityHint]
                .filter(Boolean)
                .join(" · ") ||
                (connection.connectedAt
                  ? t("connectedOn", {
                      date: format.dateTime(new Date(connection.connectedAt), {
                        dateStyle: "medium",
                      }),
                    })
                  : t("connected"))}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              {t("notConnected")}
            </div>
          )}
        </div>

        {connection.connected ? (
          <>
            <Badge tone="success">{t("connected")}</Badge>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmDisconnect(true)}>
              {t("disconnect")}
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setRedeeming((open) => !open)}
            aria-expanded={redeeming}
          >
            {redeeming ? tKey("shop.common.cancel") : t("connect")}
          </Button>
        )}
      </div>

      {/* ── Redeem ───────────────────────────────────────────────────────── */}
      {!connection.connected && redeeming && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {/* One whole sentence per case, not a stem plus a fragment: French puts
              "au bot WhatsApp" where English puts "to the WhatsApp bot", and a
              handle needs a different preposition from a noun phrase in three of
              the five languages. So the bot-known and bot-unknown readings are
              separate messages. §4. */}
          <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
            {t.rich(howTo?.botHandle ? "howToWithBot" : "howToNoBot", {
              command: howTo?.command ?? "/connect",
              bot: howTo?.botHandle ?? "",
              channel: label,
              cmd: (chunks) => (
                <code
                  style={{
                    background: "var(--surface-subtle, var(--border-subtle))",
                    borderRadius: 5,
                    padding: "1px 5px",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-strong)",
                  }}
                >
                  {chunks}
                </code>
              ),
            })}
          </p>

          {/* deepLink is null when the bot is not configured server-side. The
              command above is then the whole instruction, and the flow still
              works — so this is an absent button, not an error state. */}
          {howTo?.deepLink && (
            <a
              href={howTo.deepLink}
              target="_blank"
              rel="noopener noreferrer"
              style={{ alignSelf: "flex-start" }}
            >
              <Button size="sm" variant="secondary" leadingIcon={icon}>
                {t("openApp", { channel: label })}
              </Button>
            </a>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit();
            }}
            style={{ display: "flex", gap: 8 }}
          >
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="A7K9P2"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={16}
              aria-label={t("codeLabel", { channel: label })}
              className="field"
              style={{ flex: 1, fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.14em" }}
            />
            <Button type="submit" size="md" disabled={busy || !code.trim()}>
              {busy ? t("connecting") : t("connect")}
            </Button>
          </form>
        </div>
      )}

      {/* Disconnecting is cheap to do and expensive to undo: getting back in
          means a fresh code from the bot, and any delivery channel that was
          riding on this connection stops until then. */}
      <ConfirmDialog
        open={confirmDisconnect}
        title={t("disconnectTitle", { channel: label })}
        tone="danger"
        icon={icon}
        confirmLabel={t("disconnect")}
        cancelLabel={t("stayConnected")}
        busy={busy}
        onConfirm={() => void disconnect()}
        onCancel={() => setConfirmDisconnect(false)}
      >
        {t("disconnectBody", { channel: label })}
      </ConfirmDialog>
    </div>
  );
}
