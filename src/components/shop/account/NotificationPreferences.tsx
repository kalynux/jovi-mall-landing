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
 *
 * That is a promise the copy has to keep in five languages: these rows carry no
 * switch, wear the locked "always on" badge and sit under their own heading, and
 * every catalogue says *permanently on* rather than *on by default*. Someone who
 * believes they muted a payment alert and then misses one has been misled.
 *
 * All three tables below are module-level constants, so they name keys rather
 * than sentences — there is no render here to resolve one in. LOCALISATION.md §3.
 */
const ALWAYS_ON: { icon: IconName; labelKey: string; descKey: string }[] = [
  {
    icon: "wallet",
    labelKey: "shop.notifications.alwaysOn.payments",
    descKey: "shop.notifications.alwaysOn.paymentsDesc",
  },
  {
    icon: "circle-x",
    labelKey: "shop.notifications.alwaysOn.cancellations",
    descKey: "shop.notifications.alwaysOn.cancellationsDesc",
  },
];

const TOGGLES: {
  key: keyof NotificationTogglePreferences;
  labelKey: string;
  descKey: string;
}[] = [
  {
    key: "orderUpdates",
    labelKey: "shop.notifications.topics.orderUpdates",
    descKey: "shop.notifications.topics.orderUpdatesDesc",
  },
  {
    key: "bookingUpdates",
    labelKey: "shop.notifications.topics.bookingUpdates",
    descKey: "shop.notifications.topics.bookingUpdatesDesc",
  },
  {
    key: "bookingReminders",
    labelKey: "shop.notifications.topics.bookingReminders",
    descKey: "shop.notifications.topics.bookingRemindersDesc",
  },
  {
    key: "marketing",
    labelKey: "shop.notifications.topics.marketing",
    descKey: "shop.notifications.topics.marketingDesc",
  },
];

/**
 * The channel names come from `shop.channels`, shared with the connect card
 * above rather than duplicated: the row a shopper switches on and the row they
 * connected it from must call the channel the same thing.
 */
const CHANNELS: {
  enabledKey: "emailEnabled" | "telegramEnabled" | "whatsappEnabled";
  verifiedKey: "emailVerified" | "telegramVerified" | "whatsappVerified";
  labelKey: string;
  icon: IconName;
}[] = [
  {
    enabledKey: "emailEnabled",
    verifiedKey: "emailVerified",
    labelKey: "shop.channels.names.email",
    icon: "mail",
  },
  {
    enabledKey: "telegramEnabled",
    verifiedKey: "telegramVerified",
    labelKey: "shop.channels.names.telegram",
    icon: "send",
  },
  {
    enabledKey: "whatsappEnabled",
    verifiedKey: "whatsappVerified",
    labelKey: "shop.channels.names.whatsapp",
    icon: "message-circle",
  },
];

export function NotificationPreferences() {
  const prefs = useApiResource<Preferences>(() => getPreferences());
  const [saving, setSaving] = useState(false);
  const { flash, flashError } = useToast();
  const t = useTranslations("shop.notifications.prefs");
  const tErrors = useTranslations("errors");
  const tKey = useTranslations();

  const save = useCallback(
    async (payload: Parameters<typeof updatePreferences>[0]) => {
      setSaving(true);
      try {
        // Always re-render from the response: enabling one secondary channel
        // disables the other two server-side, so optimistic local state would
        // show two channels on until the next reload.
        prefs.set(await updatePreferences(payload));
        flash(t("saved"));
      } catch (err) {
        flashError(translateError(tErrors, err, t("saveFailed")));
      } finally {
        setSaving(false);
      }
    },
    [prefs, flash, flashError, t, tErrors],
  );

  return (
    <ResourceView
      status={prefs.status}
      error={prefs.error}
      data={prefs.data}
      onRetry={prefs.reload}
      errorFallback={t("loadFailed")}
    >
      {(p) => (
        <>
          {/* Connect first, enable second. `whatsappVerified` /
              `telegramVerified` below simply mirror whether a connection
              exists, so a switch that cannot be turned on is explained by the
              card above rather than by a dead end. */}
          <ChatChannels />

          <p className="ds-overline" style={{ marginBottom: 8 }}>
            {t("deliveryHeading")}
          </p>
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 10, lineHeight: 1.5 }}>
            {/* One message with the emphasis inside it: "one" lands on a
                different word in every language, so it cannot be a JSX child
                spliced between two halves of an English sentence. §4. */}
            {t.rich("deliveryIntro", {
              strong: (chunks) => <strong>{chunks}</strong>,
            })}
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
                      {tKey(c.labelKey)}
                    </div>
                    {!verified && (
                      <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                        {t("connectFirst")}
                      </div>
                    )}
                  </div>
                  {/* An unverified channel is disabled rather than offered and
                      then rejected — the backend refuses it with
                      CUSTOMER_NOTIFICATION_CHANNEL_NOT_VERIFIED, and an enabled
                      channel that delivers nothing reads as us being broken. */}
                  <Toggle
                    label={tKey(c.labelKey)}
                    on={enabled}
                    disabled={!verified || saving}
                    onChange={(next) => save({ [c.enabledKey]: next })}
                  />
                </div>
              );
            })}
          </AccountCard>

          <p className="ds-overline" style={{ marginBottom: 8 }}>
            {t("topicsHeading")}
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
                    {tKey(row.labelKey)}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {tKey(row.descKey)}
                  </div>
                </div>
                <Toggle
                  label={tKey(row.labelKey)}
                  on={p.preferences[row.key]}
                  disabled={saving}
                  onChange={(next) => save({ preferences: { [row.key]: next } })}
                />
              </div>
            ))}
          </AccountCard>

          <p className="ds-overline" style={{ marginBottom: 8 }}>
            {t("alwaysHeading")}
          </p>
          <AccountCard style={{ padding: 0, overflow: "hidden" }}>
            {ALWAYS_ON.map((row, i) => (
              <div
                key={row.labelKey}
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
                    {tKey(row.labelKey)}
                  </div>
                  <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                    {tKey(row.descKey)}
                  </div>
                </div>
                <Badge size="sm" tone="neutral" icon="lock">
                  {t("alwaysOnBadge")}
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
