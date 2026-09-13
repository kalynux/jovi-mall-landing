/**
 * Watching a delivery move — two services, one token.
 *
 * jovi-mall answers **who you may watch**; geo-tracker answers **where they
 * are**. The same access token signs both.
 *
 * ```
 * 1. GET {jovi-mall}/api/tracking/visible-agents   which agents you may watch
 * 2. WS  {geo-tracker}/ws/track                     where they are
 * ```
 *
 * See api-doc/tracking/README.md and
 * api-doc/tracking/geo-tracker/tracking-websocket.md.
 */
import { apiFetch } from "@/lib/api/client";
import * as tokens from "@/lib/auth/token-store";
import { USES_BEARER_AUTH } from "@/lib/auth/token-store";

/** geo-tracker is a **separate service**, unversioned and mounted at the root. */
export const GEO_TRACKER_URL = process.env.NEXT_PUBLIC_GEO_TRACKER_URL ?? "";

/**
 * GET /api/tracking/visible-agents
 *
 * **Any authenticated actor may call it** — there is no `requireRole` on the
 * route; the service returns the correct (possibly empty) set for the caller's
 * role. For a customer that is the agents on their **active orders**.
 *
 * ⚠ **An empty `agents` array is the normal resting state**, not an error — it
 * means no active delivery and nobody to watch.
 *
 * `all: true` is the admin wildcard and a customer never sees it.
 */
export async function getVisibleAgents(): Promise<{ all: boolean; agents: string[] }> {
  const data = await apiFetch<{ all?: boolean; agents?: string[] }>(
    "/api/tracking/visible-agents",
  );
  return { all: data?.all === true, agents: Array.isArray(data?.agents) ? data.agents : [] };
}

/** A position broadcast for one agent. */
export interface AgentPosition {
  agentId: string;
  position: { latitude: number; longitude: number };
  /** Only when the device reported it. */
  headingDegrees?: number;
  /** Only when the device reported it. */
  speedMps?: number;
  recordedAt: string;
  /**
   * Only when a destination resolved **and** routing answered.
   *
   * 🔴 **Render the position whether or not this is here.** Three normal reasons
   * it is absent: the ETA arrives late (the drop-off is fetched out of band when
   * the session opens, so a viewer who subscribed first gains one later
   * **without reconnecting**); no ETA is always a valid state (a legacy order
   * with no geocoded address, a routing provider briefly unreachable); and it is
   * throttled to once per 30s, so it can lag the position by that much.
   */
  etaSeconds?: number;
  distanceMeters?: number;
}

/**
 * Why a subscription was dropped.
 *
 * 🔴 **The subscription ends in all three cases, but what you tell the user
 * differs completely.** The server fails closed on any viewer it cannot confirm,
 * so "dropped" says nothing about the delivery on its own.
 *
 * Until 2026-08-19 all three were sent as `shipment_completed`, and a client
 * acting on that string told somebody their delivery was complete because an
 * access token aged out.
 */
export type RevocationReason =
  /** jovi-mall was asked and answered: no longer entitled. **The only value from
   *  which a delivery outcome may be reported.** */
  | "shipment_completed"
  /** jovi-mall **rejected the token**. Nothing is known about the shipment —
   *  get a fresh token, reconnect, and say nothing about the delivery. */
  | "authorization_expired"
  /** jovi-mall **could not be asked**. Nothing is known at all — retry with
   *  backoff and report no outcome. */
  | "authorization_unavailable";

/**
 * Any unrecognised reason is treated as `authorization_expired`.
 *
 * That rule is what makes a future fourth value safe for the backend to add: the
 * fallback re-authorizes and tells the user nothing, which is never wrong.
 */
export function normalizeRevocation(reason: unknown): RevocationReason {
  return reason === "shipment_completed" || reason === "authorization_unavailable"
    ? reason
    : "authorization_expired";
}

export interface TrackingHandlers {
  onPosition?: (position: AgentPosition) => void;
  onRevoked?: (reason: RevocationReason) => void;
  /**
   * Two fields, one per source — the same split as `classifyCartAddFailure`.
   *
   *   - `messageKey` — a failure this file authored, named as a message KEY
   *     because a non-React module cannot translate. See LOCALISATION.md.
   *   - `message` — a sentence the geo-tracker service sent in an `error`
   *     frame, already written for a person and passed through untouched.
   *
   * Exactly one of the two is set.
   */
  onError?: (failure: { messageKey: string | null; message: string | null }) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

/**
 * 🔴 The token is checked at the handshake and **never again on a timer** — but
 * a revocation check re-asks jovi-mall using the token handed over at that
 * handshake. Past the 15-minute access TTL that token is expired, the re-check
 * fails, and the subscription is dropped with `authorization_expired`.
 *
 * So a socket held open past the TTL keeps working right up until something
 * triggers a re-check, and then stops. **There is no refresh path over the
 * socket** — geo-tracker forwards a bearer token and cannot see jovi-mall's
 * refresh cookie.
 *
 * The documented remedy is to reconnect on a cadence shorter than the TTL. This
 * is the customer-visible face of a known cross-service defect that is
 * deliberately not being fixed.
 */
const RECONNECT_INTERVAL_MS = 10 * 60 * 1000;

/** Backoff for a connection that failed, capped so a long outage stays quiet. */
const RETRY_BASE_MS = 2_000;
const RETRY_MAX_MS = 60_000;

export interface TrackingSubscription {
  agentId: string;
  /**
   * 🔴 **Send this.** A customer with two orders out at once may be watching an
   * agent carrying several deliveries, and the ETA is measured to *a* drop-off.
   * Naming the shipment is what scopes it to theirs.
   *
   * Resolution order server-side: an explicit `destination` wins; then this
   * shipment's drop-off (**and nothing** if it has no open session — it does not
   * fall back); then, only if the agent has exactly one open session, that one;
   * otherwise no ETA. It refuses to guess, because an ETA to the wrong address
   * is worse than none — it is wrong in a way that looks right.
   */
  shipmentId?: string;
}

/**
 * A live connection to geo-tracker for one customer.
 *
 * ⚠ **`destination` is deliberately never sent.** The drop-off is pulled from
 * jovi-mall when the session opens, so the client does not need the customer's
 * address — and sending one from client-held address data would override the
 * authoritative value for the life of the subscription.
 */
export class DeliveryTracker {
  private socket: WebSocket | null = null;
  private closed = false;
  private retries = 0;
  private rotateTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly subscriptions: TrackingSubscription[],
    private readonly handlers: TrackingHandlers,
  ) {}

