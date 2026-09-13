"use client";

import dynamic from "next/dynamic";
import { useFormatter, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Icon } from "@/components/shop/ds";
import { openApp } from "@/lib/native/links";
import { HAS_MAP_TILES, MAP_HEIGHT, parseDropOff } from "@/lib/shop/map";
import {
  DeliveryTracker,
  formatDistance,
  formatEta,
  getVisibleAgents,
  GEO_TRACKER_URL,
  type AgentPosition,
  type RevocationReason,
} from "@/lib/shop/tracking.api";

/**
 * Leaflet, and the map built on it, arrive only when there is something to draw.
 *
 * 🔴 `ssr: false` is not optional: Leaflet touches `window` as it loads, and
 * this app is prerendered on the server for the web and exported to static HTML
 * for the packaged app. The chunk is fetched the first time a shopper watches a
 * delivery on a build that has tiles configured, and never otherwise.
 */
const DeliveryMap = dynamic(() => import("./DeliveryMap"), {
  ssr: false,
  // Reserves the height the map will take, so the panel does not jump when the
  // chunk lands. Styled here rather than in the map's own stylesheet, which is
  // in the very chunk this is standing in for.
  loading: () => (
    <div
      style={{
        height: MAP_HEIGHT,
        marginBottom: 10,
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border)",
        background: "var(--surface-sunken)",
      }}
    />
  ),
});

/**
 * The live position of the agent carrying one shipment.
 *
 * ── Two services, and the order of the questions matters ─────────────────────
 *
 * jovi-mall says *who you may watch* (`visible-agents`), geo-tracker says *where
 * they are* (the socket). Asking geo-tracker first would mean opening a socket
 * that is refused, so the agent list is read first and the socket only opens if
 * this shipment's agent is on it.
 *
 * ── An empty list is the resting state, not a failure ────────────────────────
 *
 * No active delivery means nobody to watch. It is also **expected immediately
 * after an order ships**: revocations are pushed but *grants are not* — they
 * wait for a cache TTL, and a reconnect does not refresh it because the cache is
 * user-keyed in Redis and outlives the socket. So this polls `visible-agents`
 * rather than hammering reconnects, which would not help.
 *
 * ── 🔴 Being dropped says nothing about the delivery ─────────────────────────
 *
 * `permission_revoked` fires in three quite different situations and only one of
 * them means the parcel arrived. The other two mean the platform could not
 * confirm the viewer — so this reports an outcome from `shipment_completed`
 * alone and stays silent on the rest, which is exactly the bug the backend fixed
 * on 2026-08-19 when a client told people their delivery was complete because a
 * token aged out.
 */
export function DeliveryTracking({
  shipmentId,
  /** True once the shipment discloses a carrying agent (ADR-A06). */
  hasAgent,
  /**
   * The order's `deliveryAddress` — the drop-off, geocoded and frozen at
   * checkout. Passed straight through as `unknown`: validating it is
   * `parseDropOff`'s job, and a shipment whose order has no usable one simply
   * gets a map with a single pin.
   */
  deliveryAddress,
  /** The carrying agent's partial display name, for the courier's map label. */
  agentName,
}: {
  shipmentId: string;
  hasAgent: boolean;
  deliveryAddress?: unknown;
  agentName?: string | null;
}) {
  // Both conditions are known at render time, so they gate the mount rather
  // than being discovered by an effect that then re-renders to report them.
  // Splitting here also means no socket machinery is constructed for the many
  // shipments that have no agent yet.
  if (!hasAgent || !GEO_TRACKER_URL) return null;
  return (
    <LiveTracking shipmentId={shipmentId} deliveryAddress={deliveryAddress} agentName={agentName} />
  );
}

