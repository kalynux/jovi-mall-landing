/**
 * Customer-account domain types — the authenticated half of the shop.
 *
 * These mirror what the backend actually returns, which is NOT always what
 * `api-doc/customer/profile.md` shows. The doc is stale on casing; the DTO in
 * `modules/customers/dto/customer-profile.dto.ts` is the authority, and it is
 * deliberately mixed:
 *
 *   - top level is camelCase   (`emailVerified`, `savedAddresses`, `dateOfBirth`)
 *   - nested sub-documents pass through the Mongoose model raw, so they keep
 *     snake_case (`address_line1`, `is_default`, `marketing_opt_in`)
 *
 * Do not "tidy" one side into the other — both are on the wire exactly as typed
 * here. Unrelated to this, the write side uses different names again
 * (`PATCH` takes `avatarFileId`; reads return a resolved `avatar` file object).
 */

/**
 * A resolved uploaded file. The single way the backend surfaces any file
 * reference — product media, store branding, customer avatars — never a bare
 * URL string. `url` is computed per storage provider at read time, so always
 * use it as given rather than building one from `key`.
 */
export interface FileRef {
  id: string;
  key: string;
  url: string;
  mimeType: string;
  size: number;
  originalName?: string;
}

// ─── Geo ─────────────────────────────────────────────────────────────────────

export interface GeoPoint {
  type: "Point";
  /** [longitude, latitude] — GeoJSON order, not lat/lng. */
  coordinates: [number, number];
}

export interface GeoAddressComponents {
  street: string | null;
  neighbourhood: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
  postal_code: string | null;
}

/** One result from `GET /api/geo/search` — what the user picks from. */
export interface GeoCandidate {
  formatted_address: string;
  coordinates: GeoPoint;
  provider: string;
  provider_place_id: string | null;
  components: GeoAddressComponents;
}

/**
 * A stored geospatial address: the picked candidate plus the text the user
 * typed. `resolved_at` is server-assigned and must not be sent.
 */
export interface GeoAddress extends GeoCandidate {
  raw_input: string | null;
  resolved_at?: string;
}

// ─── Profile ─────────────────────────────────────────────────────────────────

export interface SavedAddress {
  _id: string;
  label: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string | null;
  /** ISO-3166-1 alpha-2, upper-cased. Defaults to `CM`. */
  country: string;
  is_default: boolean;
  /** @deprecated bare coordinate kept for back-compat — prefer `geo`. */
  location?: GeoPoint | null;
  geo: GeoAddress | null;
}

export type PaymentMethodType = "card" | "mobile_money" | "bank_transfer";

/**
 * The payment method as the **profile** returns it — deliberately sanitized:
 * gateway ids are never included here. The richer record (brand, last4, expiry)
 * lives on `/api/me/payment-methods`; see `SavedPaymentMethod` below.
 */
export interface ProfilePaymentMethod {
  id: string;
  provider: string;
  display_label: string;
  method_type: PaymentMethodType;
  is_default: boolean;
}

export interface CustomerPreferences {
  /** BCP-47, e.g. "en" / "fr". */
  language: string;
  /** ISO-4217, upper-cased. `XAF` (FCFA) platform-wide. */
  currency: string;
  marketing_opt_in: boolean;
  ai_tone: string[];
  ads_compact_mode: boolean;
  compact_mode: boolean;
}

/** `GET /api/customer/profile` */
export interface CustomerProfile {
  id: string;
  name: string;
  email: string | null;
  emailVerified: boolean;
  phone: string | null;
  phoneVerified: boolean;
  avatar: FileRef | null;
  bio: string | null;
  savedAddresses: SavedAddress[];
  dateOfBirth: string | null;
  preferences: CustomerPreferences;
  recentProductCode: string | null;
  savedPaymentMethods: ProfilePaymentMethod[];
  wa: { verified: boolean; name?: string } | null;
  timezone: string;
  status: string;
  onboardingStep: number;
  createdAt: string;
  updatedAt: string;
}

