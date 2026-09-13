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

const CHANNEL_META: Record<MessagingChannel, { label: string; icon: IconName }> = {
  whatsapp: { label: "WhatsApp", icon: "message-circle" },
  telegram: { label: "Telegram", icon: "send" },
};

/** Falls back to the raw channel id so an added third channel still renders. */
function metaFor(channel: MessagingChannel) {
  return CHANNEL_META[channel] ?? { label: channel, icon: "message-circle" };
}

export function ChatChannels() {
  const connections = useApiResource<MessagingConnection[]>(() => listConnections());

  return (
    <>
      <p className="ds-overline" style={{ marginBottom: 8 }}>
        Chat channels
      </p>
      <p className="muted" style={{ fontSize: 12.5, marginBottom: 10, lineHeight: 1.5 }}>
        Connect a chat account before you can pick it as a delivery channel below.
        Connecting is done from the chat itself — the bot gives you a code.
      </p>

      <ResourceView
        status={connections.status}
        error={connections.error}
        data={connections.data}
        onRetry={connections.reload}
        errorFallback="We couldn't load your chat channels."
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
  const t = useTranslations("errors");
  const format = useFormatter();
  const { flash, flashError } = useToast();

  const [redeeming, setRedeeming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [code, setCode] = useState("");

  const { label, icon } = metaFor(connection.channel);
  const howTo = connection.howToConnect;

  const submit = useCallback(async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      // Verbatim: the server is already forgiving about case, dashes, spaces,
      // O/0 and I/L, and a second opinion here could only disagree with it.
      const next = await redeemConnectionCode(code);
      flash(`${metaFor(next.channel).label} connected`);
      setCode("");
      setRedeeming(false);
      onChanged();
    } catch (err) {
      // A code is spent by the attempt even when it fails, so the honest
      // message is always "get a new one" — which is what the CONNECTION_CODE_*
      // copy says. Never invite a retry of the same code.
      flashError(translateError(t, err, "We couldn't connect that account."));
    } finally {
      setBusy(false);
    }
  }, [code, flash, flashError, onChanged, t]);

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      await disconnectChannel(connection.channel);
      flash(`${label} disconnected`);
      onChanged();
    } catch (err) {
      flashError(translateError(t, err, "We couldn't disconnect that account."));
    } finally {
      setBusy(false);
      setConfirmDisconnect(false);
    }
  }, [connection.channel, label, flash, flashError, onChanged, t]);

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
                  ? `Connected ${format.dateTime(new Date(connection.connectedAt), {
                      dateStyle: "medium",
                    })}`
                  : "Connected")}
            </div>
          ) : (
            <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
              Not connected
            </div>
          )}
        </div>

        {connection.connected ? (
          <>
            <Badge tone="success">Connected</Badge>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirmDisconnect(true)}>
              Disconnect
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setRedeeming((open) => !open)}
            aria-expanded={redeeming}
          >
            {redeeming ? "Cancel" : "Connect"}
          </Button>
        )}
      </div>

      {/* ── Redeem ───────────────────────────────────────────────────────── */}
      {!connection.connected && redeeming && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
            Send{" "}
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
              {howTo?.command ?? "/connect"}
            </code>{" "}
            to {howTo?.botHandle ?? `the ${label} bot`}, then type the six-character
            code it replies with. The code lasts ten minutes and works once.
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
                Open {label}
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
              aria-label={`${label} connection code`}
              className="field"
              style={{ flex: 1, fontFamily: "var(--font-mono, monospace)", letterSpacing: "0.14em" }}
            />
            <Button type="submit" size="md" disabled={busy || !code.trim()}>
              {busy ? "Connecting…" : "Connect"}
            </Button>
          </form>
        </div>
      )}

      {/* Disconnecting is cheap to do and expensive to undo: getting back in
          means a fresh code from the bot, and any delivery channel that was
          riding on this connection stops until then. */}
      <ConfirmDialog
        open={confirmDisconnect}
        title={`Disconnect ${label}?`}
        tone="danger"
        icon={icon}
        confirmLabel="Disconnect"
        cancelLabel="Stay connected"
        busy={busy}
        onConfirm={() => void disconnect()}
        onCancel={() => setConfirmDisconnect(false)}
      >
        Notifications stop arriving on {label}, and reconnecting means asking the bot for a new
        code.
      </ConfirmDialog>
    </div>
  );
}
