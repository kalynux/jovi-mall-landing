# What changed since these docs were last refreshed

**Written 2026-08-24, from source.** Short, because this repository is in good shape — but two of
these are breaking and one is a behaviour the app is currently reimplementing client-side.

> **Read this before trusting anything else in `api-doc/`.** Every claim below was verified against
> the backend implementation, not against a document. Where source and a document disagreed, the
> document lost and the disagreement is filed in `backend/FRONTEND-SYNC/03-FINDINGS-REGISTER.md`.

---

## 0 · First, the good news, with a date on it

**Re-verified 2026-08-24 and still true:**

| Claim | Evidence |
|---|---|
| **Zero documentation drift** | `doc-drift.js`: 31 mirrored files, **31 identical, 0 drifted, 0 orphaned** |
| **Zero dead calls** | `call-audit.js`: 42 path literals, 36 matched, **6 unmatched — all opened and all benign** |
| Backend routes unchanged since the audit | route dump regenerated: **677 routes, byte-identical** |

The six unmatched literals are the namespace constants `SESSION_NS` and `MAGIC_NS`
(`auth.api.ts:27,208`), a comment at `auth.api.ts:25` stating that `/api/auth/mobile/me` does *not*
exist, and a docblock at `digital.api.ts:2`. **None is a call.**

`landing` remains the only one of the five frontends with both properties, and the only one calling
the current messaging endpoint. That is not a coincidence — these apps are built from their doc
mirror, so the mirror's accuracy is the app's correctness.

---

## 1 · 🔴 Wishlist and recently-viewed are server-side now

**Seven routes exist and the app uses none of them.**

`src/components/shop/providers/FavoritesProvider.tsx` keeps favourites in
`localStorage["wi-mall-shop-favorites"]`. That list does not survive a device change, a browser
reset, or signing in on a phone. There is **no recently-viewed implementation at all** —
`recent-searches.ts` stores search terms, which is a different thing.

```
GET/POST         /api/customer/wishlist
POST             /api/customer/wishlist/saved-among      <- one call per grid, not per card
DELETE           /api/customer/wishlist/:productId
GET/POST/DELETE  /api/customer/recently-viewed
```

Two properties that change how you build the UI:

- **Entries degrade rather than vanish.** A row can outlive its product; the read returns
  `product: null` with the `productId` and timestamp intact. **Never assume `product` is non-null**,
  and do not filter those rows out — the list length and `meta.total` are meant to match.
- **Recently-viewed is capped at 20 and has no TTL.** The cap *is* the entire retention policy.

**There is no `wishlist/merge`** — unlike the cart, which has one. Full contract and a migration
shape: [`customer/saved-and-viewed.md`](./customer/saved-and-viewed.md).

---

## 2 · 🔴 `FileDetail.url` is `string | null`, and there is a new `access` field

Every referenced file comes back as an object, never a URL string:

```jsonc
{
  "id": "66b1...",
  "key": "digital/2026/08/9f2c..._manual.pdf",
  "url": null,                  // string | null   <- was ALWAYS a string
  "access": "authorized",       // "public" | "authorized"   <- NEW, always present
  "mimeType": "application/pdf",
  "size": 284119,
  "originalName": "manual.pdf"
}
```

**Branch on `access`.** This is deliberately a *type* change rather than a silently different
string, because an authorized path looks exactly like a public URL — a client keeping
`<img src={url}>` renders nothing for anyone not signed in.

**Customer-facing impact is narrow but real:** the private trees are `digital/` (digital product
assets) and `shipments/` (delivery-proof photos). **Everything else keeps its exact URL** — product
imagery, avatars, store logos and banners, videos, general documents.

⚠ **A ticket attachment uploaded today is still public.** It is an ordinary
`POST /api/files/upload` landing in `documents/` or `images/`. Making those private needs a
dedicated upload path that does not exist yet.