/** `PATCH /api/customer/profile`. Omit a key to leave it alone; send `null`/`""` to clear a clearable one. */
export interface UpdateProfilePayload {
  name?: string;
  /** File id from `POST /api/files/upload`. Clearable. */
  avatarFileId?: string | null;
  bio?: string | null;
  dateOfBirth?: string | null;
  recentProductCode?: string | null;
  preferences?: Partial<CustomerPreferences>;
}

/** `POST /api/customer/addresses` */
export interface AddAddressPayload {
  label: string;
  address_line1: string;
  address_line2?: string | null;
  city: string;
  state?: string | null;
  country?: string;
  is_default?: boolean;
  geo?: GeoAddress | null;
}

// ─── Saved payment methods (`/api/me/payment-methods`) ───────────────────────

export interface SavedPaymentMethod {
  id: string;
  provider: string;
  gateway_customer_id?: string;
  gateway_instrument_id?: string;
  method_type: PaymentMethodType;
  display_label: string;
  brand?: string | null;
  last4?: string | null;
  exp_month?: number | null;
  exp_year?: number | null;
  holder_name?: string | null;
  is_default: boolean;
}

export interface AddPaymentMethodPayload {
  provider: string;
  gateway_customer_id: string;
  gateway_instrument_id: string;
  method_type: PaymentMethodType;
  display_label: string;
  brand?: string;
  last4?: string;
  exp_month?: number;
  exp_year?: number;
  holder_name?: string;
  is_default?: boolean;
}

// ─── Orders ──────────────────────────────────────────────────────────────────

export type OrderType = "physical" | "digital";

/** Per-order payment state. Note the SHOUTING variant — that is what the wire carries. */
export type OrderPaymentStatus =
  | "pending"
  | "AWAITING_PAYMENT"
  | "partially_paid"
  | "paid"
  | "disputed"
  | "failed"
  | "refunded";

/**
 * Group-level aggregate of the orders beneath it — lower-case, a different set.
 *
 * All eight the server's `aggregatePaymentStatus` can answer. The last four
 * were absent here while the server had been returning them: `refunded`,
 * `failed` and `disputed` each got their own label rather than collapsing to
 * `mixed`, and `unknown` is what an empty group reports — deliberately, because
 * `[].every(…)` is `true` and the honest answer to no data is not "paid".
 */
export type GroupPaymentStatus =
  | "paid"
  | "awaiting_payment"
  | "partially_paid"
  | "mixed"
  | "refunded"
  | "failed"
  | "disputed"
  | "unknown";

/**
 * Everything from `partially_shipped` on is system-derived from the order's
 * shipments and is never set by a vendor directly. `partially_*` only appear
 * when an order is split across more than one delivery agency.
 */
export type FulfillmentStatus =
  | "pending"
  | "processing"
  | "partially_shipped"
  | "shipped"
  | "partially_delivered"
  | "delivered"
  | "fulfilled"
  | "cancelled"
  | "returned";

export type PaymentMethodChoice = "online" | "cash_on_delivery";

export interface OrderItem {
  id: string;
  productId: string;
  variantId: string;
  sku: string;
  title: string;
  variantTitle?: string;
  quantity: number;
  price: number;
  currency: string;
  /** Snapshot taken at checkout — later product edits do not change it. */
  freeDelivery: boolean;
  /**
   * The product thumbnail. `null` when the product had none.
   *
   * Order history with no pictures is close to unreadable on a phone, which is
   * why this was asked for and why it is here rather than being re-fetched per
   * line from the catalogue — a delisted product still has to render on a past
   * order.
   */
  image?: FileRef | null;
  /** Per-line delivery state, and the shipment it belongs to. */
  delivery?: {
    status?: string;
    shipmentId?: string | null;
  };
}

/**
 * One shipment's cash collection on a COD order. Created when the shipment is
 * picked up. `deliveryCode` is present **only while `status` is `"pending"`**.
 */
