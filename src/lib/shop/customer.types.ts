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

/** Group-level aggregate of the orders beneath it — lower-case, a different set. */
export type GroupPaymentStatus = "paid" | "awaiting_payment" | "partially_paid" | "mixed";

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

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  vendorId: string;
  orderType: OrderType;
  total: number;
  currency: string;
  paymentMethod: PaymentMethodChoice;
  paymentStatus: OrderPaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  itemCount?: number;
  createdAt?: string;
  /** COD orders only. */
  codCollections?: CodCollection[];
  /** Present on the group-detail read, absent on the list. */
  items?: OrderItem[];
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
