"use client";

import { useCallback, useState } from "react";
import { useFormatter, useLocale, useNow, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { isLocale, localeDir } from "@/i18n/routing";
import {
  AccountCard,
  AccountShell,
  ResourceView,
} from "@/components/shop/account/AccountShell";
import { Button, Chip, EmptyState, Icon, type IconName } from "@/components/shop/ds";
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
 *
 * The rows themselves are not translated here. A notification's title, body and
 * action label are written by the backend and arrive already in the customer's
 * language; this screen owns only the chrome around them.
 */

/**
 * Module scope, so these carry KEYS rather than sentences — LOCALISATION.md §3.
 * Five of the six are the shared vocabulary in `shop.common`; only "Support" has
 * no entry there, so it lives in this screen's own namespace.
 */
const FILTERS: { id: NotificationAggregate | "all"; labelKey: string }[] = [
  { id: "all", labelKey: "shop.common.all" },
  { id: "order", labelKey: "shop.common.orders" },
  { id: "shipment", labelKey: "shop.common.delivery" },
  { id: "payment", labelKey: "shop.common.payments" },
  { id: "booking", labelKey: "shop.common.bookings" },
  { id: "ticket", labelKey: "shop.notifications.filterSupport" },
];

const AGGREGATE_ICON: Record<NotificationAggregate, IconName> = {
  order: "package",
  shipment: "truck",
  payment: "wallet",
  booking: "calendar-clock",
  ticket: "life-buoy",
};

export default function NotificationsPage() {
  const t = useTranslations("shop.notifications");
  // The header bar already resolves this screen's title from the route; passing
  // the same key keeps the shell's heading in step with it instead of
  // overriding it. See `shop.pages.ts`.
  const tKey = useTranslations();

  return (
    <AccountShell title={tKey("shop.nav.titles.notifications")} description={t("description")}>
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
  const t = useTranslations("shop.notifications");
  const tErrors = useTranslations("errors");
  const tKey = useTranslations();

  /**
   * One reference instant for the whole list, re-read once a minute.
   *
   * `format.relativeTime(date)` with no `now` logs an ENVIRONMENT_FALLBACK and
   * reads the clock afresh on every call, so each row was measured against a
   * slightly different present. Holding it here also means "2 minutes ago" ages
   * while the inbox stays open rather than freezing at first paint.
   */
  const now = useNow({ updateInterval: 60_000 });

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
        flashError(translateError(tErrors, err, t("markReadFailed")));
      }
    },
    [inbox, refreshBadge, flashError, t, tErrors],
  );

  const onMarkAll = useCallback(async () => {
    setBusy(true);
    try {
      const updated = await markAllRead();
      // The server just told us nothing is unread; trust it rather than
      // spending another request to re-read a number we already know.
      setUnread(0);
      inbox.reload();
      // One ICU message rather than a count glued to a sentence: the `=0` branch
      // carries the "nothing to do" wording and the plural forms carry the rest.
      flash(t("markedAllRead", { n: updated }));
    } catch (err) {
      flashError(translateError(tErrors, err, t("markAllReadFailed")));
    } finally {
      setBusy(false);
    }
  }, [inbox, setUnread, flash, flashError, t, tErrors]);

  const unreadCount = inbox.data?.meta.unreadCount ?? 0;

  return (
    <>
      <div className="row-chips" style={{ marginBottom: 10 }}>
        {FILTERS.map((f) => (
          <Chip key={f.id} selected={filter === f.id} onClick={() => setFilter(f.id)}>
            {tKey(f.labelKey)}
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
          {t("unreadOnly")}
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
            {t("markAllRead")}
          </Button>
        )}
      </div>

      <ResourceView
        status={inbox.status}
        error={inbox.error}
        data={inbox.data}
        onRetry={inbox.reload}
        errorFallback={t("loadFailed")}
      >
        {({ data }) =>
          data.length === 0 ? (
            <EmptyState
              icon="bell"
              title={unreadOnly ? t("emptyUnreadTitle") : t("emptyTitle")}
              description={
                unreadOnly ? t("emptyUnreadDescription") : t("emptyDescription")
              }
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {data.map((n) => (
                <NotificationRow
                  key={n._id}
                  notification={n}
                  now={now}
                  onRead={() => onMarkRead(n._id)}
                />
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
  now,
  onRead,
}: {
  notification: CustomerNotification;
  /** The list's shared reference instant — see `useNow` in `Inbox`. */
  now: Date;
  onRead: () => void;
}) {
  const format = useFormatter();
  const t = useTranslations("shop.notifications");
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
              {format.relativeTime(new Date(n.createdAt), now)}
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
                {t("markRead")}
              </Button>
            )}
          </div>
        </div>
      </div>
    </AccountCard>
  );
}

/**
 * The row's action — "View order", "Track delivery", "Pay balance".
 *
 * ── It is a link again ───────────────────────────────────────────────────────
 *
 * This was a button with a busy state, because the destination was not knowable
 * at render time: an order notification names the `orderId`, the only order
 * screen was the group screen keyed by `cartId`, and bridging the two cost an
 * API call per row. So the lookup was deferred to the tap.
 *
 * The single-order page removed the lookup — `resolveNotificationDestination` is
 * now pure string work — and with it the reason not to render an anchor. What
 * comes back is middle-click, long-press and "copy link", none of which a button
 * can offer, and the spinner that could never be seen anyway is gone.
 *
 * It never throws and always answers: an unrecognised `path` lands on the inbox,
 * which is where the message itself is waiting.
 *
 * The label is the backend's — it arrives already worded in the customer's
 * language, so there is nothing here to translate. The arrow beside it is not a
 * glyph but a direction: U+2192 is bidi-neutral and is *not* mirrored inside an
 * RTL paragraph, so /ar has to be handed the other one.
 */
function NotificationAction({ notification: n }: { notification: CustomerNotification }) {
  const locale = useLocale();
  const href = resolveNotificationDestination(n.action?.path, {
    type: n.aggregateType,
    id: n.aggregateId,
  });

  const arrow = isLocale(locale) && localeDir(locale) === "rtl" ? "←" : "→";

  return (
    <Link
      href={href}
      style={{
        fontSize: 12.5,
        fontWeight: 700,
        color: "var(--brand-hover)",
      }}
    >
      {n.action?.label} {arrow}
    </Link>
  );
}
