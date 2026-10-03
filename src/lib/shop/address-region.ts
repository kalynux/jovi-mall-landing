/**
 * `400 ADDRESS_REGION_INVALID` — the address's region must be one of its
 * country's regions (2026-10-02, `api-doc/customer/profile.md` → Region).
 *
 * `geo.components.region` is what delivery agencies' coverage is matched
 * against. The server reads it leniently ("Centre Region", "Région du Centre"
 * and the city "Yaoundé" all resolve to Centre) and only refuses when neither
 * the region nor the city names anything. The refusal carries the country's
 * regions, and the fix is to resend the SAME request with
 * `geo.components.region` set to the picked `key`.
 *
 * Pure on purpose — no JSX, no `ApiError` import — so `npm test` can load it.
 */
import type {
  AddressRegionInvalidDetails,
  AllowedRegion,
  GeoAddress,
} from "./customer.types";

/**
 * The refusal's `details`, or `null` when `error` is anything else.
 *
 * Duck-typed against `{ code, details }` rather than `instanceof ApiError`, and
 * strict about `allowedRegions`: without a list there is no picker to build, and
 * the caller should fall back to the plain error message.
 */
export function regionInvalidDetails(error: unknown): AddressRegionInvalidDetails | null {
  if (!error || typeof error !== "object") return null;
  const { code, details } = error as { code?: unknown; details?: unknown };
  if (code !== "ADDRESS_REGION_INVALID" || !details || typeof details !== "object") return null;
  const d = details as Partial<AddressRegionInvalidDetails>;
  if (!Array.isArray(d.allowedRegions)) return null;
  const allowedRegions = d.allowedRegions.filter(
    (r): r is AllowedRegion => Boolean(r) && typeof r === "object" && typeof r.key === "string" && r.key !== "",
  );
  if (allowedRegions.length === 0) return null;
  return {
    region: typeof d.region === "string" ? d.region : null,
    city: typeof d.city === "string" ? d.city : null,
    countryCode: typeof d.countryCode === "string" ? d.countryCode : "",
    ...(typeof d.addressId === "string" && d.addressId ? { addressId: d.addressId } : {}),
    allowedRegions,
  };
}

/**
 * A region's name in the shopper's language. Only `en` and `fr` are written, so
 * es, pt and ar read the English name — the same canonical name the server
 * stores and every saved address displays afterwards.
 */
export function regionLabel(region: AllowedRegion, locale: string): string {
  const lang = locale.split("-")[0] as keyof AllowedRegion["name"];
  return region.name?.[lang] || region.name?.en || region.key;
}

/** Picker options, sorted by label in the shopper's language. */
export function regionOptions(
  regions: readonly AllowedRegion[],
  locale: string,
): { value: string; label: string }[] {
  return regions
    .map((r) => ({ value: r.key, label: regionLabel(r, locale) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));
}

/**
 * The same `geo` with `components.region` set to the picked key — the server
 * accepts keys and stores the canonical name.
 *
 * `resolved_at` is dropped: it is server-assigned and not part of the write
 * shape, and a saved address read back from the profile carries it.
 */
export function withRegion<G extends GeoAddress>(geo: G, regionKey: string): G {
  const { resolved_at: _resolvedAt, ...rest } = geo;
  void _resolvedAt;
  return {
    ...rest,
    components: { ...geo.components, region: regionKey },
  } as G;
}
