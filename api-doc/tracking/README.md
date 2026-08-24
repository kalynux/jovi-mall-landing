# Watching a delivery — the customer's live map

**A customer can watch their own delivery move, and this is the only page that says how.**

It takes **two services**. jovi-mall answers *who you may watch*; geo-tracker answers *where they
are*. The same access token signs both.

> **Verified against source 2026-08-24.** Policy:
> `jovi-mall/src/modules/tracking-integration/services/visible-agents.service.ts:105`.
> Route + guard: `routes/tracking.routes.ts:36-45`. Socket contract:
> [`geo-tracker/tracking-websocket.md`](./geo-tracker/tracking-websocket.md).

⚠ **This chapter is not in `PLAN-2`'s original scope and was added deliberately.** The plan's target
tree had no tracking folder, and its gap list treated the three backend tracking documents as
vendor/agency concerns. Source says otherwise: `customer` is a first-class tracking viewer.

---

## 1 · The two calls

```
1.  GET  {jovi-mall}/api/tracking/visible-agents        -> which agents you may watch
2.  WS   {geo-tracker}/ws/track                          -> where they are
```

### `GET /api/tracking/visible-agents`

```jsonc
{ "all": false, "agents": ["66b1..."] }
```

**Any authenticated actor may call it** — there is no `requireRole` on the route. The service
returns the correct (possibly empty) set for your role. For a customer that is:

> **agents on their active orders** — an order whose fulfilment has not reached a terminal state.

`all: true` is the admin wildcard; a customer never sees it. **An empty `agents` array is the normal
resting state** — no active delivery, nobody to watch. Do not treat it as an error.

| Role | Sees |
|---|---|
| admin | every agent |
| agency | agents on its currently trackable shipments |
| **customer** | **agents on their active orders** |
| agent | only themselves |
| vendor | nothing — refused when opening the socket |

---

## 2 · The socket

```
GET {geo-tracker}/ws/track
```

Present **the same jovi-mall access token**. Three ways it can arrive, tried in order:

1. **httpOnly cookie** — the recommended browser path. The browser attaches it automatically when
   geo-tracker is *same-site* with jovi-mall, so a browser just does
   `new WebSocket("wss://geo.example.com/ws/track")` with no token handling in JS.
2. **Subprotocol** — `Sec-WebSocket-Protocol: bearer, <access_token>`. Browsers cannot set
   `Authorization` on a WebSocket, so this is the path for a client that *holds* the raw token.
3. **`Authorization: Bearer <token>`** — non-browser clients.

🔴 **The Capacitor-wrapped app uses path 2 or 3, never 1.** It authenticates through
`/api/auth/mobile/*` and holds the raw token; there is no cookie. Its origins
(`capacitor://localhost`, `https://localhost`) must be in geo-tracker's **`ALLOWED_ORIGINS`** —
one variable drives both HTTP CORS **and** the WebSocket origin check.

| Outcome | Status |
|---|---|
| no / invalid / expired token | `401` |
| role is `vendor` | `403` |
| jovi-mall unreachable | `502` |

### 2.1 Subscribe

```jsonc
{ "type": "subscribe",
  "payload": { "agentId": "66b1...", "shipmentId": "66c2..." } }
```

Answered with `ack`, or `error` if you are not authorized to watch that agent.

🔴 **Send `shipmentId`.** A customer with two orders out at once may be watching an agent carrying
several deliveries, and the ETA is measured to *a* drop-off. The resolution order is:

| | Rule | Result |
|---|---|---|
| ① | you sent `destination` | that point, always |
| ② | you sent `shipmentId` | that shipment's drop-off — **nothing** if it has no open session |
| ③ | neither, and the agent has **exactly one** open session | that delivery's drop-off |
| ④ | otherwise | **no ETA** |

**③ refuses to guess, and ② does not fall back to ③.** An ETA to the wrong address is worse than
none — it is wrong in a way that looks right.

⚠ **You do not need the customer's address.** The drop-off is pulled from jovi-mall when the
session opens. Do not send `destination` from client-held address data.

### 2.2 What you receive

```jsonc
{ "type": "location_broadcast",
  "payload": {
    "agentId": "66b1...",
    "position": { "latitude": 4.05, "longitude": 9.70 },
    "headingDegrees": 91.2,        // only if the device reported it
    "speedMps": 8.4,               // only if the device reported it
    "recordedAt": "2026-08-24T09:41:00Z",
    "etaSeconds": 540.0,           // only when a destination resolved AND routing answered
    "distanceMeters": 2300.0
  } }
```

**Render the position whether or not `etaSeconds` is there.** Three normal reasons it is absent:

- The **ETA arrives late.** The drop-off is fetched out of band when the session opens, so a viewer
  who subscribed first starts with no ETA and gains one **without reconnecting**. Do not treat its
  absence on the first few broadcasts as final.
- **No ETA is always a valid state** — a legacy order with no geocoded address, a deployment with no
  service token, a routing provider briefly unreachable.
- It is **throttled** to once per 30 s (`ETA_MIN_INTERVAL`) per agent and destination, so it can lag
  the position by that much. Two viewers of the same delivery see the same number.

---

## 3 · 🔴 `permission_revoked` does not mean the delivery ended

