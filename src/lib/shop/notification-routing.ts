/**
 * Where a notification goes when it is opened.
 *
 * One module for both doors into the same message: the **inbox** at
 * `/shop/account/notifications`, whose rows carry an action button, and a
 * **push** tapped on the lock screen.
 *
 * ── The payload is the backend's, not ours ───────────────────────────────────
 *
 * `CustomerNotificationEventHandler` builds one action per situation and sends
 * the same `path` down both channels — as `action.path` on the in-app record and
 * in the FCM data block. It is `button.urlSuffix` verbatim: **storefront-
 * relative, no leading slash, and no locale**, because `renderCustomerButton`
 * adds the locale once, per channel, on its way out.
 *
 * ── Two vintages, and the inbox holds both ───────────────────────────────────
 *
 * Until 2026-09-07 the catalogue wrote bare nouns — `orders/{{orderId}}`,
 * `bookings/{{bookingId}}`, `support/{{ticketId}}` — against a URL scheme the
 * storefront has never used, so all 22 buttons pointed at a 404 for as long as
 * they existed. That was fixed on the backend by writing the real routes into
 * the catalogue, and this file has to speak **both** dialects, because the inbox
 * is durable: rows written before that day still carry the old shapes and are
 * still tappable, and so are the emails and chat messages that went with them.
 *
 *     old (still in the inbox)        new (what the catalogue writes now)
 *     ────────────────────────        ────────────────────────────────────
 *     orders/<id>                     shop/account/orders/detail/<id>
 *     orders/<id>/tracking            shop/account/orders/detail/<id>/tracking
 *     bookings/<id>                   shop/account/bookings/<id>
 *     bookings/<id>/pay-balance       shop/account/bookings/<id>/balance
 *     support/<id>                    shop/account/support/<id>
 *     —                               pay/<token>
 *
 * Both resolve to the same screens, so an old message is no longer a dead end.
 *
 * ── Why this is not `router.push(action.path)` ───────────────────────────────
 *
 * Two reasons, and only the first is about the vintages above. The **app**
 * addresses four of these screens by query string — a static export has no
 * server to resolve a path segment against — so even a perfectly current path
 * has to be re-shaped per target. `shop.routes.ts` owns that decision; this file
 * only decides which of its functions to call.
 *
 * ── `orderId` is not `cartId` ────────────────────────────────────────────────
 *
 * The trap worth naming twice. A checkout writes one order **per vendor**, all
 * sharing a `cartId`, and `/shop/account/orders/:cartId` shows that whole group.
 * A notification names the **`orderId`**, because that is the aggregate the event
 * was about. This used to cost a round trip — fetch the order, read its `cartId`,
 * open the group — and land the reader on a list containing their parcel rather
 * than on the parcel. The single-order page removed both the lookup and the
 * compromise.
 */
import {
  bookingBalancePath,
  bookingPath,
  orderGroupPath,
  orderPath,
  orderTrackingPath,
  payPath,
  SHOP_ROOT,
  ticketPath,
} from "./shop.routes";

/** Where a notification with nothing routable goes. */
const NOTIFICATIONS = `${SHOP_ROOT}/account/notifications`;

/**
 * The tails this resolver understands, most specific first.
 *
 * ⚠ **Order matters and the tracking entries must precede their bare forms**,
 * since `orders/<id>` is a prefix of `orders/<id>/tracking` — matched the other
 * way round, every "Track delivery" button would open the order instead. The
 * `$` anchors would catch it, but only for as long as nobody relaxes one.
 *
 * `[^/?#]+` rather than `.+` for a captured id: a path arriving with a query
 * string or a fragment attached — a chat client's click tracking, a pasted URL —
 * must not fold that into the id.
 */
const ROUTES: { pattern: RegExp; to: (id: string) => string }[] = [
  // ── Current: full storefront paths, written by the catalogue since 2026-09-07
  { pattern: /^shop\/account\/orders\/detail\/([^/?#]+)\/tracking$/, to: orderTrackingPath },
  { pattern: /^shop\/account\/orders\/detail\/([^/?#]+)$/, to: orderPath },
  { pattern: /^shop\/account\/orders\/([^/?#]+)$/, to: orderGroupPath },
  { pattern: /^shop\/account\/bookings\/([^/?#]+)\/balance$/, to: bookingBalancePath },
  { pattern: /^shop\/account\/bookings\/([^/?#]+)$/, to: bookingPath },
  { pattern: /^shop\/account\/support\/([^/?#]+)$/, to: ticketPath },
  { pattern: /^pay\/([^/?#]+)$/, to: payPath },

  // ── Legacy: bare nouns, still sitting in inboxes written before that date
  { pattern: /^orders\/([^/?#]+)\/tracking$/, to: orderTrackingPath },
  { pattern: /^orders\/([^/?#]+)$/, to: orderPath },
  { pattern: /^bookings\/([^/?#]+)\/pay-balance$/, to: bookingBalancePath },
  { pattern: /^bookings\/([^/?#]+)$/, to: bookingPath },
  { pattern: /^support\/([^/?#]+)$/, to: ticketPath },
];

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
export function resolveNotificationDestination(
  actionPath: string | undefined,
  aggregate?: { type?: string; id?: string },
): string {
  /*
   * Tolerate a leading slash and a trailing one.
   *
   * The contract says neither is sent — `urlSuffix` carries no leading slash so
   * that WhatsApp's `{STOREFRONT_URL}/{{1}}` template does not produce a double
   * one — but this is a hand-maintained string in another repository, and a
   * resolver that 404s over a stray character is not worth the strictness.
   */
  const path = (actionPath ?? "").trim().replace(/^\/+/, "").replace(/\/+$/, "");

  for (const { pattern, to } of ROUTES) {
    const match = pattern.exec(path);
    if (match) return to(match[1]);
  }

  /*
   * No `path` at all: some situations carry none, and `resolveAction` returns
   * null outright when `STOREFRONT_URL` is unset on the backend — which is a
   * real deployment state, not a fault. `aggregateType` still says what the
   * message was about, which is enough to do better than the inbox.
   *
   * ⚠ `aggregate.type === "order"` carries an **order** id, so it goes to the
   * single-order page. It is the same id the `order.*` situations put in their
   * button, and pointing it at the group screen is the mistake this file's
   * header warns about.
   */
  if (!path && aggregate?.id) {
    if (aggregate.type === "order") return orderPath(aggregate.id);
    if (aggregate.type === "booking") return bookingPath(aggregate.id);
  }

  return NOTIFICATIONS;
}

/**
 * The same resolution, from an FCM data block.
 *
 * `deliverPush` sends `type`, `aggregateType`, `aggregateId`, `path` and `url`,
 * all as strings. Only the middle three matter here — `url` is the absolute form
 * built when `STOREFRONT_URL` is set, and an absolute web URL is the one thing a
 * tap inside the app must not follow.
 */
export function resolvePushDestination(data: Record<string, string>): string {
  return resolveNotificationDestination(data.path, {
    type: data.aggregateType,
    id: data.aggregateId,
  });
}
