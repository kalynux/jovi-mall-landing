/**
 * The map's tile source — the one part of the live delivery map that is
 * configuration rather than code.
 *
 * ── Why this is an env var and not a hardcoded provider ──────────────────────
 *
 * Raster tiles are somebody's bandwidth. OpenStreetMap's own tile servers are
 * keyless and free, and their usage policy asks commercial apps not to use them;
 * Carto, MapTiler and Stadia will serve a storefront happily but want an account
 * and a domain-restricted key. Which of those Wi-Mall uses is a deployment
 * decision with a bill attached, and it is not one this repository can make.
 *
 * So the tile URL is a template read from the environment, exactly as
 * `NEXT_PUBLIC_GEO_TRACKER_URL` is:
 *
 *   unset  →  no map is rendered at all, and the tracking panel is what it was
 *             before this existed — ETA, distance, last update, and a handoff to
 *             the device's own map app. Nothing looks broken.
 *   set    →  the map renders, from whichever provider the template points at.
 *
 * Any XYZ template works, including Leaflet's `{s}` subdomain and `{r}` retina
 * placeholders and a provider key in the query string:
 *
 *   https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
 *   https://api.maptiler.com/maps/streets-v2/{z}/{x}/{y}{r}.png?key=…
 *   https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png
 *
 * ⚠ These are `NEXT_PUBLIC_`, so they are inlined into the bundle and shipped to
 * every visitor. A tile key in one of them is public by construction — which is
 * what domain restriction on the provider's side is for. Do not put a key here
 * that is not domain-restricted.
 */

/** The XYZ tile template. Empty means "no map" — the intended default. */
export const MAP_TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL ?? "";

/**
 * Optional second template for dark mode.
 *
 * The shop has a real dark theme (`html.dark`), and a daylight map inside a dark
 * card is the one thing on the page still emitting light. With this set the tile
 * layer swaps templates when the theme flips. With it unset the light tiles are
 * inverted in CSS instead — a good-enough approximation for street tiles and a
 * poor one for imagery, which is exactly why this override exists.
 */
export const MAP_TILE_URL_DARK = process.env.NEXT_PUBLIC_MAP_TILE_URL_DARK ?? "";

/**
 * Attribution HTML for the tile layer.
 *
 * 🔴 **Practically every provider requires this, including OSM.** It is a
 * separate variable because it belongs to the same decision as the URL and is
 * wrong to guess: the correct string for Carto is not the correct string for
 * MapTiler. Leaflet still shows its own "Leaflet" credit either way.
 */
export const MAP_TILE_ATTRIBUTION = process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ?? "";

/**
 * How far the provider will zoom in. Past its real maximum a tile server answers
 * 404 and the map goes grey, so this is a guard rail rather than a preference —
 * OSM stops at 19, several vector-derived raster sets go to 20, some stop at 18.
 */
export const MAP_MAX_ZOOM = readZoom(process.env.NEXT_PUBLIC_MAP_TILE_MAX_ZOOM, 19);

/**
 * Whether a map can be drawn at all.
 *
 * Read at the call site to decide whether the map component is even imported —
 * the Leaflet chunk should not be fetched by a build that has nowhere to fetch
 * tiles from.
 */
export const HAS_MAP_TILES = MAP_TILE_URL.length > 0;

/**
 * The map's height in pixels.
 *
 * Here rather than in the component because the panel has to reserve exactly
 * this much space while the Leaflet chunk is still downloading, and it cannot
 * import the component to ask — that would load the chunk it is waiting for.
 *
 * Tall enough to show a courier and a drop-off a few kilometres apart, short
 * enough not to push the parcel's status history off a phone screen.
 */
export const MAP_HEIGHT = 220;

function readZoom(raw: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(raw ?? "", 10);
  // Leaflet's own ceiling for a raster layer is 22; below 3 the whole world does
  // not fill a panel and the fit-to-bounds maths stops being meaningful.
  return Number.isFinite(parsed) && parsed >= 3 && parsed <= 22 ? parsed : fallback;
}

/** A point, in the named-field form geo-tracker broadcasts — never `[lng, lat]`. */
export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Where the parcel is going, ready to pin. */
export interface DropOff {
  point: LatLng;
  /** The human-readable address, when the snapshot carried one. */
  label: string | null;
}

/**
 * The drop-off pin, read from the order's frozen delivery address.
 *
 * ── Why this is the right source, and the only one available ─────────────────
 *
 * geo-tracker resolves its own destination by pulling `order.delivery_address`
 * from jovi-mall over an internal service token, which a customer's browser
 * cannot use — so the panel cannot ask the same question the same way. But it
 * does not need to: `deliveryAddress` on the order read is a snapshot of that
 * *same record*, geocoded and frozen at checkout, so a pin drawn from it cannot
 * drift from the ETA measured against it.
 *
 * ⚠ This is emphatically not the customer's *current* saved address. Editing a
 * saved address never rewrites a past order, which is the whole point of the
 * snapshot — and sending client-held address data to the socket as `destination`
 * would override the authoritative value. Nothing here goes on the wire; it is
 * drawn locally and only ever drawn.
 *
 * ── Why the parameter is `unknown` ───────────────────────────────────────────
 *
 * The field is `unknown` on `CustomerOrder` because the backend documents it as
 * "a GeoAddress" while old orders predate the geo module and digital orders send
 * `null`. Rather than assert a shape onto that, this validates one and returns
 * `null` for everything else — a missing pin is a normal state the map is built
 * to render.
 */
export function parseDropOff(deliveryAddress: unknown): DropOff | null {
  if (!isRecord(deliveryAddress)) return null;

  // A GeoAddress nests the point under `coordinates`; a bare GeoPoint *is* the
  // point. Both have been seen on this field, and `geo` is what the same record
  // is called everywhere it is stored.
  const source = isRecord(deliveryAddress.geo) ? deliveryAddress.geo : deliveryAddress;
  const point = toLatLng(source.coordinates) ?? toLatLng(source);
  if (!point) return null;

  const label = readString(source.formatted_address) ?? readString(deliveryAddress.formatted_address);
  return { point, label };
}

/** GeoJSON `{ type: "Point", coordinates: [lng, lat] }`, a bare pair, or neither. */
function toLatLng(value: unknown): LatLng | null {
  const pair = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.coordinates)
      ? value.coordinates
      : null;
  if (!pair || pair.length < 2) return null;

  // 🔴 GeoJSON order. Reading these the other way round puts a Douala drop-off
  // in Somalia, which is a bug that renders perfectly.
  const [longitude, latitude] = pair;
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  // Null Island is a failed geocode, not a place. Cameroon is ~4°N 9°E, so a
  // literal (0, 0) is 500 km out in the Gulf of Guinea and never a real address.
  if (latitude === 0 && longitude === 0) return null;

  return { latitude, longitude };
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
