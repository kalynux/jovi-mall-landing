/**
 * Support tickets — `/api/customer/tickets`.
 *
 * The same ticketing engine every role uses, scoped to the caller. Three
 * customer-specific restrictions shape what this module exposes, and they are
 * enforced server-side whether or not a client respects them:
 *
 *  - **No assign and no priority endpoints.** A customer cannot reassign or
 *    reprioritise, so neither is here.
 *  - **Notes are public-only.** `POST …/notes` always creates a public note;
 *    an internal one is rejected. Customers never see internal staff notes.
 *  - **A customer sees only their own tickets.**
 *
 * ⚠ **The wire is mixed-case.** Requests are camelCase (`entityType`,
 * `entityId`), responses are snake_case (`entity_type`, `created_by`) with a
 * Mongo `_id`. That is the backend's shape, not a transcription slip — do not
 * "tidy" one side into the other.
 *
 * See api-doc/customer/tickets.md; the authoritative enums live in the backend's
 * `agency/tickets.md` and `src/modules/tickets/types/ticket.types.ts`.
 */
import { apiFetch, apiFetchList } from "@/lib/api/client";
import type { FileAccess, FileDetail, ListMeta } from "./shop.types";

/**
 * The authoritative `TicketType` enum, grouped as the picker renders it.
 *
 * Kept as data rather than a flat union so the create form's optgroups and the
 * type itself cannot drift apart. Mirrors `api-doc/ticket_types.txt`.
 */
/**
 * ⚠ `labelKey` is a full dotted message key. These nine are plain nouns that
 * every screen in the shop needs, so they resolve into `shop.common` rather
 * than a support-only namespace. See LOCALISATION.md.
 */
export const TICKET_TYPE_GROUPS = [
  {
    labelKey: "shop.common.general",
    types: [
      "GENERAL_SUPPORT",
      "ACCOUNT_ACCESS",
      "ACCOUNT_VERIFICATION",
      "PROFILE_UPDATE",
      "SECURITY_ISSUE",
    ],
  },
  {
    labelKey: "shop.common.orders",
    types: [
      "ORDER_ISSUE",
      "ORDER_CANCELLATION",
      "ORDER_REFUND",
      "ORDER_DISPUTE",
      "ORDER_FULFILLMENT",
    ],
  },
  {
    labelKey: "shop.common.payments",
    types: [
      "PAYMENT_ISSUE",
      "PAYMENT_FAILED",
      "PAYMENT_CONFIRMATION",
      "CHARGEBACK",
      "INVOICE_REQUEST",
    ],
  },
  {
    labelKey: "shop.common.bookings",
    types: [
      "BOOKING_ISSUE",
      "BOOKING_CANCELLATION",
      "BOOKING_RESCHEDULE",
      "AVAILABILITY_PROBLEM",
    ],
  },
  {
    labelKey: "shop.common.products",
    types: ["PRODUCT_ISSUE", "INVENTORY_PROBLEM", "PRICING_ISSUE", "VARIANT_ISSUE"],
  },
  {
    labelKey: "shop.common.delivery",
    types: ["SHIPPING_ISSUE", "DELIVERY_DELAY", "DELIVERY_CONFIRMATION", "ADDRESS_CHANGE"],
  },
  {
    labelKey: "shop.common.technical",
    types: ["TECHNICAL_ISSUE", "BUG_REPORT", "INTEGRATION_ISSUE", "API_ACCESS"],
  },
  { labelKey: "shop.common.policy", types: ["POLICY_QUESTION", "COMPLIANCE", "LEGAL_REQUEST"] },
  { labelKey: "shop.common.other", types: ["OTHER"] },
] as const;

export type TicketType = (typeof TICKET_TYPE_GROUPS)[number]["types"][number];

/**
 * The payout groups are deliberately absent from the picker above.
 *
 * `PAYOUT_REQUEST` and friends are accepted by the API — every role's endpoint
 * takes any value from the enum — but a customer has no payouts and no
 * commission, so offering them would only produce tickets nobody can action.
 */

export type TicketStatus =
  | "open"
  | "in_progress"
  | "waiting_on_admin"
  | "waiting_on_vendor"
  | "waiting_on_customer"
  | "waiting_on_agency"
  | "waiting_on_agent"
  | "resolved"
  | "closed";

/** Set once at creation and **immutable afterwards**. */
export type TicketImportance = "low" | "medium" | "high" | "critical";

/** Staff-controlled. A customer cannot set or change this. */
export type TicketPriority = "low" | "normal" | "high" | "urgent";

