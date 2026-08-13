"use client";

import { useCallback, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  AccountCard,
  AccountShell,
  ResourceView,
} from "@/components/shop/account/AccountShell";
import { Badge, Button, Chip, EmptyState, Icon, Tabs } from "@/components/shop/ds";
import { useNotifications, useToast } from "@/components/shop/providers";
import { translateError } from "@/lib/auth/error-translator";
import {
  getPreferences,
  listNotifications,
  markAllRead,
  markRead,
  updatePreferences,
} from "@/lib/shop/notifications.api";
import type { NotificationListMeta } from "@/lib/shop/notifications.api";
import { useApiResource } from "@/lib/shop/useApiResource";
import type {
  CustomerNotification,
  NotificationAggregate,
  NotificationPreferences,
  NotificationTogglePreferences,
} from "@/lib/shop/customer.types";

const FILTERS: { id: NotificationAggregate | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "order", label: "Orders" },
  { id: "shipment", label: "Delivery" },
  { id: "payment", label: "Payments" },
  { id: "booking", label: "Bookings" },
];

const AGGREGATE_ICON: Record<NotificationAggregate, string> = {
  order: "package",
  shipment: "truck",
  payment: "wallet",
  booking: "calendar-clock",
};

export default function NotificationsPage() {
  const [tab, setTab] = useState<"inbox" | "settings">("inbox");

  return (
    <AccountShell
      title="Notifications"
      description="Everything WiMall has told you about your orders, deliveries and payments."
    >
      <div style={{ marginBottom: 16 }}>
        <Tabs
          tabs={[
            { value: "inbox", label: "Inbox" },
            { value: "settings", label: "Settings" },
          ]}
          value={tab}
          onChange={(v) => setTab(v as "inbox" | "settings")}
        />
      </div>
      {tab === "inbox" ? <Inbox /> : <Preferences />}
    </AccountShell>
  );
}

// ─── Inbox ───────────────────────────────────────────────────────────────────

function Inbox() {
  const [filter, setFilter] = useState<NotificationAggregate | "all">("all");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const { flash, flashError } = useToast();
  const { refresh: refreshBadge, setUnread } = useNotifications();
  const t = useTranslations("errors");

  const inbox = useApiResource<{ data: CustomerNotification[]; meta: NotificationListMeta }>(
    () =>
      listNotifications({
        limit: 50,
        unreadOnly: unreadOnly || undefined,
        aggregateType: filter === "all" ? undefined : filter,
      }),
    [filter, unreadOnly],
  );

  const onMarkRead = useCallback(
    async (id: string) => {
      try {
        await markRead(id);
        inbox.reload();
        refreshBadge();
      } catch (err) {
        flashError(translateError(t, err, "We couldn't mark that as read."));
      }
    },
    [inbox, refreshBadge, flashError, t],
  );

  const onMarkAll = useCallback(async () => {
    setBusy(true);
    try {
      const updated = await markAllRead();
      // The server just told us nothing is unread; trust it rather than
      // spending another request to re-read a number we already know.
      setUnread(0);
      inbox.reload();
      flash(updated > 0 ? `${updated} marked as read` : "Nothing left to read");
    } catch (err) {
      flashError(translateError(t, err, "We couldn't mark everything as read."));
    } finally {
      setBusy(false);
    }
  }, [inbox, setUnread, flash, flashError, t]);

  const unreadCount = inbox.data?.meta.unreadCount ?? 0;

  return (
    <>
      <div className="row-chips" style={{ marginBottom: 10 }}>
        {FILTERS.map((f) => (
          <Chip key={f.id} selected={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Chip
          size="sm"
          selected={unreadOnly}
          icon="mail"
          onClick={() => setUnreadOnly((v) => !v)}
        >
          Unread only
        </Chip>
        <div style={{ flex: 1 }} />
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon="check-check"
            disabled={busy}
            onClick={onMarkAll}
          >
            Mark all read
          </Button>
        )}
      </div>

      <ResourceView
        status={inbox.status}
        error={inbox.error}
        data={inbox.data}
        onRetry={inbox.reload}
        errorFallback="We couldn't load your notifications."
      >
        {({ data }) =>
          data.length === 0 ? (
            <EmptyState
              icon="bell"
              title={unreadOnly ? "Nothing unread" : "No notifications yet"}
              description={
                unreadOnly
                  ? "You're all caught up."
                  : "Order updates, delivery progress and payment receipts will appear here."
              }
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.map((n) => (
                <NotificationRow key={n._id} notification={n} onRead={() => onMarkRead(n._id)} />
              ))}
            </div>
          )
        }
      </ResourceView>
    </>
  );
}

function NotificationRow({
  notification: n,
  onRead,
}: {
  notification: CustomerNotification;
  onRead: () => void;
}) {
  const format = useFormatter();
  const icon = AGGREGATE_ICON[n.aggregateType] ?? "bell";

  return (
    <AccountCard
      style={{
        // Unread rows carry a brand-tinted ground rather than only a dot, so the
        // distinction survives at a glance on a small screen.
        background: n.isRead ? "var(--surface)" : "var(--brand-subtle)",
        borderColor: n.isRead ? "var(--border)" : "var(--brand)",
      }}
    >
      <div style={{ display: "flex", gap: 11 }}>
        <Icon
          name={icon}
          size={19}
          style={{ color: n.isRead ? "var(--text-muted)" : "var(--brand)", marginTop: 2, flexShrink: 0 }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              style={{
                fontWeight: n.isRead ? 600 : 800,
                fontSize: 14,
                color: "var(--text-strong)",
                flex: 1,
              }}
            >
              {n.title}
            </span>
            <span className="muted" style={{ fontSize: 11.5, whiteSpace: "nowrap" }}>
              {format.relativeTime(new Date(n.createdAt))}
            </span>
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>
            {n.message}
          </p>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
            {/* `action.path` is relative to the storefront; `action.url` is the
                absolute form the backend builds only when STOREFRONT_URL is set.
                The relative one is what belongs in an in-app link. */}
            {n.action?.path && (
              <Link
                href={`/shop/${n.action.path.replace(/^\/+/, "")}`}
                style={{
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "var(--brand-hover)",
                  textDecoration: "none",
                }}
              >
                {n.action.label} →
              </Link>
            )}
            <div style={{ flex: 1 }} />
            {!n.isRead && (
              <Button variant="ghost" size="sm" leadingIcon="check" onClick={onRead}>
                Mark read
              </Button>
            )}
          </div>
        </div>
      </div>
    </AccountCard>
  );
}

// ─── Preferences ─────────────────────────────────────────────────────────────

/**
 * The two groups that always send and cannot be switched off. A customer is the
 * counterparty to someone else's action here, not the owner of a dashboard: a
 * silent refund is indistinguishable from a stolen payment, and a balance nobody
 * was told about cannot fairly be chased.
 */
const ALWAYS_ON = [
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
  icon: string;
}[] = [
  { enabledKey: "emailEnabled", verifiedKey: "emailVerified", label: "Email", icon: "mail" },
  { enabledKey: "telegramEnabled", verifiedKey: "telegramVerified", label: "Telegram", icon: "send" },
  { enabledKey: "whatsappEnabled", verifiedKey: "whatsappVerified", label: "WhatsApp", icon: "message-circle" },
];

function Preferences() {
  const prefs = useApiResource<NotificationPreferences>(() => getPreferences());
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
          <p className="overline" style={{ marginBottom: 8 }}>
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
                        Verify this channel before you can use it
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

          <p className="overline" style={{ marginBottom: 8 }}>
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

          <p className="overline" style={{ marginBottom: 8 }}>
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
