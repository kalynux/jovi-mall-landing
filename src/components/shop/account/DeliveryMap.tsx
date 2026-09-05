"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type * as Leaflet from "leaflet";

import "leaflet/dist/leaflet.css";
import "./DeliveryMap.css";

import { Button } from "@/components/shop/ds";
import {
  MAP_HEIGHT,
  MAP_MAX_ZOOM,
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_URL,
  MAP_TILE_URL_DARK,
  type DropOff,
  type LatLng,
} from "@/lib/shop/map";

/**
 * The courier on a map, for one shipment.
 *
 * ── Loaded, never imported ───────────────────────────────────────────────────
 *
 * 🔴 **Nothing may import this module statically.** Leaflet reads `window` while
 * it initialises, so it cannot be evaluated on the server or during the static
 * export the Capacitor app is built from — and it is ~150 kB that a shopper who
 * never opens an order should not pay for. `DeliveryTracking` reaches it through
 * `next/dynamic({ ssr: false })`, which is also why the default export is the
 * one this file has.
 *
 * The library itself arrives through `await import("leaflet")` inside the mount
 * effect rather than at module scope, so even the dynamic chunk is safe to
 * evaluate anywhere.
 *
 * ── Following, and getting out of the way ────────────────────────────────────
 *
 * The map re-frames itself as the courier moves, and stops the moment the
 * shopper pans or zooms — a viewport that yanks itself back every few seconds is
 * unusable, and a shopper who dragged the map did so on purpose. A "Recentre"
 * button brings the follow back. Telling *their* gestures from *ours* is what
 * `programmaticRef` is for: Leaflet fires `movestart`/`zoomstart` for both, and
 * it fires them synchronously inside the `setView`/`fitBounds` call, so a flag
 * raised around that call is enough to tell them apart.
 */
export interface DeliveryMapProps {
  /** Where the courier is, from the last `location_broadcast`. */
  courier: LatLng;
  /** When that fix was recorded — shown in the courier's popup. */
  recordedAt: string;
  /** Only when the device reported it; rotates the arrow on the courier pin. */
  headingDegrees?: number;
  /** "Jean T." — partial by design. `null` renders a generic label. */
  courierName?: string | null;
  /** The order's frozen drop-off. Absent for legacy orders, and that is fine. */
  dropOff?: DropOff | null;
}

/** How much of the courier's path to keep. At one fix every few seconds this is
 *  a few minutes of road — enough to read direction, not a route history. */
const TRAIL_LIMIT = 60;

/** Never zoom past this when framing, however close the two pins are. */
const FRAME_MAX_ZOOM = 16;

/** The zoom used when there is only a courier to look at. */
const LONE_COURIER_ZOOM = 15;