export type TicketEntityType =
  | "ORDER"
  | "PRODUCT"
  | "BOOKING"
  | "SHIPMENT"
  | "DELIVERY"
  | "USER"
  | "VENDOR"
  | "CUSTOMER"
  | "AGENT"
  | "AGENCY"
  | "OTHER";

/** How a person is summarised on a ticket, note or attachment. */
export interface TicketActor {
  user_id: string;
  role: string;
  name: string;
  /** A resolved file object, or `null`. Never a URL string. */
  avatar: FileDetail | null;
}

/**
 * The administrator a ticket is assigned to.
 *
 * 🔴 **Not a {@link TicketActor}** — a different shape entirely, and it changed
 * from one at some point without anything breaking, precisely because it is
 * `null` on almost every ticket.
 *
 * It is **`null` until a wi-admin administrator takes the ticket**, which is the
 * state nearly every ticket is in: support administrators live in a separate
 * service with its own database, so nobody is assigned by default.
 *
 * ⚠ `avatar_url` is **reserved and always `null`.** Draw initials from `name`.
 */
export interface TicketAdmin {
  name: string;
  job_title: string | null;
  department: string | null;
  avatar_url: null;
}

/** The thing a ticket is about, resolved for display. */
export interface TicketEntity {
  type: TicketEntityType;
  id: string;
  /**
   * For `ORDER`, `PRODUCT` and `BOOKING` this is resolved from the record. Every
   * other type degrades to `"<Type> <last 6 of id>"` — those are not looked up.
   */
  label: string;
  reference: string;
}

export interface Ticket {
  /**
   * 🔴 **Key on `id`.** `Ticket` is built on the backend's `BaseSchemaOptions`,
   * whose `toJSON` deletes `_id` and exposes the `id` virtual, so the three
   * write endpoints a customer has — `PATCH /:id`, `PATCH /:id/status` and
   * `POST /:id/close` — return the document with **`id` alone**.
   *
   * The three *enriched* reads (create, list, detail) additionally carry a
   * duplicate `_id`, because `TicketEnrichmentService` builds its payload with
   * `toObject({ virtuals: true })`, which applies no transform. `id` is the only
   * identifier present on all six.
   */
  id: string;
  /**
   * Present only on the three enriched reads — see `id`. Never key on it: a
   * client that does reads `undefined` the first time it patches a ticket.
   */
  _id?: string;
  subject: string;
  description: string;
  type: TicketType;
  importance: TicketImportance;
  priority: TicketPriority;
  status: TicketStatus;
  entity_type: TicketEntityType;
  entity_id: string;
  entity: TicketEntity | null;
  tracking_number: string | null;
  created_by_user_id: string;
  created_by_role: string;
  created_by: TicketActor | null;
  assigned_to_role: string | null;
  assigned_to: TicketActor | null;
  assigned_admin_id: string | null;
  /** `null` on almost every ticket — see {@link TicketAdmin}. */
  assigned_admin: TicketAdmin | null;
  priority_locked: boolean;
  followers: TicketActor[];
  createdAt: string;
  updatedAt: string;
}

export interface TicketNote {
  /** Same `id`/`_id` rule as {@link Ticket} — key on `id`. */
  id: string;
  _id?: string;
  ticket_id: string;
  content: string;
  /** Lowercase here. The attachment endpoint uses uppercase — see below. */
  visibility: "public" | "private";
  is_system_note: boolean;
  author_user_id: string;
  author_role: string;
  author: TicketActor | null;
  visible_to_user_ids: string[];
  created_at: string;
}

export interface TicketAttachment {
  id: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  url: string | null;
  /**
   * The same three-value rule every other file on the platform follows.
   *
   * This shape is the ticket module's own, not a `FileDetail`, so it has to
   * carry `access` itself — and it did not, which meant an attachment could
   * only ever be "has a URL" or "has none". A file held back because its owner
   * is over their storage plan then read as missing.
   */
  access: FileAccess;
  uploadedBy: string;
  uploadedByRole: string;
  uploadedByActor: TicketActor | null;
  createdAt: string;
}

/* ── Creating and reading tickets ─────────────────────────────────────────── */

export interface CreateTicketInput {
  /** 1–200 chars. */
  subject: string;
  /** 1–700 chars on create. */
  description: string;
  type: TicketType;
  /** **Immutable after creation.** */
  importance: TicketImportance;
  entityType: TicketEntityType;
  /** Required for everything except `OTHER`. */
  entityId?: string;
  /** Max 120 chars. May be *required* — see the note on the function. */
  trackingNumber?: string;
  /** Up to 5 ids from `POST /api/files/upload`. */
  attachments?: string[];
}

