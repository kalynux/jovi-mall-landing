/**
 * Service listings: the shapes and the pure rules.
 * Contract: `api-doc/customer/service-listings.md`, changelog
 * `api-doc/customer/FRONTEND-CHANGELOG-service-listings.md`.
 *
 * A **service listing** is a business that is paid in person (a plumber, a
 * printer, a repairer) saying what it does and where. It sells nothing through
 * Wi-Mall, so it has no price, no cart and no order. What it has is a set of
 * contact details, and those are never public: a signed-in customer unlocks one
 * at a time with a tap. **The customer pays nothing.** The business pays
 * Wi-Mall in credits.
 *
 * ⛔ Three rules every caller inherits from that:
 *
 * - **Nothing public carries a contact, a vendor id or a map pin.** Not the
 *   card, not the detail, not search. `availableFields` holds the NAMES of the
 *   details a listing has, so the page can draw one button each. Do not try to
 *   find a value anywhere else; there is none by design.
 * - **No price, credit cost or "free" badge on a contact button.** The card
 *   carries `revealCosts`; that is the business's bill, and it is typed here
 *   only so that nobody mistakes it for something to show.
 * - **A revealed value lives in component state, on the page that asked for
 *   it.** No storage, no cache, no URL. A second unlock of the same detail
 *   within 30 days is free for the business anyway, so asking again costs no one.
 *
 * Non-React module: it returns label KEYS, never sentences (LOCALISATION.md §3).
 */
import type { FileDetail, ListMeta } from "./shop.types";
import type { IconName } from "@/components/shop/ds/Icon";

/* ─── Public reads ────────────────────────────────────────────────────────── */

/** The seven contact details, in the order the backend draws its buttons. */
export const LISTING_CONTACT_FIELDS = [
  "whatsapp",
  "phone",
  "email",
  "website",
  "socials",
  "location",
  "video",
] as const;
export type ListingContactField = (typeof LISTING_CONTACT_FIELDS)[number];

export interface ListingCategory {
  id: string;
  name: string;
  slug: string;
}

/** `kind: "listing"` tells a listing apart from a product in mixed results. */
export interface PublicListingCard {
  id: string;
  slug: string;
  kind: "listing";
  title: string;
  companyName: string;
  categories: ListingCategory[];
  /** ISO-3166-1 alpha-2. */
  country: string;
  city: string;
  /** The neighbourhood the business typed. Public on purpose. */
  area: string;
  photo: FileDetail | null;
  /** Always `null` until listing reviews ship (backend "wave 2"). */
  rating: { average: number; count: number } | null;
  /** Which buttons to draw. Names only, never a value. */
  availableFields: ListingContactField[];
  /**
   * ⛔ What the BUSINESS pays per unlock. Never render it to a customer.
   * Typed only so the field is documented rather than mysterious.
   */
  revealCosts?: { first: number; next: number };
}

export type OpeningDay =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface ListingOpeningHours {
  day: OpeningDay;
  /** "HH:MM", 24-hour. */
  openTime: string;
  closeTime: string;
  isClosed: boolean;
}

export interface PublicListingDetail extends PublicListingCard {
  description: string;
  /** Not rendered: products show their plain description too. */
  descriptionRich: unknown | null;
  photos: FileDetail[];
  /** `null` when the business gave no hours, which is not "always closed". */
  openingHours: ListingOpeningHours[] | null;
  publishedAt: string | null;
}

export interface ListingListQuery {
  q?: string;
  /** A category slug — the same `?category=` the product grid uses. */
  category?: string;
  country?: string;
  city?: string;
  area?: string;
  page?: number;
  limit?: number;
}

export interface ListingListResponse {
  data: PublicListingCard[];
  meta: ListMeta;
}

/** How many listings the shelf above the products shows (3×2, or 6 in a row). */
export const LISTING_SHELF_SIZE = 6;

export const NO_LISTINGS: ListingListResponse = { data: [], meta: { total: 0, page: 1, limit: 0, pages: 0 } };