export interface CodCollection {
  shipmentId: string;
  expectedAmount: number;
  currency: string;
  status: "pending" | "collected" | "cancelled";
  collectedAt: string | null;
  deliveryCode?: string;
}

/**
 * The seller on an order.
 *
 * Both fields are nullable: an order references a vendor whose store may since
 * have been renamed or removed, and "Order from 507f1f77bcf86cd799439aaa" is not
 * a receipt. Fall back to the id only as a last resort.
 */
export interface OrderStore {
  slug: string | null;
  name: string | null;
}

/**
 * What the order was actually charged.
 *
 * `tax` and `discount` are pinned zeros — no tax engine, no coupon model — and
 * these are the same figures `POST /cart/quote` returns, written at checkout so
 * the quote and the charge cannot diverge.
 */
export interface OrderPriceBreakdown {
  base: number;
  tax: number;
  discount: number;
  total: number;
}

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  vendorId: string;
  /** Prefer this over `vendorId` for anything a customer reads. */
  store?: OrderStore;
  cartId?: string | null;
  orderType: OrderType;
  total: number;
  currency: string;
  priceBreakdown?: OrderPriceBreakdown;
  paymentMethod: PaymentMethodChoice;
  paymentStatus: OrderPaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  itemCount?: number;
  /** Geocoded and frozen at checkout, so editing a saved address never rewrites it. */
  deliveryAddress?: unknown | null;
  createdAt?: string;
  updatedAt?: string;
  /** COD orders only. */
  codCollections?: CodCollection[];
  /** Present on the group-detail read, absent on the list. */
  items?: OrderItem[];
}

/** `POST /api/customer/orders/checkout` — one order per vendor, one `cartId`. */
export interface CheckoutResult {
  cartId: string;
  paymentMethod: PaymentMethodChoice;
  orders: CustomerOrder[];
}

/**
 * A parcel, as its recipient sees it.
 *
 * The status vocabulary is **collapsed**, not passed through: `ShipmentStatus`
 * has eleven members and most describe internal dispatch machinery
 * (`assigned`, `handing_over`, `pending_agency_reassignment`). A customer is
 * shown the five below — the same four the notification catalog already commits
 * to, plus `preparing` for everything before a parcel physically moves — so the
 * word in the app matches the word in the push they received.
 *
 * The free-text internal note on a failed attempt is never published; only the
 * fact of an attempt and its count.
 *
 * ⚠ The agent's identity used to be on that list and is not any more — see
 * `CustomerShipmentAgent` below, and the backend's ADR-A06. What replaced a
 * blanket refusal is a narrow window, not an opening.
 */
export type CustomerShipmentStatus =
  | "preparing"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "delivery_failed";

/**
 * The delivery company, as its customer sees it.
 *
 * The platform's shared `AgencyIdentity` block — byte-identical to the one the
 * agent and agency surfaces serve, rather than a customer-only projection.
 *
 * The support lines are the agency's own published business contacts and are
 * meant to be shown: a customer with a question about this parcel contacts the
 * *agency*, which is the whole reason there is no agent phone number below.
 */
export interface CustomerShipmentAgency {
  id: string;
  /** The same string as `CustomerShipment.agencyName`. `''` for an unfilled magazin. */
  name: string;
  /** **Not a URL string.** `null` is the common case — draw initials from `name`. */
  logo: FileRef | null;
  supportPhone: string | null;
  supportEmail: string | null;
  supportWhatsapp: string | null;
}

