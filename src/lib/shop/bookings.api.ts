/**
 * Booking a service — `/api/products/:id/{availability,slots,book}`,
 * `/api/bookings/:id/*` and `/api/customer/bookings/*`.
 *
 * ── The flow, and why the lock step is not optional ──────────────────────────
 *
 * ```
 * 1. GET  /api/products/:productId/availability          list bookable slots  (public)
 * 2. POST /api/products/:productId/slots/:slotId/lock    hold it 15 minutes   (auth)
 * 3. POST /api/products/:productId/book                  create the booking   (auth)
 * 4. POST /api/bookings/:id/pay                          pay                  (auth)
 * ```
 *
 * A slot **must be locked by the same user** before it can be booked — the user
 * id is the lock owner, and booking without one is `409 BOOKING_SLOT_NOT_LOCKED`.
 * Creating the booking releases the lock; abandoning the flow should call
 * `unlock`, though a lock also expires on its own after 15 minutes.
 *
 * ⚠ **Times are in the vendor's timezone, computed server-side.** A rule reading
 * "Monday 09:00–17:00" means those hours *where the vendor is*, not where the
 * server or the shopper is. Everything on the wire is ISO-8601 UTC; convert only
 * for display.
 *
 * ⚠ **Money is whole francs** — `5000` is 5 000 XAF, the unit the vendor typed.
 * XAF has no cents, so never divide by 100. (bookings.md said "50.00 XAF" until
 * 2026-10-26; the backend corrected the doc, not the data.)
 *
 * See api-doc/customer/bookings.md.
 */
import { apiFetch, apiFetchList } from "@/lib/api/client";
import type { FileDetail, ListMeta } from "./shop.types";
import type { ChargeRequest, InitiatePaymentResponse } from "./payments.api";
import type { CustomerProtection } from "./protection";
import type { CustomerRefund } from "./refund";

/**
 * One bookable interval.
 *
 * `id` is **opaque**: `slot_{startMs}_{endMs}_{hash}`. Pass it verbatim to lock
 * and book — never construct or mutate one, because the hash is what the server
 * verifies.
 */
export interface Slot {
  id: string;
  start: string;
  end: string;
  /**
   * Bookable right now. Always `true` for calendar/manual products; for a
   * capacity product it is `false` once the seats are gone, and such slots are
   * still returned so the UI can render "Full" rather than silently dropping
   * them.
   */
  available: boolean;
  /** **Capacity products only.** Total seats per slot. */
  maxBookings?: number;
  /** **Capacity products only.** `0` when full — the source of "N spots left". */
  spotsRemaining?: number;
}

export type BookingStatus = "pending" | "confirmed" | "completed" | "no-show" | "cancelled";

/**
 * 🔴 `refund_pending` is **not** `refunded`.
 *
 * Since 2026-10-05 it means a refund request is waiting for the team — usually
 * because no paying number is on record to send a transfer to. **The customer
 * does not have their money yet**, and a UI that renders the two the same way
 * tells them they have been repaid when they have not. The booking's `refund`
 * block carries the detail.
 */
export type BookingPaymentStatus =
  | "unpaid"
  | "pending"
  | "paid"
  | "disputed"
  | "failed"
  | "refund_pending"
  | "refunded";