Details: [`FRONTEND-CHANGELOG-private-files.md`](./FRONTEND-CHANGELOG-private-files.md).

---

## 3 · 🔴 A session is capped at 90 days, absolutely

However often it refreshes. Announced by a new terminal 401:

```
AUTH_SESSION_CAP_REACHED   ->  route to sign-in. NEVER retry.
```

Before this, the 30-day refresh window slid forever. **A client that treats every 401 as "refresh
and retry" now loops.** `AUTH_PASSWORD_CHANGED` is terminal in the same way — and account closure
stamps it, so a closed account's every device gets it.

---

## 4 · Order detail gained a delivery agency and a carrying agent

ADR-A06, 2026-08-23. This reversed a rule four documents had called settled, so do not go looking
for the old "the customer never learns who is carrying it" statement — it is superseded for the
order-detail page.

### ⚠ `visibleFrom` is `"shipped"`, **not** `"out_for_delivery"`

```ts
// src/modules/orders/dto/customer-shipment.dto.ts:131
export const AGENT_IDENTITY_VISIBLE_FROM: CustomerShipmentStatus = 'shipped';
```

The two are not the same thing and the difference is visible to a user: identity appears **earlier**
than "out for delivery" would imply. Read the constant, do not hardcode either string.

**Three fields and no more — in particular no phone number.** The platform's position is that a
customer contacts the **agency** (`agency.supportPhone`), not the agent. Identity is revoked once
the parcel settles.

⚠ **This does not extend to reviews.** A delivery review still attributes to the agent
*server-side*, and the review endpoints do not disclose them. Do not build a review form that names
the agent.

Details: [`customer/FRONTEND-CHANGELOG-order-detail.md`](./customer/FRONTEND-CHANGELOG-order-detail.md).

---

## 5 · A refused payment initiation no longer marks the order `AWAITING_PAYMENT`

The failure mode this fixes is the one a shopper reports as *"the app said it was waiting for my
payment and my phone never rang."*

A refused initiation — bad credentials, an operator the gateway will not route, a provider 4xx —
now leaves the order at **`pending`**, which is equally payable, so **the retry path is untouched**.
It is deliberately not written as `failed`: only cancellation writes that, and a declined attempt
that poisoned the order would make every retry impossible.

```ts
// payment-orchestrator.service.ts:227 - it used to advance unconditionally
if (order.payment_status === 'pending' && gatewayResult.success) { ... }
```

⚠ **Branch on `status`, not the HTTP code.** A gateway that refuses the charge returns **`200`**
carrying `status: "FAILED"`. Only a transport-level failure is a `502`.

---

## 6 · A `null` address `location` no longer blocks every write to a customer

A `null` inside a `2dsphere`-indexed array **bricks the whole document** — and sparse and partial
indexes do *not* fix it (measured). The fix is to **omit the key** rather than send `null`.

This is why "add a second saved address" was once impossible. **Relevant to the address form:** send
no `location` key at all when you have no coordinates. Do not send `location: null`.

---

## 6.5 · Two order-path defects were open, and are now closed

Both were surfaced by the customer seed and both are **fixed** — verified in source on 2026-08-24.
Recorded here because older notes still describe them as open, and one of them changes whether you
can trust a number the storefront renders.

| Was | Now |
|---|---|
| **The stock commit was a silent no-op.** `{ stock: { $inc: -n } }` was funnelled through `$set`, so Mongo received `$set: { stock: { $inc: -1 } }`, threw a CastError, and it was swallowed. `variant.stock` was never decremented, so the overselling protection never ran | `variant.repository.mongo.ts:129` has a dedicated `adjustStock(id, delta)` issuing a real `$inc`. `StockCommitService.ts:109` and `order-stock.service.ts:253` both call it |
| **`markProductsOrdered` threw on every paid order**, so `lastOrderedAt` was never stamped — the inactivity clock the file-cleanup sweep reads | `order.service.ts:1141` has an `idOf` helper that survives a populated document, an `ObjectId` or a 24-hex string |