/**
 * Who is carrying the parcel, while they are carrying it (backend ADR-A06).
 *
 * Three fields and no more. In particular **no phone number, and there will not
 * be one** — do not render a "call your courier" affordance; the agency's
 * `supportPhone` is the contact path, because that is a business line its owner
 * chose to publish and an agent's handset is not.
 *
 * ⚠ Render this from the field, **never** from the status. `delivery_failed`
 * carries an agent when it maps from the internal `failed` (a retryable attempt
 * — same courier, still holding the parcel, coming back) and `null` when it
 * maps from `returned`, and the customer vocabulary collapses both into that
 * one word, so the status cannot tell them apart.
 *
 * ⚠ `delivered` returns `null` on purpose. The disclosure is scoped to a live
 * delivery and not stamped into order history, so this must never be cached
 * into a local order record.
 */
export interface CustomerShipmentAgent {
  /** Partial by design — "Jean T.", never the full legal name. */
  displayName: string;
  /** `null` is common. */
  photo: FileRef | null;
  /**
   * The customer-facing status from which this block appears, echoed on the
   * wire so the UI can explain the wait without hardcoding the policy.
   *
   * ⚠ It is `shipped`, not `out_for_delivery`. Those are the same English
   * phrase and different things here: this API's `out_for_delivery` maps from
   * the internal `agent_delivered`, i.e. the courier has already reported the
   * handover. Naming them only from there would show a customer who came to
   * their door *after* they came.
   */
  visibleFrom: CustomerShipmentStatus;
}

export interface CustomerShipment {
  id: string;
  status: CustomerShipmentStatus;
  /** `null` on shipments predating the generator. Published from creation, not delivery. */
  trackingNumber: string | null;
  /**
   * The delivery company's business name. Never the agent's.
   *
   * Duplicated inside `agency.name` and kept here because it shipped first and
   * is already consumed. The two never disagree — the server reads this off the
   * same block — and both go `null` on the same condition: no magazin on file.
   */
  agencyName: string | null;
  /** Identity and support contacts for the company above. `null` with `agencyName`. */
  agency: CustomerShipmentAgency | null;
  /** `null` before an agent is bound, and `null` again once settled. See the type. */
  agent: CustomerShipmentAgent | null;
  /** Which order lines are in this parcel, so the UI can group them. */
  itemIds: string[];
  statusHistory: { status: CustomerShipmentStatus; at: string }[];
  /** Always `null` today — nothing in the platform estimates a delivery date. */
  estimatedDelivery: string | null;
  failedAttempts: number;
}

/**
 * A checkout group — the customer's idea of "one order". A cart holding several
 * vendors' items splits into one `CustomerOrder` per vendor at checkout; they
 * all share this `cartId` and are paid for once.
 */
export interface OrderGroup {
  cartId: string;
  createdAt: string;
  currency: string;
  totalAmount: number;
  orderCount: number;
  paymentStatus: GroupPaymentStatus;
  orders: CustomerOrder[];
}

// ─── Notifications ───────────────────────────────────────────────────────────

export type NotificationAggregate = "booking" | "order" | "shipment" | "payment";