export interface Booking {
  /**
   * 🔴 **`id`, not `_id`.** `Booking` is built on the backend's
   * `BaseSchemaOptions`, whose `toJSON` deletes `_id` and exposes the `id`
   * virtual, and every customer booking route returns the mongoose document
   * straight (no `.lean()`). So `_id` is absent from **every** booking read.
   *
   * This was typed as `_id` and read as `_id` at three call sites, each of
   * which navigated to `/shop/account/bookings/undefined` — including the
   * redirect a customer lands on immediately after paying.
   */
  id: string;
  /**
   * The human handle — `BKG-2026-000123`, the same shape as an order's
   * `ORD-2026-000123`. Generated at creation and never editable; this is the
   * string to show the customer and to quote to the vendor or to support.
   *
   * ⚠ **`null` on bookings created before the field existed** — show a fallback
   * rather than a bare `#`. And it is **not a count**: a booking that fails
   * after the number is drawn burns it, so `BKG-2026-000042` does not mean "the
   * 42nd booking of 2026". Requests still take `id`.
   */
  bookingNumber: string | null;
  productId: string;
  userId: string;
  vendorId: string;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  paymentStatus: BookingPaymentStatus;
  /** Whole francs. */
  priceSnapshot: number;
  currency: string;
  requiresPayment: boolean;
  externalCalendarEventId?: string | null;
  metadata?: Record<string, unknown>;
  /**
   * The latest refund request (2026-10-05) — on the list, the single read and
   * the cancel response — or `null`. `waiting_for_cash` never applies to a
   * booking. Optional only for an API older than the field. See
   * `lib/shop/refund.ts`.
   */
  refund?: CustomerRefund | null;
  /**
   * Wi-Mall Protection (2026-10-10) — on the list, the single read, the cancel
   * and the reschedule. A booking's window opens when the seller marks the
   * service completed; one completed before that date may read `not_started`
   * with no dates. It replaces the raw `earningsPause` object these reads used
   * to carry, which is no longer sent. See `lib/shop/protection.ts`.
   */
  protection?: CustomerProtection;
  /**
   * The service, on the list, the single read and the cancel (2026-10-26).
   *
   * Until then the API populated `productId` in place and these keys never
   * arrived — every booking screen said "Service". `null` when the product no
   * longer exists, and optional for an API older than the fix. `images` is the
   * live gallery (at most six), `image` its first entry.
   */
  product?: {
    id: string;
    title: string;
    slug?: string | null;
    type?: string | null;
    image?: FileDetail | null;
    images?: FileDetail[];
  } | null;
  /** The store's business name, the profile's display name failing it. */
  vendor?: { id: string; name: string } | null;
  /** For the storefront link, with `product.slug`. `null` when the vendor has no store. */
  store?: { name: string; slug: string | null } | null;
  /**
   * Where it happens (2026-10-26). `null` on bookings made before the field,
   * optional for an API older than it.
   */
  location?: BookingLocation | null;
  /**
   * The meeting link and the vendor's instructions (2026-10-26). `null` when
   * the vendor set neither.
   */
  access?: BookingAccess | null;
  /** A new time waiting for an answer, or the last one's outcome (2026-10-26). */
  rescheduleProposal?: RescheduleProposal | null;
}

/**
 * `vendor_address` — the customer goes to the shop · `customer_address` — the
 * vendor comes to the address the customer chose · `online`.
 */
export type ServiceLocationKind = "vendor_address" | "customer_address" | "online";

/**
 * ⚠ **A `vendor_address` booking carries no address lines until the vendor
 * accepts it** — `addressVisible: false` while it is `pending`. The customer's
 * own address (`customer_address`) is always visible.
 */
export interface BookingLocation {
  kind: ServiceLocationKind;
  addressVisible: boolean;
  label?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  formattedAddress?: string | null;
  /** GeoJSON order: `[longitude, latitude]`. */
  coordinates?: [number, number] | null;
}

export type BookingAccessReason = "not_confirmed" | "not_paid" | "too_early" | "ended";

/**
 * 🔴 **`meetingUrl` and `instructions` exist only on an `open` block.** While
 * locked the server does not send them at all, so nothing may read them from a
 * locked one — `hasMeetingUrl` / `hasInstructions` say what is coming.
 *
 * Nothing is pushed at `opensAt`: the server decides on each read, so a screen
 * that waits for it re-reads the booking when the countdown ends.
 */
export interface BookingAccess {
  state: "locked" | "open" | "closed";
  reason?: BookingAccessReason | null;
  opensAt?: string | null;
  closesAt?: string | null;
  hasMeetingUrl: boolean;
  hasInstructions: boolean;
  meetingUrl?: string | null;
  instructions?: string | null;
}

/**
 * A move one side asked for and the other must answer.
 *
 * `proposedBy: "vendor"` — the vendor's move, which the customer accepts or
 * declines. `proposedBy: "customer"` — the customer's own move on a `manual`
 * service, which the vendor answers; the customer may withdraw it.
 *
 * ⚠ While it is `open` the booking keeps its ORIGINAL `startAt`/`endAt`. The
 * new time is only `startAt`/`endAt` here. With no answer by `expiresAt` it
 * lapses and the original time stands.
 */
