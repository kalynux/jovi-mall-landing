# Route map — every customer-reachable route, and the one document that covers it

**141 routes.** Generated from the live Express router on **2026-08-24**
(`FRONTEND-SYNC/tools/dump-routes.js` against `jovi-mall/src/app.ts` — 677 routes total), plus the
one tracking route the role filter misses.

This table exists so "is this documented?" is a lookup rather than a search. **Every route appears in
exactly one document.**

---

## 1 · How to regenerate this

```bash
cd backend/jovi-mall && node -r ts-node/register/transpile-only -r dotenv/config \
    ../FRONTEND-SYNC/tools/dump-routes.js "$(pwd)/src/app.ts"
```

If the total is no longer **677**, the backend moved and this map is stale.

⚠ **`FRONTEND-SYNC/evidence/routes-role-customer.txt` lists 140, not 141.** Its filter is
path-prefix based (`/api/customer`, `/api/public`, `/api/me`, …) and
**`GET /api/tracking/visible-agents` is not role-prefixed**, so it drops out. It is nonetheless
reachable by any authenticated customer — see [`tracking/README.md`](./tracking/README.md).

---

## 2 · Reconciliation

| Tree | Routes | Document |
|---|---:|---|
| `/api/auth/*` | 23 | [`auth/README.md`](./auth/README.md) · [`auth/customer-auth.md`](./auth/customer-auth.md) · [`auth/magic-login.md`](./auth/magic-login.md) · [`auth/onboarding.md`](./auth/onboarding.md) |
| `/api/me/*` | 16 | see § 2.1 |
| `/api/customer/*` | 62 | see § 2.2 |
| `/api/public/*` | 14 | see § 2.3 |
| `/api/files/*` | 7 | [`uploads/README.md`](./uploads/README.md) · [`files/private-files.md`](./files/private-files.md) |
| `/api/payments/*` | 4 | [`payments/README.md`](./payments/README.md) |
| `/api/products/*` | 4 | [`customer/bookings.md`](./customer/bookings.md) |
| `/api/digital/*` | 3 | [`customer/digital-products.md`](./customer/digital-products.md) |
| `/api/health/*` | 3 | [`health.md`](./health.md) |
| `/api/geo/*` | 2 | [`geo/README.md`](./geo/README.md) |
| `/api/bookings/*` | 2 | [`customer/bookings.md`](./customer/bookings.md) |
| `/api/tracking/*` | 1 | [`tracking/README.md`](./tracking/README.md) |
| **Total** | **141** | |

### 2.1 `/api/me/*` — 16 routes, shared across every role

| Routes | Count | Document |
|---|---:|---|
| `GET/POST /connections`, `DELETE /connections/:channel` | 3 | [`connections/README.md`](./connections/README.md) |
| `GET /contact`, `PATCH /email`, `DELETE /email/pending`, `PATCH /phone`, `POST /phone/confirm`, `DELETE /phone/pending` | 6 | [`me/contact-change.md`](./me/contact-change.md) |
| `GET/POST /payment-methods`, `GET /payment-methods/default`, `PATCH /payment-methods/:id/default`, `DELETE /payment-methods/:id` | 5 | [`customer/payment-methods.md`](./customer/payment-methods.md) |
| `PATCH /password` | 1 | [`me/password.md`](./me/password.md) |
| `POST /close` | 1 | [`me/account-closure.md`](./me/account-closure.md) |

⚠ **`POST /api/auth/email-change/confirm` is counted under `/api/auth/*`** but documented in
`me/contact-change.md`, because it is the second half of that flow. It is on the auth router and
**unauthenticated** — deliberately. That is the single most misplaced-looking route in this map.

### 2.2 `/api/customer/*` — 62 routes

| Prefix | Count | Document |
|---|---:|---|
| `/tickets` | 12 | [`customer/tickets.md`](./customer/tickets.md) |
| `/orders` | 9 | [`customer/orders.md`](./customer/orders.md) |
| `/cart` | 8 | [`customer/cart.md`](./customer/cart.md) |
| `/wishlist` (4) + `/recently-viewed` (3) | 7 | [`customer/saved-and-viewed.md`](./customer/saved-and-viewed.md) |
| `/notifications` (6) + `/devices` (2) | 8 | [`customer/notifications.md`](./customer/notifications.md) |
| `/bookings` | 6 | [`customer/bookings.md`](./customer/bookings.md) |
| `/addresses` (4) + `/profile` (3) | 7 | [`customer/profile.md`](./customer/profile.md) |
| `/reviews` | 3 | [`customer/reviews.md`](./customer/reviews.md) |
| `/payment-methods` | 2 | [`customer/payment-methods.md`](./customer/payment-methods.md) |

