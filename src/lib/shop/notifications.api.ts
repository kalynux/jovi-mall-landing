/**
 * Customer notification inbox and channel preferences —
 * `/api/customer/notifications`.
 *
 * Every notification always produces an in-app record; that is the durable one
 * and it is never configurable. Preferences gate progress reporting only — money
 * and cancellation notices always send.
 */
import { apiFetch, apiFetchList } from "@/lib/api/client";
import type { ListMeta } from "@/lib/api/client";
import type {
  CustomerNotification,
  NotificationAggregate,
  NotificationPreferences,
  UpdateNotificationPreferencesPayload,
} from "./customer.types";

export interface NotificationListQuery {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
  aggregateType?: NotificationAggregate;
}

/** The list response carries `unreadCount` alongside the usual pagination. */
export type NotificationListMeta = ListMeta & { unreadCount?: number };

/** GET /api/customer/notifications */
export async function listNotifications(
  query: NotificationListQuery = {},
): Promise<{ data: CustomerNotification[]; meta: NotificationListMeta }> {
  const params = new URLSearchParams();
  if (query.page) params.set("page", String(query.page));
  if (query.limit) params.set("limit", String(query.limit));
  if (query.unreadOnly) params.set("unreadOnly", "true");
  if (query.aggregateType) params.set("aggregateType", query.aggregateType);

  const qs = params.toString();
  return apiFetchList<CustomerNotification, { unreadCount?: number }>(
    `/api/customer/notifications${qs ? `?${qs}` : ""}`,
  );
}

/**
 * GET /api/customer/notifications/unread-count
 *
 * Use this for the badge rather than fetching a page of rows to render one
 * integer. Customers are rate-limited to 600 requests/min, so refresh it on
 * navigation and after a mutation — not on a tight poll.
 */
export async function getUnreadCount(): Promise<number> {
  const data = await apiFetch<{ unreadCount: number }>(
    "/api/customer/notifications/unread-count",
  );
  return data?.unreadCount ?? 0;
}

/** PATCH /api/customer/notifications/:id/read */
export async function markRead(id: string): Promise<CustomerNotification> {
  return apiFetch<CustomerNotification>(
    `/api/customer/notifications/${encodeURIComponent(id)}/read`,
    { method: "PATCH" },
  );
}

/** PATCH /api/customer/notifications/read-all */
export async function markAllRead(): Promise<number> {
  const data = await apiFetch<{ updated: number }>(
    "/api/customer/notifications/read-all",
    { method: "PATCH" },
  );
  return data?.updated ?? 0;
}

/** GET /api/customer/notifications/preferences — creates defaults on first read. */
export async function getPreferences(): Promise<NotificationPreferences> {
  return apiFetch<NotificationPreferences>(
    "/api/customer/notifications/preferences",
  );
}

/**
 * PATCH /api/customer/notifications/preferences
 *
 * Enabling an unverified channel is rejected with
 * `400 CUSTOMER_NOTIFICATION_CHANNEL_NOT_VERIFIED` rather than silently accepted,
 * and enabling one secondary channel disables the other two server-side — so
 * always re-render from the returned record, never from optimistic local state.
 */
export async function updatePreferences(
  payload: UpdateNotificationPreferencesPayload,
): Promise<NotificationPreferences> {
  return apiFetch<NotificationPreferences>(
    "/api/customer/notifications/preferences",
    { method: "PATCH", body: JSON.stringify(payload) },
  );
}