export interface CustomerNotification {
  _id: string;
  type: string;
  title: string;
  message: string;
  aggregateType: NotificationAggregate;
  aggregateId: string;
  action?: { label: string; path: string; url?: string };
  deliveredVia: ("in-app" | "email" | "telegram" | "whatsapp" | "push")[];
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

/**
 * Preferences gate **progress reporting only**. Money notifications (payment
 * received, refunds, balance due) and cancellations always send and cannot be
 * switched off — render those as fixed, not as toggles.
 */
export interface NotificationTogglePreferences {
  bookingUpdates: boolean;
  bookingReminders: boolean;
  orderUpdates: boolean;
  marketing: boolean;
}

/**
 * At most ONE secondary channel may be on; enabling one disables the other two,
 * server-side. The `*Verified` flags are computed live and are authoritative —
 * enabling an unverified channel fails with
 * `CUSTOMER_NOTIFICATION_CHANNEL_NOT_VERIFIED`.
 */
export interface NotificationPreferences {
  emailEnabled: boolean;
  telegramEnabled: boolean;
  whatsappEnabled: boolean;
  emailVerified: boolean;
  telegramVerified: boolean;
  whatsappVerified: boolean;
  preferences: NotificationTogglePreferences;
}

export interface UpdateNotificationPreferencesPayload {
  emailEnabled?: boolean;
  telegramEnabled?: boolean;
  whatsappEnabled?: boolean;
  preferences?: Partial<NotificationTogglePreferences>;
}

// ─── Digital entitlements ────────────────────────────────────────────────────

export interface DigitalEntitlement {
  id: string;
  orderId?: string;
  productId?: string;
  productTitle?: string;
  variantId?: string;
  variantName?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  downloadsUsed: number;
  downloadsRemaining: number | null;
  maxDownloads: number | null;
  expiresAt: string | null;
  revoked: boolean;
  canDownload: boolean;
  createdAt?: string;
}

/** `POST /api/digital/download-links` — the `url` is single-use, so mint one per click. */
export interface DownloadLink {
  url: string;
  expiresAt: string;
  downloadsRemaining: number | null;
}

// ─── Cart ────────────────────────────────────────────────────────────────────

/**
 * One line of the server cart. Contract: `api-doc/customer/cart.md`.
 *
 * `optionsSnapshot` is the variant's `optionSignature` frozen at add time. It is
 * a **display** string and nothing else: renaming an option value deliberately
 * does not rewrite it, so a stale one is normal and must never be used to look a
 * variant up. `variantId` is the key.
 */
export interface ServerCartItem {
  variantId: string;
  sku: string;
  variantTitle: string;
  optionsSnapshot?: string;
  productId: string;
  title: string;
  vendorId: string;
  productType: "physical" | "digital";
  quantity: number;
  price: number;
  currency: string;
}

/**
 * The whole cart.
 *
 * ⚠️ **One cart per customer, holding one product type.** `CartSchema.userId` is
 * uniquely indexed, so there is no second cart to put an e-book in while a dress
 * is in this one — adding the other type answers `409 CART_MIXED_PRODUCT_TYPES`.
 *
 * An empty cart has no `cartId` and no `productType`; it is not a 404.
 */
export interface ServerCart {
  cartId?: string;
  userId: string;
  productType?: "physical" | "digital";
  items: ServerCartItem[];
  totalItems: number;
}

/** Why a line could not be carried over at sign-in. Surface these; do not swallow them. */
export type CartDropReason =
  | "PRODUCT_UNAVAILABLE"
  | "PRODUCT_TYPE_CONFLICT"
  | "DIGITAL_LIMIT_REACHED"
  | "SERVICE_NOT_ALLOWED"
  | "SERVER_CART_KEPT";

export interface CartDroppedLine {
  variantId: string;
  reason: CartDropReason;
}

export interface MergeCartResult {
  cart: ServerCart;
  dropped: CartDroppedLine[];
}

export interface CartQuoteVendorLine {
  vendorId: string;
  subtotal: number;
  delivery: number;
  absorbedByVendor: number;
}

/**
 * `POST /api/customer/cart/quote`.
 *
 * ⚠️ **`delivery` is 0 and `total` is the subtotal — that is the truth, not a
 * stub.** The agency's delivery fee is real and is charged, but to the *vendor*:
 * `splitOrder` computes `vendorNet = gross − commission − deliveryTotal`. Adding
 * it to the customer's total would collect it twice.
 *
 * `absorbedByVendor` is what the seller pays, reported so the UI can say
 * "delivery included" and mean it. It is an **estimate** and `null` when it
 * could not be computed (a digital cart, or an agency with no pricing policy) —
 * deliberately distinct from `0`. Never add it to a total.
 *
 * `tax` and `discount` are pinned zeros: there is no tax engine and no coupon
 * model. They are present so the receipt does not change shape the day either
 * arrives.
 */
export interface CartQuote {
  currency: string;
  subtotal: number;
  delivery: number;
  absorbedByVendor: number | null;
  tax: number;
  discount: number;
  total: number;
  perVendor: CartQuoteVendorLine[];
}