### 2.3 `/api/public/*` — 14 routes, the entire anonymous surface

| Route | Document |
|---|---|
| `GET /products` · `/products/:productId` · `/products/:productId/related` | [`public/catalog.md`](./public/catalog.md) |
| `GET /stores` · `/stores/:slug` · `/stores/:slug/products` · `/stores/:storeSlug/products/:productSlug` | [`public/catalog.md`](./public/catalog.md) |
| `GET /categories` | [`public/catalog.md`](./public/catalog.md) |
| `GET /products/:productId/reviews` | [`customer/reviews.md`](./customer/reviews.md) |
| `GET /articles` · `/articles/index` · `/articles/:slug` | [`public/articles.md`](./public/articles.md) |
| `GET /plans` · `/credit-packs` | [`public/README.md`](./public/README.md) |

---

## 3 · The anonymous surface, stated once

⚠ **`/api/public/*` is the only unauthenticated route tree**, besides:

- the auth endpoints themselves,
- `POST /api/auth/email-change/confirm`,
- `GET /api/products/:productId/availability` (the single booking availability read),
- `POST /api/payments/{initiate,verify}` and `POST /api/payments/:transactionId/authorize`,
- `GET /api/digital/download/:token` (the token is the credential),
- `/api/health/*`.

Everything under `/api/public` is read-only, carries no identity, and returns no owner-scoped data.
Rate limit **3000/min**.

⚠ **Product URLs are nested under their store.**
`GET /api/public/stores/:storeSlug/products/:productSlug` is the canonical shape. A flat product URL
exists **by id only** (`/products/:productId`) — there is no flat slug route.

---

## 4 · What a customer client cannot reach

Named here so nobody goes looking:

| Tree | Why |
|---|---|
| `/api/vendor/*` · `/api/agency/*` · `/api/agent/*` | other roles; a JWT is scoped to one active role |
| `/api/internal/*` | service tokens only |
| `/api/webhooks/*` | provider-facing; five routes, provider-shaped bodies, no envelope |
| `/api/admin/*` | **deleted.** wi-admin serves the admin surface at `/api/v1/*` |

---

## 5 · Documents that cover no route

Legitimately — they are concepts, changelogs, or requirement records.

| File | What it is |
|---|---|
| `MIGRATION-2026-08.md` | what changed since this mirror was last refreshed |
| `error-codes.ts` | the 603-code registry, copied from backend source |
| `errors/README.md` · `rate-limits.md` · `system-uptime-status.md` | cross-cutting contract |
| `reviews.md` | the cross-role review model; the customer's half is `customer/reviews.md` |
| `notifications/whatsapp-templates.md` | what the bot sends |
| `ticket_types.txt` | the `TicketType` picker list |
| `whatsapp/README.md` | the bot bridge |
| `tracking/{live-tracking,agent-tracking-policy,shipment-destination}.md` | the jovi-mall side of the tracking seam |
| `tracking/geo-tracker/*` | a **different service** — see § 6 |
| `FRONTEND-CHANGELOG-*.md`, `customer/FRONTEND-CHANGELOG-*`, `public/FRONTEND-CHANGELOG-*` | break notices |
| `phase-d-0-1/customer-app.md` | the payments phase record |
| `mobile-auth-backend-spec.md` | the spec the mobile auth namespace was built to |
| `public/BACKEND-*.md`, `customer/BACKEND-REQUIREMENTS-order-detail.md` | **this app's own asks to the backend** — see § 7 |

---

## 6 · geo-tracker routes are not in this count

The 141 above are **jovi-mall only**. Live tracking needs a second service, unversioned and mounted
at the root. The customer client touches exactly one of its routes:

```
GET {geo-tracker}/ws/track     WebSocket, viewer role
```

Full contract: [`tracking/geo-tracker/tracking-websocket.md`](./tracking/geo-tracker/tracking-websocket.md).

---

## 7 · The `BACKEND-*` documents are this repository's outbound channel

`public/BACKEND-REQUIREMENTS.md`, `public/BACKEND-SHOP-REQUIREMENTS.md`,
`public/BACKEND-BLOG-REQUIREMENTS.md` and `customer/BACKEND-REQUIREMENTS-order-detail.md` are how
this app *asks* the backend for things — they are requirements, not contracts.

**They are kept deliberately.** They are mirrored in the backend too, and each carries a status
banner recording what was built. Deleting them would remove the record of why several `/api/public`
routes exist at all.

⚠ **Do not read them as descriptions of the current API.** Where one disagrees with a contract page
in this folder, the contract page wins — and where the contract page disagrees with source, source
wins.