The subscription is dropped in **all three** cases — the server fails closed on any viewer it cannot
confirm — but **what you tell the user differs completely.**

| `reason` | What happened | What to do |
|---|---|---|
| `shipment_completed` | jovi-mall was asked and answered: you are no longer entitled. | Stop watching. **The only value from which you may report a delivery outcome.** |
| `authorization_expired` | jovi-mall **rejected your token**. Nothing is known about the shipment. | Get a fresh token, reconnect, re-subscribe. **Say nothing about the delivery.** |
| `authorization_unavailable` | jovi-mall **could not be asked**. Nothing is known at all. | Retry with backoff. Report no outcome. |

**Treat any unrecognised value as `authorization_expired`** — re-authorize and tell the user nothing.
That rule is what makes a future fourth value safe to add.

> **Until 2026-08-19 all three were sent as `shipment_completed`.** A client acting on that string
> told somebody their delivery was complete because an access token aged out. The value and meaning
> of `shipment_completed` itself are unchanged; the other two are new.

### 3.1 🔴 The token is checked at handshake and never again on a timer

Nothing re-validates the token while the socket is open. But when a revocation check fires — a
shipment settling, a webhook — the server re-asks jovi-mall **using the token you handed it at the
handshake**. Past the 15-minute access TTL that token is expired, the re-check fails, and your
subscription is dropped with `authorization_expired`.

So a socket held open past the TTL keeps working right up until something triggers a re-check, and
then stops. **There is no refresh path over the socket** — geo-tracker forwards a bearer token and
has no access to jovi-mall's refresh cookie.

> **Reconnect with a fresh token on a cadence shorter than 15 minutes.**

This is the customer-visible face of a known cross-service defect that is **deliberately not being
fixed** — a client reconnects rather than the services learning to refresh. Do not file it.

---

## 4 · When tracking stops being available

Access ends when the shipment finishes:

- **Prepaid orders** — the shipment reaches `delivered` (the customer confirms).
- **Cash on delivery** — the agent records the cash via the delivery code.

At that moment jovi-mall emits an event, geo-tracker drops the subscription and pushes
`permission_revoked` with `shipment_completed`.

### 4.1 A grant is not pushed; only a revocation is

⚠ **A newly-authorised viewer can be refused until a cache expires.** Revocation is pushed;
**grants are not** — they wait for `PERMISSION_CACHE_TTL`, and **a reconnect does not refresh it**
(the cache is user-keyed in Redis and outlives the socket).

This is deliberate: the leak direction gets the push, the inconvenience direction does not. **So a
map that is empty immediately after an order ships is expected.** Poll `visible-agents` rather than
hammering reconnects, which will not help.

### 4.2 Things that look broken and are not

| Symptom | Cause |
|---|---|
| Tracking silently does nothing locally | `GEO_TRACKER_BASE_URL` unset — the intended local default. The outbox accumulates and nothing dispatches |
| An active shipment never opened a session | The outbox is **not transactional**; a crash between commit and enqueue loses the event permanently |
| Position moves but no trail is kept | The durable trail needs an open session; the **live position** only needs the agent's Tracking Allow |

---

## 5 · The two privacy gates, and why an idle agent has a position

These are **not interchangeable**, and a client that conflates them will misread an empty map.

| Gate | Controls | Requires a shipment? |
|---|---|---|
| **Tracking Allow** (agent's device opt-in + admin flag) | the **live position** — every fix, broadcast | ❌ no |
| **An open tracking session** | the **durable GPS trail** | ✅ yes |

So an opted-in agent with no delivery is **locatable but not tracked** — which is exactly how the
platform finds the agent closest to a pickup. **A customer never sees that**; `visible-agents` scopes
them to their own active orders.

An agent **cannot switch Tracking Allow off mid-shipment** — geo-tracker refuses it, because
jovi-mall would not have dispatched to them otherwise. Physical GPS loss is never refused and merely
impairs the session.

---

## 6 · A tracking session is one shipment

Opened by jovi-mall reporting the shipment active, closed only by jovi-mall reporting it terminal.

**WebSocket connects and disconnects can never end it.** A reconnect resumes the *same* session —
same id, same trail, same history — rather than minting a new one. An agent running several
deliveries has several concurrent sessions, one per shipment, fed by one GPS stream.

---

## 7 · Also in this folder

| File | What |
|---|---|
| [`live-tracking.md`](./live-tracking.md) | jovi-mall's side of the seam — the visibility table, mirrored from the backend |
| [`agent-tracking-policy.md`](./agent-tracking-policy.md) | when an agent may be tracked at all |
| [`shipment-destination.md`](./shipment-destination.md) | how the drop-off reaches geo-tracker |
| [`geo-tracker/tracking-websocket.md`](./geo-tracker/tracking-websocket.md) | **the full socket contract**, including the agent-only frames a customer client never sends |
| [`geo-tracker/README.md`](./geo-tracker/README.md) | geo-tracker's own overview |
| [`geo-tracker/rate-limits.md`](./geo-tracker/rate-limits.md) | 600/min per IP, burst 60 |
| `geo-tracker/FRONTEND-CHANGELOG-phase-{2-3,4-5}.md` | **never previously propagated to any frontend** |