/**
 * The shelf's query, or `null` when there is no shelf to draw: only on the
 * first page of products (page 3 of a product search is not where the listings
 * belong).
 *
 * Plain /shop gets a shelf too (the newest listings, unfiltered). It used to
 * need a search or a category, which left listings unreachable from the
 * default view: their categories have no products, so they never become a
 * chip, and nobody searches for a business they have never seen.
 */
export function shelfQuery(query: { q?: string; category?: string; page?: number }): ListingListQuery | null {
  if (query.page && query.page > 1) return null;
  return { q: query.q, category: query.category, limit: LISTING_SHELF_SIZE };
}

/* ─── The reveal ──────────────────────────────────────────────────────────── */

export type ListingSocialNetwork =
  | "facebook"
  | "instagram"
  | "tiktok"
  | "x"
  | "linkedin"
  | "youtube"
  | "other";

/** `value` by field, exactly as the contract lists them. */
export interface ListingRevealValues {
  whatsapp: { number: string; link: string };
  /**
   * Since 2026-11-08 a business may give TWO numbers (e.g. MTN and Orange),
   * unlocked by one tap for one charge. `numbers` is every number, first
   * first; `number` is always `numbers[0]`. Read through `phoneNumbers()`.
   * Optional only because an API from before that change sends `number` alone.
   */
  phone: { number: string; numbers?: string[] };
  email: { address: string };
  website: { url: string };
  socials: { links: { network: ListingSocialNetwork; url: string }[] };
  location: { address: string | null; latitude: number | null; longitude: number | null; mapUrl: string | null };
  video: { url: string; host: "youtube" | "google_drive" };
}

export type RevealedValue = {
  [F in ListingContactField]: { field: F; value: ListingRevealValues[F] };
}[ListingContactField];

/**
 * `POST /api/me/listings/:listingId/reveal`.
 *
 * `charged`, `cost` and `nextCost` describe the business's bill and are
 * deliberately left off this type, so no screen can reach for them.
 */
export type RevealResult = RevealedValue & {
  alreadyRevealed: boolean;
  windowEndsAt: string | null;
  /** True once per business, on the first unlock: ask the opt-in question. */
  askConsent: boolean;
  /** Set only when `askConsent` is. */
  consentVendorId: string | null;
};

/* ─── Consents ────────────────────────────────────────────────────────────── */

export type ListingConsentState = "granted" | "not_granted" | "revoked";

/** `GET /api/me/listing-consents` row, newest change first. */
export interface ListingConsent {
  vendorId: string;
  businessName: string;
  consent: ListingConsentState;
  granted: boolean;
  askedAt: string | null;
  grantedAt: string | null;
  revokedAt: string | null;
}

/* ─── Presentation rules (keys, not copy) ─────────────────────────────────── */

export const FIELD_ICON: Record<ListingContactField, IconName> = {
  whatsapp: "message-circle",
  phone: "phone",
  email: "mail",
  website: "globe",
  socials: "share-2",
  location: "map-pin",
  video: "play",
};

/** The row's name: "WhatsApp", "Phone", … under `shop.listings.field.*`. */
export function fieldLabelKey(field: ListingContactField): string {
  return `shop.listings.field.${field}`;
}

/**
 * The fields to draw, filtered to the seven this app knows and in the
 * backend's order. A field added backend-side later is dropped rather than
 * drawn as a button with no label or icon.
 */
export function drawableFields(fields: readonly string[] | null | undefined): ListingContactField[] {
  const have = new Set(fields ?? []);
  return LISTING_CONTACT_FIELDS.filter((field) => have.has(field));
}

/**
 * A link a business typed, made safe to put in an `href`.
 *
 * The backend validates these as http(s), but this is the one place a string
 * from a third party becomes something a tap follows, so it is checked again:
 * `javascript:` or `data:` would run in our origin.
 */