export interface RescheduleProposal {
  status: "open" | "accepted" | "declined" | "withdrawn" | "lapsed";
  proposedBy: "vendor" | "customer";
  startAt: string;
  endAt: string;
  previousStartAt: string;
  previousEndAt?: string | null;
  proposedAt?: string | null;
  expiresAt: string;
  answeredAt?: string | null;
}

/** An open proposal, or `null`. */
export function openProposal(b: Booking): RescheduleProposal | null {
  return b.rescheduleProposal?.status === "open" ? b.rescheduleProposal : null;
}

/**
 * 🔴 **`productId` / `vendorId` as id strings, whatever the API sent.**
 *
 * Before 2026-10-26 the customer reads populated both in place, so `productId`
 * arrived as `{ id, title, type }`. The reschedule page built its availability
 * URL from it — `/api/products/[object Object]/availability` — the 404 was
 * swallowed, and every customer was told there was no time available. The
 * fixed API sends strings, but the deployed one may not yet, so every booking
 * read goes through here.
 */
function idOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const v = value as { id?: unknown; _id?: unknown };
    if (typeof v.id === "string") return v.id;
    if (typeof v._id === "string") return v._id;
  }
  return "";
}

function normaliseBooking(raw: Booking): Booking {
  return {
    ...raw,
    productId: idOf(raw.productId) || raw.product?.id || "",
    vendorId: idOf(raw.vendorId) || raw.vendor?.id || "",
  };
}

export interface BookingPrice {
  amount: number;
  currency: string;
  breakdown?: { basePrice: number; peakHoursSurcharge?: number };
}

/* ── 1 · Availability (public) ────────────────────────────────────────────── */

/**
 * GET /api/products/:productId/availability — **unauthenticated**.
 *
 * `fromDate` and `toDate` are both required ISO-8601 datetimes.
 *
 * Works whether or not the vendor has connected a Google Calendar: with none,
 * slots reflect the availability rules alone. ⚠ **Creating** a booking still
 * requires a connected calendar, so a product can offer slots that cannot yet be
 * booked.
 */
export async function getAvailability(
  productId: string,
  fromDate: Date | string,
  toDate: Date | string,
): Promise<Slot[]> {
  const qs = new URLSearchParams({
    fromDate: typeof fromDate === "string" ? fromDate : fromDate.toISOString(),
    toDate: typeof toDate === "string" ? toDate : toDate.toISOString(),
  });
  const data = await apiFetch<{ slots?: Slot[] }>(
    `/api/products/${encodeURIComponent(productId)}/availability?${qs}`,
  );
  return Array.isArray(data?.slots) ? data.slots : [];
}

/* ── 2 · Locking ─────────────────────────────────────────────────────────── */


/**
 * POST /api/products/:productId/slots/:slotId/lock
 *
 * `409 BOOKING_SLOT_LOCKED` when somebody else holds it.
 */
export async function lockSlot(
  productId: string,
  slotId: string,
): Promise<{ locked: boolean; slotId: string; expiresAt: string }> {
  return apiFetch(
    `/api/products/${encodeURIComponent(productId)}/slots/${encodeURIComponent(slotId)}/lock`,
    { method: "POST" },
  );
}

/**
 * POST /api/products/:productId/slots/:slotId/unlock
 *
 * **Idempotent** — releasing a lock you do not own, or one that already expired,
 * answers `released: false` rather than an error. That is what makes it safe to
 * fire from an unmount or a "back" button without tracking whether a lock is
 * actually held.
 */
export async function unlockSlot(
  productId: string,
  slotId: string,
): Promise<{ released: boolean; slotId: string }> {
  return apiFetch(
    `/api/products/${encodeURIComponent(productId)}/slots/${encodeURIComponent(slotId)}/unlock`,
    { method: "POST" },
  );
}

/** Best-effort unlock for teardown paths, where a failure changes nothing. */
export async function releaseSlot(productId: string, slotId: string): Promise<void> {
  try {
    await unlockSlot(productId, slotId);
  } catch {
    /* the lock expires on its own in 15 minutes */
  }
}

/* ── 3 · Booking ─────────────────────────────────────────────────────────── */