/**
 * POST /api/customer/tickets
 *
 * ⚠ **Entity validation only applies to `ORDER`, `BOOKING` and `PRODUCT`.** For
 * those three the id must resolve or the request is
 * `404 TICKET_ENTITY_NOT_FOUND`. Every other `entityType` — `SHIPMENT`,
 * `DELIVERY`, and the rest — is stored **as-is with no existence check**.
 *
 * 🔴 **An `ORDER` ticket inherits that order's vendor's support policy.** The
 * backend resolves the order's vendor and applies their `required_info` rules,
 * so a ticket can be refused with `400 TICKET_REQUIRED_INFO_MISSING` over a
 * policy the customer has never seen and cannot control:
 *
 *  - `tracking_number` — required for `ORDER` tickets
 *  - `product_photo_video` — required for `ORDER` or `PRODUCT` tickets, meaning
 *    at least one attachment
 *
 * `details.missing[]` names what is absent, which is the only way a form can ask
 * for the right thing on the second attempt. Filing against `SHIPMENT` or
 * `DELIVERY` instead skips the enforcement entirely, because no vendor is
 * resolved for those.
 */
export async function createTicket(input: CreateTicketInput): Promise<Ticket> {
  const body: Record<string, unknown> = {
    subject: input.subject,
    description: input.description,
    type: input.type,
    importance: input.importance,
    entityType: input.entityType,
  };
  if (input.entityId) body.entityId = input.entityId;
  if (input.trackingNumber) body.trackingNumber = input.trackingNumber;
  if (input.attachments?.length) body.attachments = input.attachments.slice(0, 5);

  return apiFetch<Ticket>("/api/customer/tickets", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** What `TICKET_REQUIRED_INFO_MISSING` says is absent. */
export function missingRequiredInfo(err: unknown): string[] {
  const details = (err as { details?: { missing?: string[] } })?.details;
  return Array.isArray(details?.missing) ? details.missing : [];
}

export interface ListTicketsQuery {
  page?: number;
  limit?: number;
  type?: TicketType;
  status?: TicketStatus;
  entityType?: TicketEntityType;
  entityId?: string;
  sortBy?: "createdAt" | "updatedAt" | "priority" | "status";
}

/**
 * GET /api/customer/tickets
 *
 * ⚠ This is one of the three endpoints whose pagination block is called
 * `pagination` rather than `meta`. The fields inside are identical, and
 * `apiFetchList` reads either, so callers need not care.
 */
export async function listTickets(
  query: ListTicketsQuery = {},
): Promise<{ data: Ticket[]; meta: ListMeta }> {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }
  const s = qs.toString();
  return apiFetchList<Ticket>(`/api/customer/tickets${s ? `?${s}` : ""}`);
}

/** GET /api/customer/tickets/:id — `404` when not found *or* not the caller's. */
export async function getTicket(id: string): Promise<Ticket> {
  return apiFetch<Ticket>(`/api/customer/tickets/${encodeURIComponent(id)}`);
}



/** POST /api/customer/tickets/:id/close */
export async function closeTicket(id: string): Promise<Ticket> {
  return apiFetch<Ticket>(`/api/customer/tickets/${encodeURIComponent(id)}/close`, {
    method: "POST",
  });
}

/* ── Notes ───────────────────────────────────────────────────────────────── */

/**
 * POST /api/customer/tickets/:ticketId/notes — 1–300 chars.
 *
 * The field is `content`, and `visibility` is **lowercase** here while the
 * attachment endpoint uses uppercase. That inconsistency is real and is in the
 * contract; it is not worth normalising on this side, because the value a
 * customer can send is fixed anyway: a customer note is always public, and the
 * server rejects anything else.
 */
export async function addTicketNote(ticketId: string, content: string): Promise<TicketNote> {
  return apiFetch<TicketNote>(
    `/api/customer/tickets/${encodeURIComponent(ticketId)}/notes`,
    { method: "POST", body: JSON.stringify({ content }) },
  );
}

/** GET /api/customer/tickets/:ticketId/notes — public notes only, for a customer. */
export async function listTicketNotes(ticketId: string): Promise<TicketNote[]> {
  const data = await apiFetch<TicketNote[]>(
    `/api/customer/tickets/${encodeURIComponent(ticketId)}/notes`,
  );
  return Array.isArray(data) ? data : [];
}

/* ── Attachments ─────────────────────────────────────────────────────────── */

/** Max attachments per ticket — `422 TICKET_ATTACHMENT_LIMIT_EXCEEDED` beyond it. */
export const MAX_TICKET_ATTACHMENTS = 5;

/**
 * POST /api/customer/tickets/:ticketId/attachments
 *
 * Takes a `fileId` from a prior `POST /api/files/upload`, not the bytes.
 *
 * ⚠ **A ticket attachment uploaded today is public**, despite the legacy
 * `ticket-attachments/` storage tree being private. It is an ordinary upload
 * landing in `documents/` or `images/` and attached by id afterwards; making
 * these private needs a dedicated upload path that does not exist yet. **Do not
 * tell a customer their attachment is private.**
 */
export async function attachToTicket(
  ticketId: string,
  fileId: string,
): Promise<TicketAttachment> {
  return apiFetch<TicketAttachment>(
    `/api/customer/tickets/${encodeURIComponent(ticketId)}/attachments`,
    { method: "POST", body: JSON.stringify({ fileId }) },
  );
}

/** GET /api/customer/tickets/:ticketId/attachments */
export async function listTicketAttachments(ticketId: string): Promise<TicketAttachment[]> {
  const data = await apiFetch<TicketAttachment[]>(
    `/api/customer/tickets/${encodeURIComponent(ticketId)}/attachments`,
  );
  return Array.isArray(data) ? data : [];
}

/* ── Reference lookups for the create form ───────────────────────────────── */

export interface TicketOrderRef {
  id: string;
  orderNumber: string;
  orderType: string;
  fulfillmentStatus: string;
  createdAt: string;
  customerName: string | null;
  customerAvatar: FileDetail | null;
  shipments: {
    shipmentId: string;
    agencyId: string | null;
    agencyName: string | null;
    agentId: string | null;
    /** `null` until the agency or agent records one. */
    trackingNumber: string | null;
    status: string;
  }[];
}

export interface TicketProductRef {
  id: string;
  title: string;
  slug: string;
  category: string;
  tags: string[];
  firstFileUrl: string | null;
}

/**
 * GET /api/customer/tickets/reference/orders
 *
 * A cheap read-only picker source, scoped to the caller — a customer sees their
 * own orders. `q` searches order number, customer name and tracking number.
 * Also the place a create form gets `trackingNumber` from, which matters because
 * an `ORDER` ticket may require one.
 */
export async function listTicketOrderRefs(
  query: { page?: number; limit?: number; q?: string } = {},
): Promise<{ data: TicketOrderRef[]; meta: ListMeta }> {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }
  const s = qs.toString();
  return apiFetchList<TicketOrderRef>(
    `/api/customer/tickets/reference/orders${s ? `?${s}` : ""}`,
  );
}