  async start(): Promise<void> {
    this.closed = false;
    await this.connect();
  }

  stop(): void {
    this.closed = true;
    if (this.rotateTimer) clearTimeout(this.rotateTimer);
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.rotateTimer = null;
    this.retryTimer = null;
    this.socket?.close();
    this.socket = null;
  }

  private async connect(): Promise<void> {
    if (this.closed || !GEO_TRACKER_URL) return;

    const url = `${GEO_TRACKER_URL.replace(/^http/, "ws").replace(/\/+$/, "")}/ws/track`;

    /**
     * Three ways the token can arrive, and this build only ever uses two.
     *
     * A browser relies on the httpOnly cookie, which it attaches itself when
     * geo-tracker is same-site with jovi-mall — no token handling in JS at all.
     * A Capacitor build has no cookie: it authenticates through
     * `/api/auth/mobile/*` and holds the raw token, and since browsers cannot
     * set `Authorization` on a WebSocket, the subprotocol is the way in.
     */
    let socket: WebSocket;
    try {
      if (USES_BEARER_AUTH) {
        const pair = await tokens.read();
        if (!pair) {
          this.handlers.onError?.({ messageKey: "shop.common.notSignedIn", message: null });
          return;
        }
        socket = new WebSocket(url, ["bearer", pair.accessToken]);
      } else {
        socket = new WebSocket(url);
      }
    } catch {
      this.scheduleRetry();
      return;
    }

    this.socket = socket;

    socket.onopen = () => {
      this.retries = 0;
      this.handlers.onOpen?.();
      for (const sub of this.subscriptions) {
        socket.send(
          JSON.stringify({
            type: "subscribe",
            payload: {
              agentId: sub.agentId,
              ...(sub.shipmentId ? { shipmentId: sub.shipmentId } : {}),
            },
          }),
        );
      }
      // Rotate onto a fresh token before the access TTL makes the one held at
      // the handshake unusable for a re-check.
      this.rotateTimer = setTimeout(() => this.reconnect(), RECONNECT_INTERVAL_MS);
    };

    socket.onmessage = (event) => {
      let frame: { type?: string; payload?: Record<string, unknown> };
      try {
        frame = JSON.parse(String(event.data));
      } catch {
        return;
      }

      switch (frame.type) {
        case "location_broadcast":
          this.handlers.onPosition?.(frame.payload as unknown as AgentPosition);
          break;
        case "permission_revoked": {
          const reason = normalizeRevocation(frame.payload?.reason);
          this.handlers.onRevoked?.(reason);
          // Only a completed shipment is over. The other two say nothing about
          // the delivery and are worth another attempt with a fresh token.
          if (reason !== "shipment_completed") this.scheduleRetry();
          else this.stop();
          break;
        }
        case "error":
          this.handlers.onError?.(
            frame.payload?.message
              ? { messageKey: null, message: String(frame.payload.message) }
              : { messageKey: "shop.common.somethingWentWrong", message: null },
          );
          break;
        case "ack":
        default:
          break;
      }
    };

    socket.onclose = () => {
      this.handlers.onClose?.();
      if (!this.closed) this.scheduleRetry();
    };

    // `onerror` is always followed by `onclose`, which owns the retry.
    socket.onerror = () => undefined;
  }

  /** Swap onto a new socket with a freshly-read token. */
  private reconnect(): void {
    if (this.closed) return;
    this.socket?.close();
    this.socket = null;
    void this.connect();
  }

  private scheduleRetry(): void {
    if (this.closed || this.retryTimer) return;
    const delay = Math.min(RETRY_BASE_MS * 2 ** this.retries, RETRY_MAX_MS);
    this.retries += 1;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.connect();
    }, delay);
  }
}

/** `540` → `"9 min"`. Rounded up, because "0 min away" reads as "here". */
export function formatEta(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** `2300` → `"2.3 km"`. */
export function formatDistance(meters: number): string {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}