/**
 * POST /api/products/:productId/book
 *
 * The resulting `status` depends on the variant's `serviceConfig.bookingMode`:
 *
 *  - `calendar` (default) — `confirmed`, and the calendar event is created now
 *  - `manual` — `pending`, no calendar event, awaiting the vendor's acceptance.
 *    ⚠ It **blocks the slot immediately anyway**, before acceptance.
 *  - `capacity` — `confirmed`, sharing one event across all seats;
 *    `409 BOOKING_SLOT_FULL` if the seats went while the page was open
 *
 * `paymentStatus` always starts `unpaid`.
 *
 * ── Several consecutive slots are ONE booking (2026-10-26) ──────────────────
 *
 * Pass the run as a list — each slot locked first — and the booking spans the
 * first slot's start to the last one's end, priced over the whole interval.
 * A group class takes one slot (`422 BOOKING_MULTI_SLOT_NOT_SUPPORTED`).
 *
 * 🔴 **A run goes out as `slotIds` and NEVER with `slotId` beside it.** An API
 * older than the field reads `slotId` alone; sent both, it would book the
 * first slot only — a shorter appointment than the customer chose, priced as
 * one. Sent `slotIds` alone, it answers `400` instead. The caller still checks
 * the returned `endAt` against the run it asked for.
 *
 * ── The vendor comes to the customer (2026-10-26) ───────────────────────────
 *
 * When the service's `locationKind` is `customer_address`, `addressId` is one
 * of the customer's saved addresses (`saved_addresses[]._id`). The customer
 * chooses it — never pre-select the default, the vendor travels there. Missing
 * → `422 BOOKING_ADDRESS_REQUIRED`; not theirs → `404 BOOKING_ADDRESS_NOT_FOUND`;
 * the vendor removed their own address → `422 BOOKING_LOCATION_UNAVAILABLE`.
 * Ignored for other services, so it is only sent when chosen.
 *
 * The answer's `booking` is the same customer shape as `getBooking` since
 * that date (it was the raw document before).
 */
export async function createBooking(
  productId: string,
  slotIds: string | readonly string[],
  options: { metadata?: Record<string, unknown>; addressId?: string } = {},
): Promise<{ booking: Booking; price: BookingPrice }> {
  const body: Record<string, unknown> =
    typeof slotIds === "string" || slotIds.length === 1
      ? { slotId: typeof slotIds === "string" ? slotIds : slotIds[0] }
      : { slotIds: [...slotIds] };
  if (options.addressId) body.addressId = options.addressId;
  if (options.metadata && Object.keys(options.metadata).length > 0) body.metadata = options.metadata;

  const result = await apiFetch<{ booking: Booking; price: BookingPrice }>(
    `/api/products/${encodeURIComponent(productId)}/book`,
    { method: "POST", body: JSON.stringify(body) },
  );
  return { ...result, booking: normaliseBooking(result.booking) };
}

/* ── 4 · Paying ──────────────────────────────────────────────────────────── */

/**
 * POST /api/bookings/:id/pay
 *
 * The same `{ provider, channel }` body as the cart's `initiate`, and the same
 * result — here under `data`, which `apiFetch` unwraps. Branch on its
 * `instructions` with `nextPaymentStep`, exactly as checkout does. It can
 * refuse with the same three provider codes before anything is written.
 */
export async function payBooking(
  bookingId: string,
  charge: ChargeRequest,
): Promise<InitiatePaymentResponse> {
  return apiFetch<InitiatePaymentResponse>(`/api/bookings/${encodeURIComponent(bookingId)}/pay`, {
    method: "POST",
    body: JSON.stringify(charge),
  });
}

export interface BookingPaymentState {
  bookingId: string;
  paymentStatus: BookingPaymentStatus;
  paymentMethod: string | null;
  priceSnapshot: number;
  currency: string;
  requiresPayment: boolean;
  /** `null` until a payment has been initiated. */
  transaction: {
    id: string;
    status: string;
    /** Which company carried the money. A label at most — never branch on it, and expect names this build has never seen. */
    gateway: string;
    gatewayRef: string;
    /** What the customer paid with. `null` on a payment opened before 2026-09-30. */
    provider: string | null;
  } | null;
}

