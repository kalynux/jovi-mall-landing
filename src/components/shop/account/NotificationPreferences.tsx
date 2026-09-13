"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { AccountCard, ResourceView } from "@/components/shop/account/AccountShell";
import { ChatChannels } from "@/components/shop/account/ChatChannels";
import { Badge, Icon, type IconName } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { translateError } from "@/lib/auth/error-translator";
import { getPreferences, updatePreferences } from "@/lib/shop/notifications.api";
import { useApiResource } from "@/lib/shop/useApiResource";
import type {
  // Aliased: the component below owns the plain name on this screen.
  NotificationPreferences as Preferences,
  NotificationTogglePreferences,
} from "@/lib/shop/customer.types";

/**
 * Which notifications are sent, and where they land.
 *
 * Its own screen — `/shop/account/notifications/settings` — reached by the gear
 * in the header bar of the inbox. It used to be the second half of a two-tab
 * page, which spent a row of permanent chrome on a screen most shoppers open
 * once: every visit to read a delivery update started by stepping past a tab
 * bar whose other side is a settings form.
 */

/**
 * The two groups that always send and cannot be switched off. A customer is the
 * counterparty to someone else's action here, not the owner of a dashboard: a
 * silent refund is indistinguishable from a stolen payment, and a balance nobody
 * was told about cannot fairly be chased.
 */
const ALWAYS_ON: { icon: IconName; label: string; desc: string }[] = [
  { icon: "wallet", label: "Payments & refunds", desc: "Payment received, refunds, balance due." },
  { icon: "circle-x", label: "Cancellations", desc: "An order or appointment called off." },
];

const TOGGLES: { key: keyof NotificationTogglePreferences; label: string; desc: string }[] = [
  { key: "orderUpdates", label: "Order updates", desc: "Created, shipped, out for delivery, delivered." },
  { key: "bookingUpdates", label: "Booking updates", desc: "Created, confirmed, rescheduled, completed." },
  { key: "bookingReminders", label: "Booking reminders", desc: "A nudge the day before an appointment." },
  { key: "marketing", label: "Offers & news", desc: "Nothing is sent under this yet." },
];

const CHANNELS: {
  enabledKey: "emailEnabled" | "telegramEnabled" | "whatsappEnabled";
  verifiedKey: "emailVerified" | "telegramVerified" | "whatsappVerified";
  label: string;
  icon: IconName;
}[] = [
  { enabledKey: "emailEnabled", verifiedKey: "emailVerified", label: "Email", icon: "mail" },
  { enabledKey: "telegramEnabled", verifiedKey: "telegramVerified", label: "Telegram", icon: "send" },
  { enabledKey: "whatsappEnabled", verifiedKey: "whatsappVerified", label: "WhatsApp", icon: "message-circle" },
];

export function NotificationPreferences() {
  const prefs = useApiResource<Preferences>(() => getPreferences());
  const [saving, setSaving] = useState(false);
  const { flash, flashError } = useToast();
  const t = useTranslations("errors");

  const save = useCallback(
    async (payload: Parameters<typeof updatePreferences>[0]) => {
      setSaving(true);
      try {
        // Always re-render from the response: enabling one secondary channel
        // disables the other two server-side, so optimistic local state would
        // show two channels on until the next reload.
        prefs.set(await updatePreferences(payload));
        flash("Preferences saved");
      } catch (err) {
        flashError(translateError(t, err, "We couldn't save that preference."));
      } finally {
        setSaving(false);
      }
    },
    [prefs, flash, flashError, t],
  );

  return (
    <ResourceView
      status={prefs.status}
      error={prefs.error}
      data={prefs.data}
      onRetry={prefs.reload}
      errorFallback="We couldn't load your notification settings."
    >
      {(p) => (
        <>
          {/* Connect first, enable second. `whatsappVerified` /
              `telegramVerified` below simply mirror whether a connection
              exists, so a switch that cannot be turned on is explained by the
              card above rather than by a dead end. */}
          <ChatChannels />

          <p className="ds-overline" style={{ marginBottom: 8 }}>
            Delivery channel
          </p>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 10, lineHeight: 1.5 }}>
            In-app and push always arrive. On top of those you can pick{" "}
            <strong>one</strong> other channel — turning one on turns the others off.
          </p>
          <AccountCard style={{ padding: 0, marginBottom: 20, overflow: "hidden" }}>
            {CHANNELS.map((c, i) => {
              const verified = p[c.verifiedKey];
              const enabled = p[c.enabledKey];
              return (
                <div
                  key={c.enabledKey}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 11,
                    padding: 14,
                    borderBottom: i < CHANNELS.length - 1 ? "1px solid var(--border-subtle)" : "none",
                  }}
                >
                  <Icon name={c.icon} size={19} style={{ color: "var(--text-muted)" }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)" }}>
                      {c.label}
                    </div>
                    {!verified && (
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                        Connect this channel above before you can use it
                      </div>
                    )}
                  </div>
                  {/* An unverified channel is disabled rather than offered and
                      then rejected — the backend refuses it with
                      CUSTOMER_NOTIFICATION_CHANNEL_NOT_VERIFIED, and an enabled
                      channel that delivers nothing reads as us being broken. */}
                  <Toggle
                    label={c.label}
                    on={enabled}
                    disabled={!verified || saving}
                    onChange={(next) => save({ [c.enabledKey]: next })}
                  />
                </div>
              );
            })}
          </AccountCard>

          <p className="ds-overline" style={{ marginBottom: 8 }}>
            What you hear about
          </p>
          <AccountCard style={{ padding: 0, marginBottom: 20, overflow: "hidden" }}>
            {TOGGLES.map((row, i) => (
              <div
                key={row.key}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: 14,
                  borderBottom: i < TOGGLES.length - 1 ? "1px solid var(--border-subtle)" : "none",
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)" }}>
                    {row.label}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {row.desc}
                  </div>
                </div>
                <Toggle
                  label={row.label}
                  on={p.preferences[row.key]}
                  disabled={saving}
                  onChange={(next) => save({ preferences: { [row.key]: next } })}
                />
              </div>
            ))}
          </AccountCard>

          <p className="ds-overline" style={{ marginBottom: 8 }}>
            Always sent
          </p>
          <AccountCard style={{ padding: 0, overflow: "hidden" }}>
            {ALWAYS_ON.map((row, i) => (
              <div
                key={row.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 11,
                  padding: 14,
                  borderBottom: i < ALWAYS_ON.length - 1 ? "1px solid var(--border-subtle)" : "none",
                }}
              >
                <Icon name={row.icon} size={19} style={{ color: "var(--text-muted)" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)" }}>
                    {row.label}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {row.desc}
                  </div>
                </div>
                <Badge size="sm" tone="neutral" icon="lock">
                  Always on
                </Badge>
              </div>
            ))}
          </AccountCard>
        </>
      )}
    </ResourceView>
  );
}

function Toggle({
  label,
  on,
  disabled,
  onChange,
}: {
  label: string;
  on: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      onClick={() => !disabled && onChange(!on)}
      aria-pressed={on}
      aria-label={label}
      disabled={disabled}
      style={{
        width: 44,
        height: 26,
        borderRadius: 999,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        background: on ? "var(--brand)" : "var(--gray-300)",
        position: "relative",
        flexShrink: 0,
        transition: "background .15s",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 3,
          left: on ? 21 : 3,
          width: 20,
          height: 20,
          borderRadius: "50%",
          background: "#fff",
          transition: "left .15s",
          boxShadow: "var(--shadow-sm)",
        }}
      />
    </button>
  );
}