export function safeHttpUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Every number an unlocked phone carries, in the business's order: `numbers`
 * when the API sent a usable list, else the lone `number`. Blank and
 * duplicate entries are dropped, so one number is never drawn twice.
 */
export function phoneNumbers(value: ListingRevealValues["phone"]): string[] {
  const list = Array.isArray(value.numbers) && value.numbers.length > 0 ? value.numbers : [value.number];
  const seen = new Set<string>();
  return list
    .filter((n): n is string => typeof n === "string" && n.trim() !== "")
    .filter((n) => {
      const key = n.replace(/[^\d+]/g, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/** `tel:` keeps the leading + and the digits, and nothing a dialler would trip on. */
export function telHref(number: string): string {
  return `tel:${number.replace(/[^\d+]/g, "")}`;
}

/** The WhatsApp chat link: the one the API sent, or one built from the number. */
export function whatsappHref(value: ListingRevealValues["whatsapp"]): string | null {
  const sent = safeHttpUrl(value.link);
  if (sent) return sent;
  const digits = value.number.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

export function hasPin(value: ListingRevealValues["location"]): value is ListingRevealValues["location"] & {
  latitude: number;
  longitude: number;
} {
  return (
    typeof value.latitude === "number" &&
    typeof value.longitude === "number" &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude)
  );
}

/** A maps link for the pin when the API sent none. */
export function mapHref(value: ListingRevealValues["location"]): string | null {
  const sent = safeHttpUrl(value.mapUrl);
  if (sent) return sent;
  if (hasPin(value)) {
    return `https://www.google.com/maps/search/?api=1&query=${value.latitude},${value.longitude}`;
  }
  return null;
}

/** The place line on a card and the detail: "Akwa, Douala", or whichever half exists. */
export function placeParts(listing: Pick<PublicListingCard, "area" | "city">): string[] {
  return [listing.area, listing.city].map((part) => part?.trim()).filter((part): part is string => Boolean(part));
}

/* ─── Opening hours ───────────────────────────────────────────────────────── */

export const OPENING_DAYS: OpeningDay[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

/**
 * A fixed Monday, so `Intl` can name each weekday in the page's language
 * without a translation table. 2024-01-01 was a Monday.
 */
export function dayDate(day: OpeningDay): Date {
  return new Date(Date.UTC(2024, 0, 1 + OPENING_DAYS.indexOf(day), 12));
}

/** Monday first, one row per day the business described. */
export function sortedHours(hours: ListingOpeningHours[] | null | undefined): ListingOpeningHours[] {
  if (!hours?.length) return [];
  return [...hours].sort((a, b) => OPENING_DAYS.indexOf(a.day) - OPENING_DAYS.indexOf(b.day));
}

/**
 * Today's weekday where the business is. The platform day is Africa/Douala
 * (the backend's `LISTING_PLATFORM_TIMEZONE`), and every listing so far is in
 * Cameroon. Call only after hydration: the server's clock is not the reader's.
 */
export function todayIn(timeZone = "Africa/Douala", now = new Date()): OpeningDay {
  const name = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone }).format(now).toLowerCase();
  return (OPENING_DAYS as string[]).includes(name) ? (name as OpeningDay) : "monday";
}

/* ─── The "See all" page ──────────────────────────────────────────────────── */

/** How many listings one page of the "See all" view shows. */
export const LISTING_PAGE_SIZE = 24;

export interface ListingResultsQuery {
  q?: string;
  category?: string;
  page: number;
}

/** `?q`, `?category`, `?page` off a URL, bounded the way the API bounds them. */
export function parseListingSearchParams(
  params: Record<string, string | string[] | undefined>
): ListingResultsQuery {
  const one = (key: string) => {
    const raw = params[key];
    const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
    return value ? value.slice(0, 200) : undefined;
  };
  const page = Number(one("page"));
  return {
    q: one("q"),
    category: one("category"),
    page: Number.isInteger(page) && page > 0 ? Math.min(page, 500) : 1,
  };
}