/**
 * GET /api/bookings/:id/payment-status
 *
 * 🔴 **Use this rather than `GET /api/payments/:transactionId` for a booking.**
 * The generic payments read is owner-only since 2026-07-29 and answers `404` for
 * anyone but the payer, so it cannot serve both parties. This one is already
 * scoped to the customer who booked *and* the vendor who owns it, and returns
 * the booking's `paymentStatus` beside the transaction.
 */
export async function getBookingPaymentStatus(
  bookingId: string,
): Promise<BookingPaymentState> {
  return apiFetch<BookingPaymentState>(
    `/api/bookings/${encodeURIComponent(bookingId)}/payment-status`,
  );
}

/* ── Managing bookings ───────────────────────────────────────────────────── */

export interface ListBookingsQuery {
  status?: BookingStatus;
  paymentStatus?: BookingPaymentStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

/** GET /api/customer/bookings — scoped to the caller; another's id is a `404`. */
export async function listBookings(
  query: ListBookingsQuery = {},
): Promise<{ data: Booking[]; meta: ListMeta }> {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }
  const s = qs.toString();
  const list = await apiFetchList<Booking>(`/api/customer/bookings${s ? `?${s}` : ""}`);
  return { ...list, data: list.data.map(normaliseBooking) };
}

/** GET /api/customer/bookings/:id — with `product`, `vendor` and `store`. */
export async function getBooking(id: string): Promise<Booking> {
  return normaliseBooking(
    await apiFetch<Booking>(`/api/customer/bookings/${encodeURIComponent(id)}`),
  );
}

/**
 * POST /api/customer/bookings/:id/cancel
 *
 * ⚠ **Cancellation can be refused.** The vendor sets the policy, and
 * `422 CANCELLATION_NOT_ALLOWED` means their window has passed — its `details`
 * carry `cancellable` and `deadline`. A `completed` or `no-show` booking is
 * `409 BOOKING_NOT_CANCELLABLE` instead.
 *
 * If the booking was paid, cancelling refunds it — a card in full, mobile money
 * by transfer to the paying number minus the transfer fee — and the response is
 * the booking **with its `refund` block**: usually `sending` or `completed`
 * straight away, `requested` when no paying number is on record. **The
 * cancellation succeeds either way** — a refund problem never keeps the
 * appointment on the books.
 */
