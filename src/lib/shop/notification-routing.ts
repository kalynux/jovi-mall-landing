/**
 * Where a tapped push notification goes.
 *
 * Split out of `lib/native/push.ts` on purpose: this is a fact about the shop's
 * URLs rather than about the device, and keeping it here means it can be reasoned
 * about — and changed — without a phone in the loop.
 *
 * ── The payload is the backend's, not ours ───────────────────────────────────
 *
 * `FcmPushService` sends a data block of all-strings: `type`, `aggregateType`,
 * `aggregateId`, and an optional `path` built from the customer notification
 * catalogue. The only `path` shapes that catalogue produces today are:
 *
 *     orders/{orderId}            orders/{orderId}/tracking
 *     bookings/{bookingId}        bookings/{bookingId}/pay-balance
 *
 * They are storefront-relative and were written for the web, where
 * `/orders/:id` is a real page. The app is not the web and does not have those
 * routes, which is the whole reason this mapping exists rather than a
 * `router.push(data.path)`.
 *
 * ── `orderId` is not `cartId` ────────────────────────────────────────────────
 *
 * The trap worth naming. A checkout writes one order **per vendor**, all sharing
 * a `cartId`, and the shopper is shown that group as one thing — so the detail
 * screen is keyed by `cartId`. The notification names the `orderId`, because
 * that is the aggregate the event was about. Pushing `orders/<orderId>` at the
 * order-group route would open nothing at all.
 *
 * So an order deep-link costs one lookup: fetch the order, read its `cartId`,
 * then route. When that lookup fails — offline, deleted, a 404 — the shopper
 * lands on their order list rather than on an error, because arriving somewhere
 * useful is worth more than arriving somewhere exact.
 */
import { getOrder } from "./orders.api";
import { orderGroupPath, SHOP_ROOT } from "./shop.routes";

/** Where a notification with nothing routable goes. */
const NOTIFICATIONS = `${SHOP_ROOT}/account/notifications`;
const ORDER_LIST = `${SHOP_ROOT}/account/orders`;

/**
 * Resolve an FCM data block to a path inside the app.
 *
 * Never throws and never returns null: a tap must always land somewhere, and
 * the notification list is the honest fallback — it is where the same message
 * is waiting to be read.
 */
export async function resolvePushDestination(
  data: Record<string, string>,
): Promise<string> {
  const path = (data.path ?? "").replace(/^\/+/, "");

  // Matches both `orders/<id>` and `orders/<id>/tracking`; the app shows
  // tracking inside the group screen rather than on a route of its own.
  const order = /^orders\/([^/]+)/.exec(path);
  if (order) return orderGroupPathFor(order[1]);

  /**
   * Bookings have no screen in the app bundle — `/shop/account` offers orders,
   * addresses, payment methods, notifications and downloads, and nothing else.
   * Routing to a path the export never wrote is the dead-tap class the app
   * already paid for once, so these go to the inbox, where the message is.
   */
  if (/^bookings\//.test(path)) return NOTIFICATIONS;

  // No `path` at all: some situations carry none. `aggregateType` still says
  // what the message was about, which is enough to do better than the inbox.
  if (!path && data.aggregateType === "order" && data.aggregateId) {
    return orderGroupPathFor(data.aggregateId);
  }

  return NOTIFICATIONS;
}

/** One order id → the group screen that contains it. */
async function orderGroupPathFor(orderId: string): Promise<string> {
  try {
    const order = await getOrder(orderId);
    return order.cartId ? orderGroupPath(order.cartId) : ORDER_LIST;
  } catch {
    return ORDER_LIST;
  }
}