**What this means for the storefront:** stock levels are decremented at commit again, so `inStock`
reflects reality. ⚠ **`adjustStock` is deliberately not guarded at zero** — a committed reservation
may legitimately drive the counter negative where the variant allows oversell, and the vendor needs
to see that number. **Do not clamp a negative stock to 0 in the UI**; it is information, not a bug.

Neither fix changed the wire format. Filed as **F-32**.

---

## 7 · Rate limits exist now

There were none before. All are **backstops, not budgets** — a well-behaved client never sees one.

| Class | Per minute |
|---|---:|
| `/api/public/*` | **3000** |
| customer identity | **600** |
| global, per IP | 1200 |
| auth endpoints | **20** |
| auth session ops | 300 |

`429` carries `RATE_LIMIT_EXCEEDED`. ⚠ **`Retry-After` is not readable by a browser client** unless
it is CORS-exposed — treat its absence as normal and back off on your own schedule.

geo-tracker is separate: 600/min per IP, burst 60.

---

## 8 · Things that are NOT changes, and must not be "fixed"

| Looks wrong | It is deliberate |
|---|---|
| `POST /api/payments/initiate` and `/verify` take **no credentials** | Payment links are shareable — a mother orders and a son pays. Raised as finding F-C and **withdrawn**. `/:transactionId/authorize` is unauthenticated for the same reason |
| `PaymentStatus` mixes casing — `'AWAITING_PAYMENT'` among six lowercase | Real, and **not being fixed**: changing it is a data migration across live orders, and the standing decision is "no data migrations pre-production". **Do not lowercase before matching** |
| Payment routes return a **flat** body, not `{ data }` | Four routes predate the envelope. `apiFetch` already handles it — it only unwraps when `data` is present |
| `GET /api/me/connections` requires a session | Correct. It is useless on a logged-out marketing page |
| `X-Client-Type: mobile` is not documented | It was **requested and declined**. The namespace split (`/api/auth/mobile/*`) is the mechanism |
| Tickets use `pagination`, not `meta` | Three endpoints only. Fields inside are identical |
| A newly-authorised tracking viewer is refused | **Grants are not pushed**, only revocations. Waits for a cache TTL; a reconnect does not help |

---

## 9 · New since the last refresh, and previously undocumented here

| Surface | Document |
|---|---|
| **Live delivery tracking for the customer** | [`tracking/README.md`](./tracking/README.md) — two services, one token |
| Product **and delivery** reviews | [`customer/reviews.md`](./customer/reviews.md) |
| Account closure (**anonymise-and-retain, not deletion**) | [`me/account-closure.md`](./me/account-closure.md) |
| Email / phone change | [`me/contact-change.md`](./me/contact-change.md) |
| Payments, incl. the one-time-code step | [`payments/README.md`](./payments/README.md) |
| Address search for checkout | [`geo/README.md`](./geo/README.md) |
| Uploads | [`uploads/README.md`](./uploads/README.md) |
| **Fourteen changelogs that had never reached any frontend** | see § 10 |

---

## 10 · The changelogs that never arrived

The backend wrote fourteen documents whose entire purpose is to tell frontends what broke.
**Not one had reached any frontend repository** (finding F-6). These are now here:

```
FRONTEND-CHANGELOG-phase-2-3.md · FRONTEND-CHANGELOG-phase-4-5.md
FRONTEND-CHANGELOG-private-files.md · FRONTEND-CHANGELOG-bargainable-pricing.md
customer/FRONTEND-CHANGELOG-phase-{2-3,4-5}.md
public/FRONTEND-CHANGELOG-phase-{2-3,4-5}.md
tracking/geo-tracker/FRONTEND-CHANGELOG-phase-{2-3,4-5}.md
phase-d-0-1/customer-app.md
```

**This is a process failure, not a documentation one** — the propagation step does not exist. See
`README.md` § 8 for the proposal.