export async function cancelBooking(id: string, reason?: string): Promise<Booking> {
  return normaliseBooking(
    await apiFetch<Booking>(`/api/customer/bookings/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      body: JSON.stringify(reason ? { reason } : {}),
    }),
  );
}

/**
 * PATCH /api/customer/bookings/:id/reschedule
 *
 * ⚠ **Lock the new slot first**, exactly as when booking. `pending` and
 * `confirmed` only — anything else is `409 BOOKING_NOT_RESCHEDULABLE`.
 *
 * ⚠ **The appointment keeps its length.** One that spans several slots moves
 * onto a run of the same count, sent as `newSlotIds` (never beside
 * `newSlotId`, for the same reason as `createBooking`). A different length is
 * `400 BOOKING_INVALID_SLOT_ID` with `details.reason: "length_changed"`.
 *
 * 🔴 **On a `manual` service this REQUESTS the time instead (2026-10-26).** The
 * answer is the booking with its time UNCHANGED and an open
 * `rescheduleProposal` with `proposedBy: "customer"`; the vendor accepts or
 * declines it. Read the answer, never assume it moved. While any proposal is
 * open a move is `409 BOOKING_PROPOSAL_PENDING`.
 */
export async function rescheduleBooking(
  id: string,
  newSlotIds: string | readonly string[],
): Promise<Booking> {
  const body =
    typeof newSlotIds === "string" || newSlotIds.length === 1
      ? { newSlotId: typeof newSlotIds === "string" ? newSlotIds : newSlotIds[0] }
      : { newSlotIds: [...newSlotIds] };
  return normaliseBooking(
    await apiFetch<Booking>(`/api/customer/bookings/${encodeURIComponent(id)}/reschedule`, {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  );
}

/**
 * Answer the vendor's proposed time —
 * `POST /api/customer/bookings/:id/reschedule-proposal/{accept,decline}`.
 *
 * Accept moves the booking. Decline keeps the original time AND lets the
 * customer cancel with a full refund whatever the vendor's policy says.
 * `404 BOOKING_PROPOSAL_NOT_FOUND` — nothing open, or it lapsed;
 * `403 BOOKING_PROPOSAL_NOT_YOURS` — it is the customer's own request.
 */
export async function answerProposal(
  id: string,
  answer: "accept" | "decline",
): Promise<Booking> {
  return normaliseBooking(
    await apiFetch<Booking>(
      `/api/customer/bookings/${encodeURIComponent(id)}/reschedule-proposal/${answer}`,
      { method: "POST" },
    ),
  );
}

/** Withdraw the customer's own request — `DELETE …/reschedule-proposal`. */
export async function withdrawProposal(id: string): Promise<Booking> {
  return normaliseBooking(
    await apiFetch<Booking>(
      `/api/customer/bookings/${encodeURIComponent(id)}/reschedule-proposal`,
      { method: "DELETE" },
    ),
  );
}

export interface BookingBalance {
  bookingId: string;
  currency: string;
  quotedPrice: number;
  finalPrice: number;
  balanceDue: number;
  balancePaid: number;
  outstanding: number;
  balancePaymentMethod: string | null;
  /**
   * What the provider settled *below* what was already paid.
   *
   * 🔴 **Recorded, not refunded.** No automatic refund is issued — it is usually
   * a goodwill discount the provider intends to hand back themselves. Do not
   * render it as money on its way back.
   */
  creditDue: number;
  settledAt: string | null;
}

/**
 * GET /api/customer/bookings/:id/balance
 *
 * A service can run longer, or cost more, than the slot booked. When the
 * provider settles above what was paid, the difference is a balance — and it is
 * **never charged automatically**, because the customer agreed to the quoted
 * price, not to whatever is settled afterwards.
 *
 * `409 BOOKING_NOT_COMPLETED` before the appointment is settled.
 */
export async function getBookingBalance(id: string): Promise<BookingBalance> {
  return apiFetch<BookingBalance>(
    `/api/customer/bookings/${encodeURIComponent(id)}/balance`,
  );
}

/**
 * POST /api/customer/bookings/:id/pay-balance — the same body and answer as the
 * first payment. The providers on offer may have changed since then, so the
 * screen re-reads `/options` rather than reusing the first payment's choice.
 */
export async function payBookingBalance(
  id: string,
  charge: ChargeRequest,
): Promise<InitiatePaymentResponse> {
  return apiFetch<InitiatePaymentResponse>(`/api/customer/bookings/${encodeURIComponent(id)}/pay-balance`, {
    method: "POST",
    body: JSON.stringify(charge),
  });
}

/* ── Presentation ────────────────────────────────────────────────────────── */

/**
 * ⚠ `labelKey` is a full dotted message key, not a sentence. A non-React module
 * cannot translate; the component does it with a root-scoped `t()`. See
 * LOCALISATION.md.
 */
export const BOOKING_STATUS_LABEL: Record<
  BookingStatus,
  { labelKey: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }
> = {
  pending: { labelKey: "shop.status.booking.pending", tone: "warning" },
  confirmed: { labelKey: "shop.status.booking.confirmed", tone: "success" },
  completed: { labelKey: "shop.status.booking.completed", tone: "neutral" },
  "no-show": { labelKey: "shop.status.booking.no-show", tone: "danger" },
  cancelled: { labelKey: "shop.status.booking.cancelled", tone: "neutral" },
};

export const BOOKING_PAYMENT_LABEL: Record<
  BookingPaymentStatus,
  { labelKey: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }
> = {
  unpaid: { labelKey: "shop.status.bookingPayment.unpaid", tone: "warning" },
  pending: { labelKey: "shop.status.bookingPayment.pending", tone: "info" },
  paid: { labelKey: "shop.status.bookingPayment.paid", tone: "success" },
  disputed: { labelKey: "shop.status.bookingPayment.disputed", tone: "danger" },
  failed: { labelKey: "shop.status.bookingPayment.failed", tone: "danger" },
  // Deliberately not "Refunded": the money has not arrived yet.
  refund_pending: { labelKey: "shop.status.bookingPayment.refund_pending", tone: "warning" },
  refunded: { labelKey: "shop.status.bookingPayment.refunded", tone: "neutral" },
};