export default function DeliveryMap({
  courier,
  recordedAt,
  headingDegrees,
  courierName,
  dropOff,
}: DeliveryMapProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const leafletRef = useRef<typeof Leaflet | null>(null);
  const mapRef = useRef<Leaflet.Map | null>(null);
  const tilesRef = useRef<Leaflet.TileLayer | null>(null);
  const courierRef = useRef<Leaflet.Marker | null>(null);
  const trailRef = useRef<Leaflet.Polyline | null>(null);
  const trailPointsRef = useRef<Leaflet.LatLngTuple[]>([]);
  /** How many of our own viewport changes are still in flight. See `programmatic`. */
  const programmaticRef = useRef(0);

  /**
   * The latest props, readable from callbacks that must not be rebuilt when they
   * change: the mount effect, which runs once and still needs whatever the props
   * were *then*, and `frame`, whose identity is a dependency of the update
   * effect and so must not change every time the courier moves.
   */
  const latestRef = useRef({ courier, dropOff });
  latestRef.current = { courier, dropOff };

  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [following, setFollowing] = useState(true);

  /**
   * Run a viewport change that must not count as the shopper taking over.
   *
   * 🔴 **The flag cannot be released when `run` returns.** Leaflet fires
   * `movestart`/`zoomstart` synchronously for a plain pan, but an *animated
   * zoom* — which is what `fitBounds` does whenever the framing changes zoom —
   * defers them into a `requestAnimationFrame` (`Map._tryAnimatedZoom`). A flag
   * lowered on the way out of this function is already down by then, the map's
   * own re-frame reads as a gesture, and the follow switches itself off one
   * frame after the shopper asked for it. That is not theoretical: it is what
   * "Recentre" did before this counted frames instead.
   *
   * Two frames clears that hand-off. A counter rather than a boolean because
   * these overlap — a position arriving mid-animation starts another.
   */
  const programmatic = useCallback((run: () => void) => {
    programmaticRef.current += 1;
    try {
      run();
    } finally {
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          programmaticRef.current = Math.max(0, programmaticRef.current - 1);
        }),
      );
    }
  }, []);

  /** Fit both pins, or centre on the courier when there is no drop-off. */
  const frame = useCallback(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    const { courier: at, dropOff: to } = latestRef.current;
    const here = L.latLng(at.latitude, at.longitude);

    programmatic(() => {
      if (to) {
        map.fitBounds(L.latLngBounds([here, L.latLng(to.point.latitude, to.point.longitude)]), {
          // Room for the pins themselves, which hang above their anchor.
          padding: [36, 36],
          maxZoom: FRAME_MAX_ZOOM,
        });
      } else {
        // Keep whatever the shopper had zoomed to, if it was closer than the
        // default — recentring should not also zoom out on them.
        map.setView(here, Math.max(map.getZoom(), LONE_COURIER_ZOOM));
      }
    });
  }, [programmatic]);

  // ── Build the map, once ────────────────────────────────────────────────────
  useEffect(() => {
    // Read once, here: by the time the cleanup runs React may have detached the
    // node, and the listener has to come off the element it went on.
    const host = hostRef.current;
    if (!host) return;

    let cancelled = false;
    let map: Leaflet.Map | null = null;
    let box: ResizeObserver | null = null;
    let theme: MutationObserver | null = null;
    const disableWheel = () => map?.scrollWheelZoom.disable();

    void (async () => {
      let L: typeof Leaflet;
      try {
        L = await import("leaflet");
      } catch {
        // The chunk did not arrive — offline in the app, most likely. The panel
        // above still has the ETA, the distance and the handoff to the device's
        // map, so the honest thing is to render no map rather than an error.
        if (!cancelled) setFailed(true);
        return;
      }

      if (cancelled) return;

      const { courier: at, dropOff: to } = latestRef.current;

      map = L.map(host, {
        maxZoom: MAP_MAX_ZOOM,
        /**
         * Off until the map is clicked or focused, and off again when the
         * pointer leaves. A wheel over an inline map otherwise eats the page
         * scroll, and this panel sits in the middle of a long order page.
         */
        scrollWheelZoom: false,
      });
      programmatic(() => map?.setView([at.latitude, at.longitude], LONE_COURIER_ZOOM));

      tilesRef.current = L.tileLayer(activeTileUrl(), {
        maxZoom: MAP_MAX_ZOOM,
        attribution: MAP_TILE_ATTRIBUTION || undefined,
        // Only when the template says where the @2x goes. Left on without one,
        // Leaflet fetches a zoom level deeper instead, which is a different
        // picture and twice the tiles.
        detectRetina: MAP_TILE_URL.includes("{r}"),
      }).addTo(map);

      if (!MAP_TILE_ATTRIBUTION && process.env.NODE_ENV !== "production") {
        console.warn(
          "[map] NEXT_PUBLIC_MAP_TILE_URL is set but NEXT_PUBLIC_MAP_TILE_ATTRIBUTION is empty. " +
            "Almost every tile provider — OpenStreetMap included — requires attribution.",
        );
      }

      trailRef.current = L.polyline([], {
        className: "wm-map-trail",
        weight: 3,
        // The trail is scenery: it must never swallow a tap meant for a pin.
        interactive: false,
      }).addTo(map);

      courierRef.current = L.marker([at.latitude, at.longitude], {
        icon: L.divIcon({
          className: "wm-map-pin wm-map-pin--courier",
          html: COURIER_PIN,
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        }),
        // Leaflet makes markers keyboard-reachable but a `divIcon` carries no
        // text, so without this they are announced as nothing at all.
        title: "Courier",
        zIndexOffset: 500,
      })
        .addTo(map)
        .bindPopup("");

      // Placed once. The drop-off is a snapshot frozen at checkout and reaches
      // this component with the order that owns it — long before a shipment, an
      // agent, or a socket exists — so it cannot turn up later.
      if (to) {
        L.marker([to.point.latitude, to.point.longitude], {
          icon: L.divIcon({
            className: "wm-map-pin wm-map-pin--drop",
            html: DROP_PIN,
            iconSize: [28, 34],
            // The tip of the teardrop, not its middle.
            iconAnchor: [14, 32],
          }),
          title: "Delivery address",
        })
          .addTo(map)
          .bindPopup(
            `<strong>Delivery address</strong>${
              to.label ? `<br /><span class="wm-map-popup__meta">${escapeHtml(to.label)}</span>` : ""
            }`,
          );
      }

      // The shopper took the viewport. Leaflet cannot tell us who moved it, so
      // the flag we raise around our own calls is what answers that.
      map.on("movestart zoomstart", () => {
        if (programmaticRef.current === 0) setFollowing(false);
      });

      map.on("click focus", () => map?.scrollWheelZoom.enable());
      map.on("blur", disableWheel);
      // `mouseleave` on the element, not Leaflet's `mouseout`: the map fires
      // that one for every marker the pointer crosses, which would switch the
      // wheel off again halfway through using it. This fires once, on the way
      // out of the panel.
      host.addEventListener("mouseleave", disableWheel);

      // A map laid out inside a card that grows — a status history loading, the
      // keyboard closing — measures itself before the card settles, and renders
      // a strip of tiles in the corner until something tells it otherwise.
      box = new ResizeObserver(() =>
        programmatic(() => map?.invalidateSize({ animate: false, pan: false })),
      );
      box.observe(host);

      // The theme toggle flips a class on <html>; the tiles follow it. Only
      // worth watching when there is a second template to swap to — without one
      // the dark treatment is a CSS filter, which needs no JavaScript at all.
      if (MAP_TILE_URL_DARK) {
        theme = new MutationObserver(() => tilesRef.current?.setUrl(activeTileUrl()));
        theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      }

      mapRef.current = map;
      leafletRef.current = L;
      setReady(true);
    })();

    return () => {
      cancelled = true;
      host.removeEventListener("mouseleave", disableWheel);
      box?.disconnect();
      theme?.disconnect();
      map?.remove();
      mapRef.current = null;
      leafletRef.current = null;
      tilesRef.current = null;
      courierRef.current = null;
      trailRef.current = null;
      trailPointsRef.current = [];
      setReady(false);
    };
  }, [programmatic]);

  // ── Every new position ─────────────────────────────────────────────────────
  useEffect(() => {
    const marker = courierRef.current;
    if (!ready || !marker) return;

    const here: Leaflet.LatLngTuple = [courier.latitude, courier.longitude];
    marker.setLatLng(here);
    marker.setPopupContent(courierPopup(courierName, recordedAt));

    // The heading lives on a child element rather than in the icon's HTML: a new
    // icon is a new DOM node, and replacing it every few seconds would restart
    // the pulse animation and close an open popup.
    const arrow = marker.getElement()?.querySelector<HTMLElement>(".wm-map-pin__heading");
    if (arrow) {
      const bearing = headingDegrees;
      arrow.style.opacity = typeof bearing === "number" ? "1" : "0";
      if (typeof bearing === "number") arrow.style.transform = `rotate(${bearing}deg)`;
    }

    const points = trailPointsRef.current;
    const last = points[points.length - 1];
    if (!last || last[0] !== here[0] || last[1] !== here[1]) {
      points.push(here);
      if (points.length > TRAIL_LIMIT) points.shift();
      trailRef.current?.setLatLngs(points);
    }

    if (following) frame();
  }, [ready, following, frame, courier.latitude, courier.longitude, headingDegrees, recordedAt, courierName]);

  if (failed) return null;

  return (
    <div
      className="wm-map"
      // Which of the two dark treatments applies is a CSS decision, and this is
      // how CSS learns which one was configured.
      data-dark-tiles={MAP_TILE_URL_DARK ? "true" : "false"}
      style={{ height: MAP_HEIGHT }}
    >
      <div
        ref={hostRef}
        className="wm-map__canvas"
        role="application"
        aria-label="Live map of your delivery"
      />

      {ready && !following && (
        <div className="wm-map__recentre">
          <Button variant="secondary" size="sm" leadingIcon="navigation" onClick={() => setFollowing(true)}>
            Recentre
          </Button>
        </div>
      )}
    </div>
  );
}

