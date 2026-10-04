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

import type { FileDetail } from "./shop.types";
import type { PaymentInstructions } from "./payments.api";

/**
 * A resolved uploaded file - the single way the backend surfaces any file
 * reference, never a bare URL string.
 *
 * This is the **same wire shape** as the storefront's `FileDetail`, built by the
 * same backend resolver, so it is now that type rather than a second declaration
 * of it. The two were written independently before the marketing and account
 * halves of this app met, and keeping both is how one of them ends up missing a
 * field - which is exactly what happened when the backend added `access`.
 *
 * 🔴 `url` is `string | null`. Read it through `publicUrl()`, not directly.
 */
export type FileRef = FileDetail;

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

/**
 * The profile's `savedPaymentMethods[]` items. Since 2026-09-30 the profile
 * carries the same object as `/api/me/payment-methods` — kept as an alias so
 * the profile type still says where it came from.
 */
export type ProfilePaymentMethod = SavedPaymentMethod;

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

/** What a saved method is. `CARD` and `BANK_TRANSFER` occur on rows saved before 2026-09-30 only. */
export type SavedMethodKind = "MOBILE_MONEY" | "CARD" | "BANK_TRANSFER";

/** The networks a wallet can be SAVED on. The same values a charge sends as `provider`. */
export type SavedWalletProvider = "MTN" | "ORANGE" | "MOOV";

/**
 * One saved method, as every read returns it — the list, the default, the save
 * answer, and the profile's `savedPaymentMethods[]`.
 *
 * Note what is *not* here: the full phone number. The server never returns it,
 * on any endpoint — only `maskedPhone` and `last4`. So a payment form that
 * wants the number pre-filled reads it from `lib/shop/wallet-numbers`, the copy
 * this device kept when the wallet was saved, checked against `last4`.
 */
