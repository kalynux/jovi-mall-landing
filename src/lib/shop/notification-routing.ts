/**
 * Where a notification goes when it is opened.
 *
 * One module for both doors into the same message: the **inbox** at
 * `/shop/account/notifications`, whose rows carry an action button, and a
 * **push** tapped on the lock screen. They were separate, and the inbox's half
 * was one line long and wrong:
 *
 *     href={`/shop/${n.action.path}`}      // → /shop/orders/<orderId>
 *
 * There is no such route in either build. On the web that is a 404; in the app
 * Capacitor's local server maps the extension-less path to the bootstrap, which
 * re-points it at `<path>/index.html`, and the WebView shows "Webpage not
 * available". Same tap, same dead end, two different-looking failures.
 *
 * ── The payload is the backend's, not ours ───────────────────────────────────
 *
 * `CustomerNotificationEventHandler` builds one action per situation and sends
 * the same `path` down both channels — as `action.path` on the in-app record
 * and in the FCM data block. The customer catalogue produces four shapes, and
 * only these four:
 *
 *     orders/{orderId}            orders/{orderId}/tracking
 *     bookings/{bookingId}        bookings/{bookingId}/pay-balance
 *
 * They are storefront-relative and were written against a URL scheme the
 * storefront does not use — `/shop/account/...` is where all four live, and the
 * app addresses two of them by query string. Hence this mapping rather than a
 * `router.push(action.path)`.
 *
 * ── `orderId` is not `cartId` ────────────────────────────────────────────────
 *
 * The trap worth naming. A checkout writes one order **per vendor**, all sharing
 * a `cartId`, and the shopper is shown that group as one thing — so the detail
 * screen is keyed by `cartId`. The notification names the `orderId`, because
 * that is the aggregate the event was about. Pointing `orders/<orderId>` at the
 * order-group route would open nothing at all.
 *
 * So an order deep-link costs one lookup: fetch the order, read its `cartId`,
 * then route. When that lookup fails — offline, deleted, a 404 — the shopper
 * lands on their order list rather than on an error, because arriving somewhere
 * useful is worth more than arriving somewhere exact.
 */
import { getOrder } from "./orders.api";
import { bookingBalancePath, bookingPath, orderGroupPath, SHOP_ROOT } from "./shop.routes";

/** Where a notification with nothing routable goes. */
const NOTIFICATIONS = `${SHOP_ROOT}/account/notifications`;
const ORDER_LIST = `${SHOP_ROOT}/account/orders`;

/** Matches both `orders/<id>` and `orders/<id>/tracking`. */
const ORDER = /^orders\/([^/?#]+)/;
/** `bookings/<id>` and `bookings/<id>/pay-balance`, capturing the tail. */
const BOOKING = /^bookings\/([^/?#]+)(?:\/([^/?#]+))?/;

/**
 * Resolve a notification's `action.path` to a path inside the current build.
 *
 * Never throws and never returns null: an opened notification must always land
 * somewhere, and the inbox is the honest fallback for a shape nobody here
 * recognises — it is where the message itself is waiting.
 *
 * The result is locale-agnostic, as authored; push it through
 * `@/i18n/navigation`'s router or `Link`, which add the prefix.
 */
export async function resolveNotificationDestination(
  actionPath: string | undefined,
  aggregate?: { type?: string; id?: string },
): Promise<string> {
  const path = (actionPath ?? "").replace(/^\/+/, "");

  // Tracking is shown inside the group screen rather than on a route of its
  // own, so `orders/<id>/tracking` needs no branch beyond this one.
  const order = ORDER.exec(path);
  if (order) return orderGroupPathFor(order[1]);

  const booking = BOOKING.exec(path);
  if (booking) {
    return booking[2] === "pay-balance"
      ? bookingBalancePath(booking[1])
      : bookingPath(booking[1]);
  }

  // No `path` at all: some situations carry none. `aggregateType` still says
  // what the message was about, which is enough to do better than the inbox.
  if (!path && aggregate?.id) {
    if (aggregate.type === "order") return orderGroupPathFor(aggregate.id);
    if (aggregate.type === "booking") return bookingPath(aggregate.id);
  }

  return NOTIFICATIONS;
}

/**
 * The same resolution, from an FCM data block.
 *
 * `deliverPush` sends `type`, `aggregateType`, `aggregateId`, `path` and `url`,
 * all as strings. Only the first four matter here — `url` is the absolute form
 * built when `STOREFRONT_URL` is set, and an absolute web URL is the one thing
 * a tap inside the app must not follow.
 */
export function resolvePushDestination(data: Record<string, string>): Promise<string> {
  return resolveNotificationDestination(data.path, {
    type: data.aggregateType,
    id: data.aggregateId,
  });
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