/** Dark tiles when the theme asks for them and a template exists to serve them. */
function activeTileUrl(): string {
  if (!MAP_TILE_URL_DARK) return MAP_TILE_URL;
  return document.documentElement.classList.contains("dark") ? MAP_TILE_URL_DARK : MAP_TILE_URL;
}

function courierPopup(name: string | null | undefined, recordedAt: string): string {
  const who = name?.trim() ? escapeHtml(name.trim()) : "Your courier";
  const at = new Date(recordedAt);
  const when = Number.isNaN(at.getTime())
    ? null
    : at.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return `<strong>${who}</strong>${
    when ? `<br /><span class="wm-map-popup__meta">Updated ${when}</span>` : ""
  }`;
}

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

/**
 * Both labels are backend strings — an agent's display name and a geocoded
 * address — and both are interpolated into markup Leaflet injects with
 * `innerHTML`. Escaping is not optional here.
 */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/**
 * A pulsing dot with an optional heading arrow around it. Written as markup
 * rather than JSX because a `divIcon` takes an HTML string; everything variable
 * about it is set on the live element afterwards.
 */
const COURIER_PIN = `
<span class="wm-map-pin__pulse"></span>
<span class="wm-map-pin__core"></span>
<span class="wm-map-pin__heading" style="opacity:0">
  <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
    <path d="M12 2 19 21 12 16.4 5 21Z" fill="currentColor" />
  </svg>
</span>`;

/** The drop-off: a filled teardrop, so it reads as a place rather than a thing
 *  that moves. */
const DROP_PIN = `
<svg viewBox="0 0 24 24" width="28" height="34" aria-hidden="true">
  <path d="M12 23.5S20 15.6 20 10a8 8 0 1 0-16 0c0 5.6 8 13.5 8 13.5Z" fill="currentColor" />
  <circle cx="12" cy="10" r="3.1" />
</svg>`;