export interface SavedPaymentMethod {
  id: string;
  /**
   * The same vocabulary as the charge `provider`. `CARD` (an old saved card)
   * and `null` (an old wallet whose network is unknown) are listed and
   * deletable, but never pre-selected for a payment.
   */
  provider: SavedWalletProvider | "CARD" | null;
  kind: SavedMethodKind;
  /** Server-written list text, e.g. `MTN Mobile Money · ••••4417`. */
  label: string;
  /** `+2376••••4417`. `null` for a card, and for an old row whose number is unknown. */
  maskedPhone: string | null;
  last4: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * `POST /api/me/payment-methods` — strict: any other key is refused with
 * `400 VALIDATION_ERROR`, and so is `CARD`. Wallets only.
 */
export interface AddPaymentMethodPayload {
  provider: SavedWalletProvider;
  /** E.164. */
  phoneNumber: string;
  /** 1–100 chars. Omit it and the server writes `MTN Mobile Money · ••••4417`; never send "". */
  label?: string;
  isDefault?: boolean;
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
  /*
   * `freeDelivery` was REMOVED on 2026-10-03 (ADR-A11): free delivery is the
   * shop's setting, decided per vendor order — see `CustomerOrder.deliveryPayer`.
   */
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
  /** The cash to hand over: `itemsAmount + deliveryFeeAmount`. */
  expectedAmount: number;
  /**
   * `delivery_fee` — the goods were paid online and only the delivery fee is
   * cash (checkout's `cash_to_rider`, ADR-A11 W-F); `itemsAmount` is then 0.
   * `order` (or absent, on an older API) — cash on delivery for the goods.
   */
  kind?: "order" | "delivery_fee";
  /** The goods' share of `expectedAmount`. Absent before 2026-10-04. */
  itemsAmount?: number;
  /** The delivery fee's share of `expectedAmount` — 0 when the shop pays delivery. */
  deliveryFeeAmount?: number;
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
  /**
   * The vendor's `kyc_details.legit_verified`, read live — not the verdict at the
   * time of the order. **Absent** on an API older than 2026-09-27: no badge then.
   */
  verified?: boolean;
}

/**
 * What the order was actually charged.
 *
 * `tax` and `discount` are pinned zeros — no tax engine, no coupon model — and
 * these are the same figures `POST /cart/quote` returns, written at checkout so
 * the quote and the charge cannot diverge.
 */
export interface OrderPriceBreakdown {
  /** The items. */
  base: number;
  /**
   * What the customer paid for delivery on this order (ADR-A11) — 0 when the
   * shop delivered free, and 0 on a `cash_to_rider` order (see `deliveryCash`).
   * Absent on an API older than 2026-10-04.
   */
  delivery?: number;
  /**
   * The delivery fee(s) handed to the rider in cash on a `cash_to_rider` order —
   * NOT in `delivery` nor in `total`. 0 on every other order.
   */
  deliveryCash?: number;
  tax: number;
  discount: number;
  /** `base + delivery` — what was charged online, or will be collected (COD). */
  total: number;
}

/** Who paid a vendor order's delivery. `vendor` is free delivery for the customer. */
export type DeliveryPayer = "vendor" | "customer";

/**
 * Why. The first two are free for the customer; the last three mean the
 * customer pays (`cap_fallback`: a free-delivery shop whose part of the basket
 * was too small to carry its fee).
 */
export type DeliveryPayerReason =
  | "shop_always"
  | "shop_threshold_met"
  | "shop_never"
  | "threshold_not_met"
  | "cap_fallback";

/** How a customer-paid delivery fee is paid (checkout's `deliveryFeePayment`). */
export type DeliveryFeePayment = "with_order" | "cash_to_rider";

/** One parcel's customer-facing delivery fee. */
export interface OrderDeliveryFee {
  shipmentId: string;
  /** What the customer paid for this parcel's delivery — 0 when the shop paid. */
  amount: number;
  /**
   * The GROSS delivery money that became the customer's on this parcel (a
   * returned parcel's unspent fee, a fee lowered after payment). Present only
   * when > 0. It does not shrink once returned — `deliveryFeeRefund.owed` is
   * the "still owed" figure.
   */
  customerFeeRefundable?: number;
  /** `true` on a parcel whose fee goes to the rider in cash; absent otherwise. */
  paidInCash?: boolean;
}

export interface CustomerOrder {
  id: string;
  orderNumber: string;
  vendorId: string;
  /** Prefer this over `vendorId` for anything a customer reads. */
  store?: OrderStore;
  cartId?: string | null;
  orderType: OrderType;
  /** What was charged online (or will be collected, COD) — delivery included. */
  total: number;
  currency: string;
  priceBreakdown?: OrderPriceBreakdown;
  /*
   * ── Delivery (ADR-A11, 2026-10-04) ── all optional: an older API sends none,
   * and that must read as "nothing to say" rather than as a free delivery.
   */
  /** `null` on a digital order. */
  deliveryPayer?: DeliveryPayer | null;
  deliveryPayerReason?: DeliveryPayerReason | null;
  /** One entry per parcel; `[]` on a digital order. */
  deliveryFees?: OrderDeliveryFee[];
  /** `null` on a digital order. */
  deliveryFeePayment?: DeliveryFeePayment | null;
  /** Cash still to hand the rider(s) on a `cash_to_rider` order; 0 otherwise. */
  amountDueToRider?: number;
  /** The checkout 201 only: this order's delivery fee(s) going to the rider in cash. */
  deliveryCashToRider?: number;
  /**
   * Delivery money owed back: `owed` has not reached the customer yet (in flight,
   * or waiting for our team to send it by hand), `returned` has. `null` when
   * nothing was ever owed.
   */
  deliveryFeeRefund?: { owed: number; returned: number } | null;
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
  /**
   * The escrow-release gate — and the **only** thing that says whether this order
   * has already been confirmed.
   *
   * 🔴 `fulfillmentStatus` cannot answer that question. Confirming stamps
   * `completion` server-side and leaves fulfilment exactly where it was —
   * `fulfilled` stays `fulfilled`, `delivered` stays `delivered` — so a re-read
   * after a successful confirm returns a body identical to the one before it.
   * Gating a confirm action on fulfilment alone therefore offers it forever, into
   * a guaranteed `409 EARNINGS_ALREADY_COMPLETED`. That shipped; see
   * `canConfirmDelivery`.
   *
   * Optional only so a client running against a backend older than this field
   * degrades to the previous behaviour rather than crashing — treat `undefined`
   * as "not confirmed", which is what it used to mean implicitly.
   */
  completion?: OrderCompletion;
}

/**
 * When an order was completed, and by which path.
 *
 * ⚠ `confirmedBy` is **not** "who clicked". A COD order completes as `customer`
 * when the *agent* enters the customer's delivery code — the code is the
 * customer's act, performed through someone else's handset. `system` is the
 * auto-confirm sweep that fires when the confirmation window elapses.
 *
 * So `auto` is the field to word copy from: it separates a real confirmation from
 * an elapsed window, which `confirmedBy` does not.
 */
export interface OrderCompletion {
  /** ISO 8601, or `null` while the order is still confirmable. */
  confirmedAt: string | null;
  confirmedBy: "customer" | "system" | null;
  auto: boolean;
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
  /**
   * The agency's `kyc_details.legit_verified` — an administrator's verdict, never
   * the documents behind it. **Absent** on an API older than 2026-09-27.
   */
  verified?: boolean;
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
  /**
   * `kyc.status === "verified"` on the agent — a platform verdict, and the one
   * addition to ADR-A06's three fields because it discloses nothing personal.
   * **Absent** on an API older than 2026-09-27.
   */
  verified?: boolean;
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

/**
 * The subject areas a customer notification can be about.
 *
 * `ticket` arrived with GAP-012 and was missing here, so a customer already
 * receiving support notifications had no way to filter to them and every such
 * row fell through to the generic icon.
 */
export type NotificationAggregate =
  | "booking"
  | "order"
  | "shipment"
  | "payment"
  | "ticket"
  /** `account.closure_requested` (ADR-A10); `aggregateId` is the request's id. */
  | "account";

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
  /**
   * ⚠ **Can be missing on a perfectly valid entitlement.**
   *
   * It is resolved by `populate` from the product, and an entitlement is never
   * removed with its product — somebody who bought a file keeps the right to
   * download it after the seller withdraws the listing. So a purchase from a
   * year ago can arrive with no title at all. Same for {@link variantName}.
   *
   * Fall back to `fileName`, which comes off the asset itself and therefore
   * survives: it is the one name that cannot disappear.
   */
  productTitle?: string;
  variantId?: string;
  /** Missing whenever the variant was deleted since purchase — see `productTitle`. */
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

/**
 * `POST /api/digital/download-links` — the `url` is single-use, so mint one per click.
 *
 * The backend sends `url` as a bare path (`/api/digital/download/<token>`);
 * `createDownloadLink` prefixes the API base before returning it, so what
 * arrives here is absolute and safe to navigate to.
 */
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
  /**
   * Set when this line's price was **haggled in chat**, and equal to `price`.
   *
   * It exists so the line can be labelled *"your agreed price"* rather than
   * *"price"* — it is **not** a second number. Never compute a total from it;
   * `price` is the total's input, and the two are the same integer anyway.
   *
   * ⚠ **Omitted entirely when absent — never `null`.** The test is
   * `"negotiatedUnitPrice" in item`, not a truthiness check, because a price of
   * zero is not the same fact as no negotiation.
   */
  negotiatedUnitPrice?: number;
  /**
   * The lock this line will spend at checkout. Opaque — do not parse it.
   *
   * The storefront never mints one and never sends one: bargaining happens in
   * WhatsApp or Telegram, the bargaining agent mints the lock, and the bot puts
   * the line in this cart. All this client does is read it, render what came
   * back, and translate the refusals.
   */
  negotiationLockRef?: string;
}

/**
 * Does this line carry a price the customer agreed in chat?
 *
 * A key test rather than a truthiness one, for the reason on
 * {@link ServerCartItem.negotiatedUnitPrice}: the fields are omitted when
 * absent, so `undefined` and "not negotiated" are the same state and a falsy
 * check on the number would also swallow a legitimate zero.
 */
export function isNegotiatedLine(item: ServerCartItem): boolean {
  return "negotiatedUnitPrice" in item && item.negotiatedUnitPrice !== undefined;
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

/**
 * A shop's free-delivery terms as the quote applies them to this basket.
 * `null` (the whole object) for a digital-only shop.
 */
export interface QuoteFreeDelivery {
  mode: "always" | "never" | "above";
  freeAboveAmount: number | null;
  /**
   * How much more FROM THIS SHOP would make delivery free. `null` when delivery
   * is already free, the shop never delivers free, or no basket size can.
   */
  shortfall: number | null;
}

/** Why the delivery fee cannot go to the rider in cash. */
export type DeliveryFeeCashReason =
  | "cash_on_delivery"
  | "not_customer_paid"
  | "no_delivery_fee"
  | "agency_declines_cash";

/**
 * "Pay the items now, the delivery fee in cash to the rider" (ADR-A11 W-F).
 * Both amounts are the server's — display them, never compute them.
 */
export interface DeliveryFeeCashQuote {
  available: boolean;
  reason: DeliveryFeeCashReason | null;
  /** Charged online now, if chosen. */
  amountDueOnline: number;
  /** Cash for the rider(s), if chosen. */
  amountDueToRider: number;
}

export interface CartQuoteVendorLine {
  vendorId: string;
  subtotal: number;
  /** What the customer pays for THIS shop's delivery — 0 when the shop pays. */
  delivery: number;
  /*
   * ── ADR-A11 (2026-10-04) — optional: an older API sends none of these ──
   */
  /** `subtotal + delivery`. */
  total?: number;
  /** `vendor` (free delivery) · `customer` · `null` for a digital-only shop. */
  deliveryPayer?: DeliveryPayer | null;
  deliveryPayerReason?: DeliveryPayerReason | null;
  freeDelivery?: QuoteFreeDelivery | null;
  /** `null` for a digital shop. */
  deliveryFeeCash?: DeliveryFeeCashQuote | null;
  /** Internal — what a free-delivery shop pays its agencies. **Never show it.** */
  absorbedByVendor: number;
  /**
   * Whether this shop's part of the basket can carry its delivery cost
   * (ADR-A07). `met: false` means checkout will refuse with
   * `ORDER_BELOW_DELIVERY_MINIMUM`. `null` means NOT EVALUATED — a digital-only
   * shop, or an estimate the server could not make; checkout still decides.
   */
  deliveryMinimum: DeliveryMinimumQuote | null;
}

/** The payment method a quote's delivery minimum is evaluated for. */
export type QuotePaymentMethod = "online" | "cash_on_delivery";

/** Why a delivery-minimum unit failed. `null` on a unit that passed. */
export type DeliveryMinimumReason = "delivery_cost_ratio" | "vendor_net_not_positive";

/**
 * One unit the minimum was checked over: the whole shop online
 * (`agencyId: null`), one delivery agency's items for cash on delivery.
 */
export interface DeliveryMinimumUnit {
  agencyId: string | null;
  subtotal: number;
  met: boolean;
  reason: DeliveryMinimumReason | null;
  /**
   * ⚠ `null` when NO basket size passes (the agency's COD fee alone is too
   * high) — and then `shortfall` is `0` although `met` is false. Test `met`,
   * never `shortfall > 0`.
   */
  minimumSubtotal: number | null;
  shortfall: number;
}

export interface DeliveryMinimumQuote {
  met: boolean;
  /** `order` for an online payment, `shipment` for cash on delivery. */
  checkedPer: "order" | "shipment";
  maxDeliveryPercent: number;
  /** How much more is needed from THIS shop in total; 0 when met. */
  shortfall: number;
  units: DeliveryMinimumUnit[];
}

/**
 * `details` of `422 ORDER_BELOW_DELIVERY_MINIMUM` — the first failing unit.
 * Deliberately no commission, fee or vendor net: those are the vendor's terms.
 */
export interface DeliveryMinimumErrorDetails {
  vendorId: string;
  scope: "order" | "shipment";
  agencyId: string | null;
  subtotal: number;
  minimumSubtotal: number | null;
  shortfall: number;
  maxDeliveryPercent: number;
  reason: DeliveryMinimumReason;
  currency: string;
}

/** One of a country's regions, as `ADDRESS_REGION_INVALID` lists them. */
export interface AllowedRegion {
  /** What to send back as `geo.components.region`, e.g. `"far_north"`. */
  key: string;
  /** Only `en` and `fr` are written; other locales fall back to `en`. */
  name: { en: string; fr: string };
}

/**
 * `details` of `400 ADDRESS_REGION_INVALID` (2026-10-02,
 * `api-doc/customer/profile.md` → Region). Neither `geo.components.region` nor
 * the city names a region of the address's country. Raised by
 * `POST`/`PATCH /customer/addresses` and by checkout; only an address with
 * `geo` is checked.
 */
export interface AddressRegionInvalidDetails {
  /** What was sent, so the copy can quote it. */
  region: string | null;
  city: string | null;
  countryCode: string;
  /** Present when a SAVED address is the culprit: a PATCH, or checkout. */
  addressId?: string;
  allowedRegions: AllowedRegion[];
}

/**
 * `POST /api/customer/cart/quote`.
 *
 * ── Delivery is each shop's setting (ADR-A11, 2026-10-04) ────────────────────
 *
 * Until then every shop paid delivery and `delivery` was always 0. Now a shop
 * delivers free `always`, `never`, or `above` an amount of its own items, and
 * where the customer pays, `delivery` is the real fee and **`total` already
 * includes it** — `total` is exactly what checkout charges. Render the per-shop
 * `perVendor[].delivery` lines and `total`; never add, subtract or sum anything
 * here, and never show `absorbedByVendor` (it is what free-delivery shops pay
 * their agencies — internal, and `null` for a digital cart).
 *
 * The quote is an estimate: `regionKnown: false` means it was priced without a
 * drop-off region, so the fee can rise once an address is chosen. Re-quote with
 * `deliveryAddressId`; checkout prices with the same function and is the
 * authority.
 *
 * `tax` and `discount` are pinned zeros: there is no tax engine and no coupon
 * model. They are present so the receipt does not change shape the day either
 * arrives.
 *
 * `meetsDeliveryMinimum: false` means checkout will refuse one shop's items —
 * rare since ADR-A11 (a free-delivery shop that cannot carry its fee falls back
 * to customer-paid delivery instead). It depends on `paymentMethod`, so
 * re-quote when the shopper switches method.
 */
export interface CartQuote {
  currency: string;
  subtotal: number;
  /** Σ the shops' `delivery` — already inside `total`. */
  delivery: number;
  /** Internal. Never show it, never add it to anything. */
  absorbedByVendor: number | null;
  tax: number;
  discount: number;
  /** `subtotal + delivery` — exactly what checkout charges. */
  total: number;
  paymentMethod: QuotePaymentMethod;
  meetsDeliveryMinimum: boolean;
  /** `false` ⇒ priced in-region, without a drop-off; the fee may rise. Absent on an older API. */
  regionKnown?: boolean;
  /**
   * Whether this checkout may pay the items online and the delivery fee in cash
   * to the rider. Offer the choice only while `available`. Absent on an older API.
   */
  deliveryFeeCash?: DeliveryFeeCashQuote & {
    /** The shops whose delivery would be paid in cash. */
    vendorIds: string[];
  };
  perVendor: CartQuoteVendorLine[];
}

// ─── Delivery-fee changes after checkout (ADR-A11 W-E) ───────────────────────

/** What the customer may do with a proposal. Render only these. */
export type DeliveryFeeProposalAction = "approve" | "reject" | "pay";

/**
 * A change to one parcel's delivery fee — `GET /api/customer/orders/:id/delivery-fee-proposals`.
 *
 * A decrease is `approved` the moment it is created (nothing to answer). An
 * increase waits for the customer, and the parcel cannot be picked up until it
 * is answered — and, online, paid.
 */
export interface DeliveryFeeProposal {
  id: string;
  shipmentId: string;
  orderId: string;
  /** `platform` is a change of delivery company made by the shop. */
  raisedBy: "delivery_company" | "platform";
  origin: "agency" | "change_agency" | "combined_request";
  direction: "increase" | "decrease" | null;
  currency: string;
  feeBefore: number;
  proposedFee: number;
  /** Free text from the delivery company. Vendor/agency-written — show as is. */
  reason: string | null;
  status: "pending" | "approved" | "rejected" | "withdrawn";
  /** Send back the one you displayed; a `409` means it moved. */
  version: number;
  /** Set once an ONLINE increase is approved: the difference to pay. */
  topup: { amount: number; status: "awaiting_payment" | "paid"; paidAt: string | null } | null;
  availableActions: DeliveryFeeProposalAction[];
  respondedAt: string | null;
  createdAt: string;
}

export interface DeliveryFeeRefundEntry {
  amount: number;
  status: "processing" | "completed" | "manual_required" | "failed";
  cause: string;
  createdAt: string;
  settledAt: string | null;
  /** A `completed` entry our team sent by hand. */
  settledByHand: boolean;
}

export interface OrderDeliveryFees {
  currency: string;
  proposals: DeliveryFeeProposal[];
  shipments: {
    shipmentId: string;
    status: string;
    deliveryPayer: DeliveryPayer;
    /** What the delivery company is paid. */
    fee: number;
    /** Online: what the customer has paid for it. COD: the cash they will hand over. */
    customerFee: number;
    pendingProposalId: string | null;
  }[];
  refunds: {
    /** Not back with the customer yet — `awaitingManual` included. */
    owed: number;
    returned: number;
    /** The part our team must send by hand: "on its way", not "owed". */
    awaitingManual: number;
    entries: DeliveryFeeRefundEntry[];
  };
}

/** `POST …/delivery-fee-proposals/:proposalId/pay` — answers like `POST /payments/initiate`. */
export interface DeliveryFeeTopupPayment {
  transactionId: string;
  status: string;
  instructions?: PaymentInstructions;
  amount: number;
  currency: string;
  proposalId: string;
  message?: string;
}

// ─── Combined delivery price (ADR-A11 D-8) ───────────────────────────────────

export interface CombinedDeliveryRequest {
  id: string;
  cartId: string;
  agencyId: string;
  currency: string;
  status: "open" | "answered" | "declined" | "cancelled";
  note: string | null;
  shipments: { shipmentId: string; orderId: string; feeAtRequest: number }[];
  answer: {
    fees: { shipmentId: string; feeBefore: number; feeAfter: number; proposalId: string }[];
    saving: number;
    note: string | null;
    answeredAt: string;
  } | null;
  declineNote: string | null;
  createdAt: string;
  closedAt: string | null;
}