/** GET /api/customer/tickets/reference/products — products from the caller's own orders. */
export async function listTicketProductRefs(
  query: { page?: number; limit?: number; q?: string } = {},
): Promise<{ data: TicketProductRef[]; meta: ListMeta }> {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") qs.set(key, String(value));
  }
  const s = qs.toString();
  return apiFetchList<TicketProductRef>(
    `/api/customer/tickets/reference/products${s ? `?${s}` : ""}`,
  );
}

/* ── Presentation ────────────────────────────────────────────────────────── */

/**
 * Message keys for the status enum, and the tone each carries.
 *
 * `labelKey`, not `label` — a non-React module cannot translate, so it names
 * the string and the component resolves it. See LOCALISATION.md.
 */
export const TICKET_STATUS_LABEL: Record<
  TicketStatus,
  { labelKey: string; tone: "neutral" | "info" | "warning" | "success" | "danger" }
> = {
  open: { labelKey: "shop.status.ticket.open", tone: "info" },
  in_progress: { labelKey: "shop.status.ticket.in_progress", tone: "info" },
  waiting_on_admin: { labelKey: "shop.status.ticket.waiting_on_admin", tone: "warning" },
  waiting_on_vendor: { labelKey: "shop.status.ticket.waiting_on_vendor", tone: "warning" },
  // The one status that is a call to action rather than a report.
  waiting_on_customer: { labelKey: "shop.status.ticket.waiting_on_customer", tone: "danger" },
  waiting_on_agency: { labelKey: "shop.status.ticket.waiting_on_agency", tone: "warning" },
  waiting_on_agent: { labelKey: "shop.status.ticket.waiting_on_agent", tone: "warning" },
  resolved: { labelKey: "shop.status.ticket.resolved", tone: "success" },
  closed: { labelKey: "shop.status.ticket.closed", tone: "neutral" },
};

/**
 * `ORDER_ISSUE` → `Order issue`. The enum is not written for a person to read.
 *
 * 🔴 **Still English, deliberately.** Phase 1 converted the label MAPS in this
 * file; this is a derivation over the whole ~50-member `TicketType` enum, and
 * those names belong to `shop.support`, which the ownership table in
 * LOCALISATION.md gives to Phase 9. Phase 9 replaces this with a lookup into
 * `shop.support.types.<TICKET_TYPE>`.
 */
export function ticketTypeLabel(type: string): string {
  const spaced = type.replace(/_/g, " ").toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
