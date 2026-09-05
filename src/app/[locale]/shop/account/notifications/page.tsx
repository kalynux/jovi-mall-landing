"use client";

import { useCallback, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  AccountCard,
  AccountShell,
  ResourceView,
} from "@/components/shop/account/AccountShell";
import { Button, Chip, EmptyState, Icon } from "@/components/shop/ds";
import { useNotifications, useToast } from "@/components/shop/providers";
import { translateError } from "@/lib/auth/error-translator";
import { listNotifications, markAllRead, markRead } from "@/lib/shop/notifications.api";
import { resolveNotificationDestination } from "@/lib/shop/notification-routing";
import type { NotificationListMeta } from "@/lib/shop/notifications.api";
import { useApiResource } from "@/lib/shop/useApiResource";
import type { CustomerNotification, NotificationAggregate } from "@/lib/shop/customer.types";

/**
 * The inbox, and only the inbox.
 *
 * The switches that used to be the second tab of this page are their own screen
 * now — `/shop/account/notifications/settings`, reached by the gear in the
 * header bar. A tab bar is for two views of the same subject that a person moves
 * between; this was a list and a settings form, and every visit to read a
 * delivery update began by stepping past the form.
 */

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
  return (
    <AccountShell title="Notifications" description="Orders, deliveries and payments.">
      <Inbox />
    </AccountShell>
  );
}

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
            {n.action?.path && <NotificationAction notification={n} />}
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

/**
 * The row's action — "View order", "View booking", "Track delivery".
 *
 * ── Why a button and not a link ──────────────────────────────────────────────
 *
 * The destination is not knowable at render time. An order notification names
 * the `orderId` and the group screen is keyed by `cartId`, so an `href` written
 * straight from `action.path` is either wrong — which is what it was, and how
 * every one of these taps ended on "Webpage not available" in the app and a 404
 * on the web — or the result of one API call per row before the list can paint.
 *
 * Resolving on the tap costs that lookup once, for the one notification the
 * shopper actually opened. Nothing is lost by dropping the anchor: this screen
 * is owner-scoped and `noindex`, so there is no URL here worth copying,
 * crawling or opening in a second tab.
 *
 * `resolveNotificationDestination` never throws and always answers, so a failed
 * lookup lands on the order list rather than leaving the button spinning.
 */
function NotificationAction({ notification: n }: { notification: CustomerNotification }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const open = useCallback(async () => {
    setBusy(true);
    const target = await resolveNotificationDestination(n.action?.path, {
      type: n.aggregateType,
      id: n.aggregateId,
    });
    router.push(target);
    setBusy(false);
  }, [router, n.action?.path, n.aggregateType, n.aggregateId]);

  return (
    <button
      type="button"
      disabled={busy}
      aria-busy={busy}
      onClick={() => void open()}
      style={{
        appearance: "none",
        border: "none",
        background: "none",
        padding: 0,
        font: "inherit",
        fontSize: 12.5,
        fontWeight: 700,
        color: "var(--brand-hover)",
        cursor: busy ? "progress" : "pointer",
        opacity: busy ? 0.6 : 1,
      }}
    >
      {n.action?.label} →
    </button>
  );
}