function LiveTracking({
  shipmentId,
  deliveryAddress,
  agentName,
}: {
  shipmentId: string;
  deliveryAddress?: unknown;
  agentName?: string | null;
}) {
  const t = useTranslations("shop.tracking");
  const format = useFormatter();
  const [agentId, setAgentId] = useState<string | null>(null);
  const [watchable, setWatchable] = useState<boolean | null>(null);
  const [position, setPosition] = useState<AgentPosition | null>(null);
  const [revoked, setRevoked] = useState<RevocationReason | null>(null);
  const [live, setLive] = useState(false);

  /**
   * Which agent belongs to *this* shipment.
   *
   * ⚠ **The order-detail payload does not carry an agent id.** The disclosed
   * carrying-agent block is `{ displayName, photo, visibleFrom }` and no more,
   * so the only source of an id is `visible-agents` — which returns ids for the
   * customer's active orders without saying which shipment each belongs to.
   *
   * With exactly one, the binding is unambiguous. With more than one it is not,
   * and this **refuses to guess** rather than subscribing to whichever came
   * first: showing a courier who is carrying somebody else's parcel is wrong in
   * a way that looks right, which is the same reason the server declines to
   * resolve an ETA for a multi-drop agent.
   *
   * Polled rather than reconnected: a grant is **not pushed** — it waits for a
   * user-keyed cache TTL that outlives the socket — so time passing is the only
   * thing that changes this answer.
   */
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const { agents } = await getVisibleAgents();
        if (cancelled) return;
        // An empty list is the resting state, and is expected for a while after
        // an order ships.
        if (agents.length === 1) {
          setAgentId(agents[0]);
          setWatchable(true);
        } else {
          setAgentId(null);
          setWatchable(false);
        }
      } catch {
        if (!cancelled) setWatchable(false);
      }
    };

    void check();
    const id = setInterval(check, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  useEffect(() => {
    if (!watchable || !agentId || revoked === "shipment_completed") return;

    const tracker = new DeliveryTracker(
      // The shipment id is what scopes the ETA to *this* delivery. Without it an
      // agent carrying several parcels yields no ETA at all — the server refuses
      // to guess which drop-off is meant.
      [{ agentId, shipmentId }],
      {
        onOpen: () => setLive(true),
        onClose: () => setLive(false),
        onPosition: setPosition,
        onRevoked: setRevoked,
      },
    );

    void tracker.start();
    return () => tracker.stop();
  }, [watchable, agentId, shipmentId, revoked]);

  const mapHref = useMemo(() => {
    if (!position) return null;
    const { latitude, longitude } = position.position;
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
  }, [position]);

  /**
   * The second pin.
   *
   * Nothing here is sent anywhere: the socket resolves its own destination from
   * the same order record server-side, so drawing this locally cannot disagree
   * with the ETA — and `subscribe` must never carry a client-held `destination`.
   */
  const dropOff = useMemo(() => parseDropOff(deliveryAddress), [deliveryAddress]);

  // Nothing to offer: no agent disclosed yet, no geo-tracker configured, or this
  // delivery is not one the customer may watch.
  if (watchable !== true) return null;

  if (revoked === "shipment_completed") {
    return (
      <Panel>
        <p style={{ margin: 0, fontSize: 13.5 }}>{t("complete")}</p>
      </Panel>
    );
  }

  return (
    <Panel>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span className="ds-overline">{t("live")}</span>
        <Badge size="sm" tone={live && position ? "success" : "neutral"}>
          {live && position ? t("moving") : t("connecting")}
        </Badge>
      </div>

      {position ? (
        <>
          {/* The map is the optional half of this panel. With no tile provider
              configured there is nothing to draw it on, and everything below —
              the ETA, the distance, the handoff to the device's own map — is
              exactly what shipped before it existed. */}
          {HAS_MAP_TILES && (
            <DeliveryMap
              courier={position.position}
              recordedAt={position.recordedAt}
              headingDegrees={position.headingDegrees}
              courierName={agentName}
              dropOff={dropOff}
            />
          )}

          <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 8 }}>
            {/* The ETA is optional and its absence is normal — it arrives late,
                it is throttled to once per 30s, and plenty of deliveries never
                resolve a destination at all. The position stands without it. */}
            {position.etaSeconds !== undefined && (
              <Stat label={t("arrivingIn")} value={formatEta(position.etaSeconds)} />
            )}
            {position.distanceMeters !== undefined && (
              <Stat label={t("distance")} value={formatDistance(position.distanceMeters)} />
            )}
            <Stat
              label={t("updated")}
              value={format.dateTime(new Date(position.recordedAt), {
                hour: "2-digit",
                minute: "2-digit",
              })}
            />
          </div>

          {position.etaSeconds === undefined && (
            <p className="muted" style={{ fontSize: 12.5, margin: "0 0 8px" }}>
              {t("noEta")}
            </p>
          )}

          {mapHref && (
            <Button
              variant="secondary"
              size="sm"
              leadingIcon="map-pin"
              // Still here with a map above it, and not redundant: the device's
              // own map app is full screen, knows where the shopper is standing,
              // and can give them directions. This panel does none of that.
              onClick={() => void openApp(mapHref)}
            >
              {t("openInMaps")}
            </Button>
          )}
        </>
      ) : (
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          <Icon name="loader" size={13} /> {t("waitingForPosition")}
        </p>
      )}
    </Panel>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: 12,
        marginTop: 10,
      }}
    >
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="muted" style={{ fontSize: 11.5, fontWeight: 600 }}>
        {label}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700 }}>{value}</div>
    </div>
  );
}
