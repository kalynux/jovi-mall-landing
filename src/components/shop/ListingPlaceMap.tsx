"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type * as Leaflet from "leaflet";

import "leaflet/dist/leaflet.css";
import "./account/DeliveryMap.css";

import {
  MAP_HEIGHT,
  MAP_MAX_ZOOM,
  MAP_TILE_ATTRIBUTION,
  MAP_TILE_URL,
  MAP_TILE_URL_DARK,
} from "@/lib/shop/map";

/**
 * One pin: where a business is, after the customer unlocked its location.
 *
 * 🔴 Never import this statically, for the reason `DeliveryMap` gives: Leaflet
 * touches `window` as it loads. `ListingContacts` reaches it through
 * `next/dynamic({ ssr: false })`, and only once a location has been unlocked,
 * so nobody downloads a map to read a listing. It reuses the delivery map's
 * skin (`DeliveryMap.css`), so the two maps in the shop look like one.
 *
 * Deliberately inert: no follow, no trail, no recentre. It answers "where is
 * it", and the "Open in Maps" button beside it answers "how do I get there".
 */
export default function ListingPlaceMap({
  latitude,
  longitude,
  label,
}: {
  latitude: number;
  longitude: number;
  /** The business's name, for the pin's accessible title. */
  label: string;
}) {
  const t = useTranslations("shop.listings.map");
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const labelRef = useRef(label);
  labelRef.current = label;

  useEffect(() => {
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
        if (!cancelled) setFailed(true);
        return;
      }
      if (cancelled) return;

      map = L.map(host, { maxZoom: MAP_MAX_ZOOM, scrollWheelZoom: false });
      map.setView([latitude, longitude], 16);
      map.attributionControl.setPrefix(false);

      const tiles = L.tileLayer(activeTileUrl(), {
        maxZoom: MAP_MAX_ZOOM,
        attribution: MAP_TILE_ATTRIBUTION || undefined,
        detectRetina: MAP_TILE_URL.includes("{r}"),
      }).addTo(map);

      L.marker([latitude, longitude], {
        icon: L.divIcon({
          className: "wm-map-pin wm-map-pin--drop",
          html: PIN,
          iconSize: [28, 34],
          iconAnchor: [14, 32],
        }),
        title: labelRef.current,
        keyboard: false,
      }).addTo(map);

      map.on("click focus", () => map?.scrollWheelZoom.enable());
      map.on("blur", disableWheel);
      host.addEventListener("mouseleave", disableWheel);

      box = new ResizeObserver(() => map?.invalidateSize({ animate: false, pan: false }));
      box.observe(host);

      if (MAP_TILE_URL_DARK) {
        theme = new MutationObserver(() => tiles.setUrl(activeTileUrl()));
        theme.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
      }
    })();

    return () => {
      cancelled = true;
      host.removeEventListener("mouseleave", disableWheel);
      box?.disconnect();
      theme?.disconnect();
      map?.remove();
    };
  }, [latitude, longitude]);

  // No chunk, no map: the address and the "Open in Maps" button still stand.
  if (failed) return null;

  return (
    <div
      className="wm-map"
      data-dark-tiles={MAP_TILE_URL_DARK ? "true" : "false"}
      style={{ height: Math.round(MAP_HEIGHT * 0.85) }}
    >
      <div ref={hostRef} className="wm-map__canvas" role="application" aria-label={t("ariaLabel", { name: label })} />
    </div>
  );
}

function activeTileUrl(): string {
  if (!MAP_TILE_URL_DARK) return MAP_TILE_URL;
  return document.documentElement.classList.contains("dark") ? MAP_TILE_URL_DARK : MAP_TILE_URL;
}

/** The delivery map's place pin: a filled teardrop. */
const PIN = `
<svg viewBox="0 0 24 24" width="28" height="34" aria-hidden="true">
  <path d="M12 23.5S20 15.6 20 10a8 8 0 1 0-16 0c0 5.6 8 13.5 8 13.5Z" fill="currentColor" />
  <circle cx="12" cy="10" r="3.1" />
</svg>`;
