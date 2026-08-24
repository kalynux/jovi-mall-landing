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
 * ⚠ **Money is in the smallest currency unit** — `5000` is 50.00 XAF.
 *
 * See api-doc/customer/bookings.md.
 */
import { apiFetch, apiFetchList } from "@/lib/api/client";
import type { ListMeta } from "./shop.types";

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
 * It means money is owed back but the gateway could not return it
 * automatically — cash bookings, and My-CoolPay, whose API has no refund
 * endpoint — so a human completes the payout from a support ticket. **The
 * customer does not have their money yet**, and a UI that renders the two the
 * same way tells them they have been repaid when they have not.
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
  _id: string;
  productId: string;
  userId: string;
  vendorId: string;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  paymentStatus: BookingPaymentStatus;
  /** Smallest currency unit. */
  priceSnapshot: number;
  currency: string;
  requiresPayment: boolean;
  externalCalendarEventId?: string | null;
  metadata?: Record<string, unknown>;
  /** Populated on the detail read. */
  product?: { id: string; title: string; slug?: string } | null;
  vendor?: { id: string; name: string } | null;
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

/** How long a lock survives without being spent. */
export const SLOT_LOCK_MINUTES = 15;

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
 */
export async function createBooking(
  productId: string,
  slotId: string,
  metadata?: Record<string, unknown>,
): Promise<{ booking: Booking; price: BookingPrice }> {
  const body: Record<string, unknown> = { slotId };
  if (metadata && Object.keys(metadata).length > 0) body.metadata = metadata;

  return apiFetch<{ booking: Booking; price: BookingPrice }>(
    `/api/products/${encodeURIComponent(productId)}/book`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

/* ── 4 · Paying ──────────────────────────────────────────────────────────── */

export interface BookingPaymentChannel {
  /** E.164 for mobile money. */
  phoneNumber?: string;
  phoneOperator?: string;
  customerEmail?: string;
  customerName?: string;
}

/** POST /api/bookings/:id/pay */
export async function payBooking(
  bookingId: string,
  gateway: "NOTCHPAY" | "MYCOOLPAY" | "STRIPE",
  channel: BookingPaymentChannel,
): Promise<Record<string, unknown>> {
  return apiFetch(`/api/bookings/${encodeURIComponent(bookingId)}/pay`, {
    method: "POST",
    body: JSON.stringify({ gateway, channel }),
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
    gateway: string;
    gatewayRef: string;
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
  return apiFetchList<Booking>(`/api/customer/bookings${s ? `?${s}` : ""}`);
}

/** GET /api/customer/bookings/:id — product and vendor populated. */
export async function getBooking(id: string): Promise<Booking> {
  return apiFetch<Booking>(`/api/customer/bookings/${encodeURIComponent(id)}`);
}

/**
 * POST /api/customer/bookings/:id/cancel
 *
 * ⚠ **Cancellation can be refused.** The vendor sets the policy, and
 * `422 CANCELLATION_NOT_ALLOWED` means their window has passed — its `details`
 * carry `cancellable` and `deadline`. A `completed` or `no-show` booking is
 * `409 BOOKING_NOT_CANCELLABLE` instead.
 *
 * If the booking was paid, cancelling refunds it where the gateway supports
 * refunds; otherwise `paymentStatus` becomes `refund_pending` and a support
 * ticket is raised for a manual payout. **The cancellation succeeds either
 * way** — a refund problem never keeps the appointment on the books.
 */
export async function cancelBooking(id: string, reason?: string): Promise<Booking> {
  return apiFetch<Booking>(`/api/customer/bookings/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    body: JSON.stringify(reason ? { reason } : {}),
  });
}

/**
 * PATCH /api/customer/bookings/:id/reschedule
 *
 * ⚠ **Lock the new slot first**, exactly as when booking. `pending` and
 * `confirmed` only — anything else is `409 BOOKING_NOT_RESCHEDULABLE`.
 */
export async function rescheduleBooking(id: string, newSlotId: string): Promise<Booking> {
  return apiFetch<Booking>(`/api/customer/bookings/${encodeURIComponent(id)}/reschedule`, {
    method: "PATCH",
    body: JSON.stringify({ newSlotId }),
  });
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

/** POST /api/customer/bookings/:id/pay-balance — same body as the first payment. */
export async function payBookingBalance(
  id: string,
  gateway: "NOTCHPAY" | "MYCOOLPAY" | "STRIPE",
  channel: BookingPaymentChannel,
): Promise<Record<string, unknown>> {
  return apiFetch(`/api/customer/bookings/${encodeURIComponent(id)}/pay-balance`, {
    method: "POST",
    body: JSON.stringify({ gateway, channel }),
  });
}

/* ── Presentation ────────────────────────────────────────────────────────── */

export const BOOKING_STATUS_LABEL: Record<
  BookingStatus,
  { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }
> = {
  pending: { label: "Awaiting the seller", tone: "warning" },
  confirmed: { label: "Confirmed", tone: "success" },
  completed: { label: "Completed", tone: "neutral" },
  "no-show": { label: "Missed", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const BOOKING_PAYMENT_LABEL: Record<
  BookingPaymentStatus,
  { label: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }
> = {
  unpaid: { label: "Not paid", tone: "warning" },
  pending: { label: "Payment in progress", tone: "info" },
  paid: { label: "Paid", tone: "success" },
  disputed: { label: "Disputed", tone: "danger" },
  failed: { label: "Payment failed", tone: "danger" },
  // Deliberately not "Refunded": the money has not arrived yet.
  refund_pending: { label: "Refund on the way", tone: "warning" },
  refunded: { label: "Refunded", tone: "neutral" },
};
