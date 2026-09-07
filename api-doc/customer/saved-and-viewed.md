# Saved products & recently viewed — `/api/customer/{wishlist,recently-viewed}`

**Verified against source on 2026-09-08** — all seven routes, both request schemas, the entry
DTO’s nullable `product`, the recently-viewed cap and all four error codes, against
`jovi-mall/src/modules/customers/` (routes, controller, validators, services, dto, config).

**Seven routes. Both lists are server-side.** The storefront's `/shop/saved` page works from
`localStorage` today (`src/components/shop/providers/FavoritesProvider.tsx`, key
`wi-mall-shop-favorites`) and does not survive a device change, a browser reset or a sign-in on a
phone. This is the same list, kept on the server.

> **Verified against source on 2026-09-08.** Routes: `src/modules/customers/routes.ts:84-91`.
> Handlers: `controllers/customer-catalog.controller.ts`. Shapes:
> `validators/customer-catalog.validator.ts`, `dto/customer-catalog.dto.ts`.
>
> ⚠ **Deliberately extended from the backend's copy of this page** — § 5 (migrating off
> `localStorage`) is specific to this app and has no backend counterpart. A drift check will
> report this file as differing from `jovi-mall/api-doc/customer/saved-and-viewed.md`. **That is
> intentional, not staleness.** See `README.md` § 9.

---

## 1 · The routes

| Method | Path | What |
|---|---|---|
| `GET` | `/api/customer/wishlist` | saved products, **newest save first** |
| `POST` | `/api/customer/wishlist` | save a product — **idempotent, 200** |
| `POST` | `/api/customer/wishlist/saved-among` | which of these ids are saved (one call per grid) |
| `DELETE` | `/api/customer/wishlist/:productId` | remove a save |
| `GET` | `/api/customer/recently-viewed` | **most recently opened first** |
| `POST` | `/api/customer/recently-viewed` | record that a product was opened |
| `DELETE` | `/api/customer/recently-viewed` | forget everything |

All seven sit behind `requireAuth` + `requireRole(['customer'])`. Every handler resolves the owner
from `req.auth.role_entity._id` — **the customer id, never a body field or a path segment** — so
there is no parameter a caller could set to reach somebody else's list.

⚠ **`/wishlist/saved-among` is declared before `/wishlist/:productId`** and the order is
load-bearing. Both are two-segment paths under `/wishlist`; reversed, the literal would be
swallowed by the parameter. Today they differ by verb so they could not actually collide, but a
`GET` added on either later would make them collide silently.

---

## 2 · One entry shape, both lists

`GET` on either list returns `data: CustomerCatalogEntry[]` with the standard `meta` pagination
block. `?page` (>= 1, default 1) and `?limit` (1-100, default **20**).

```jsonc
{
  "productId": "66b1f0a2c3d4e5f6a7b8c9d0",   // always present, even when the product is gone
  "at": "2026-08-22T14:31:07.220Z",           // wishlist: saved at - recently-viewed: last opened at
  "product": { /* ... */ } | null             // a /api/public/products card, or null
}
```

`product` is **identical in shape to a `/api/public/products` row** — the same builder
(`PublicProductListItemDto`) produces both, deliberately, so the storefront never grows a second
product shape. Everything in [`../public/catalog.md`](../public/catalog.md) about that card applies
here, **including the stock-semantics trap: `inStock` is a boolean and never a count.**

### 2.1 🔴 `product: null` is a feature, not an error

**Entries degrade rather than vanish.** A vendor can archive a listing, an agency can suspend one
over unpaid storage, an administrator can take one down, a vendor can be suspended with their whole
catalogue. **Nothing cascades into these collections** — a product coming back off suspension finds
its wishlists intact.

So a row can outlive its product, and the read degrades it: `productId` and `at` survive,
`product` is `null`. Render *"this item is no longer available"* beside a working remove button.

Three consequences a client must handle:

- **Never assume `product` is non-null.** One archived product must not break the whole list.
- **The list does not shrink.** A customer who saved twelve things sees twelve rows, and `meta.total`
  matches what is rendered. (Dropping unresolvable rows was the rejected alternative precisely
  because the totals stop matching.)
- **Deleted and merely-suspended are deliberately indistinguishable.** Telling them apart would leak
  a vendor's catalogue state to anyone who once saved a product — the same oracle the public
  catalogue refuses to be when it answers `404` rather than `403`.

---

## 3 · Wishlist

### `POST /api/customer/wishlist`

```jsonc
{ "productId": "66b1..." }        // 24 hex, .strict() - an unknown key is a 400
```

**Answers `200`, not `201`, and it is idempotent.** Saving something already saved returns the same
entry, not a `409`: from the customer's side *"it is saved"* was already true, and a double-tap must
not surface as a failure for an operation that succeeded.

The idempotency is the **unique index** `(customer_id, product_id)`, not a `findOne` before the
insert — two taps race, and check-then-write loses that race silently, leaving the same product
twice and every count wrong.

⚠ **The index is registered as a migration** (`migrate:customer-catalog-indexes`) because
`autoIndex` is off in production. Without it the uniqueness is enforced by nothing, which is
indistinguishable from working until two people click quickly.

**Saving does not require the product to be in stock or its store to be open.** The one gate is
publishability: a product the caller could never have been shown answers
`404 CATALOG_PRODUCT_NOT_FOUND`. What may *enter* the list and what may *stay* in it are different
rules, and they are not in tension.

### `POST /api/customer/wishlist/saved-among`

```jsonc
{ "productIds": ["66b1...", "66b2..."] }   // 1-100 ids, .strict()
// ->
{ "savedProductIds": ["66b1..."] }
```

**One call per rendered grid, not one per card** — that is the whole reason it exists. It is a
`POST` because 100 ids is ~2.5 KB of query string; it reads and writes nothing. The verb is
transport, not semantics.

### `DELETE /api/customer/wishlist/:productId`

`404 WISHLIST_ITEM_NOT_FOUND` if it is not on the list. **Another customer's row is *not found*,
never *forbidden*** — every query is scoped by `customer_id`, so the delete simply matches nothing.
A `403` would confirm the row exists.

---

## 4 · Recently viewed

### `POST /api/customer/recently-viewed`

```jsonc
{ "productId": "66b1..." }        // .strict()
```

⚠ **Carries no timestamp, and cannot be made to.** The list is ordered *and capped* by this value,
so a client-supplied "viewed at" is a client-chosen position in a bounded list — a caller could pin
an entry at the head forever, or evict every real entry by claiming a time in the future. The
validator has no such field at all, so it cannot be relaxed by accident. The server clock is the
only source.

**Re-viewing moves an entry to the head; it does not duplicate it.** This is the one behavioural
difference from the wishlist, and it is deliberate:

| | Repeat write |
|---|---|
| **Wishlist** | keeps the original `created_at` — a list is ordered by when you *decided*, and tapping save twice is not a new decision |
| **Recently viewed** | overwrites `viewed_at`, moving the entry to the head — a history is ordered by when you last *looked* |

Same publishability gate as the wishlist: an unpublishable product answers `404`.

### 🔴 The cap is the entire retention policy

`CUSTOMER_RECENTLY_VIEWED_CAP`, **default 20**, enforced on write by evicting the oldest.

**There is no TTL and no age-based pruning.** A cap rather than a time window is deliberate — a TTL
prunes on Mongo's own schedule (up to 60 s late, and only while the sweeper runs), so a customer
browsing quickly would see a list that is sometimes 20 long and sometimes 200. Explicit eviction
makes the length a fact the client can rely on.

⚠ **A cap is not a page size.** `?limit` (<= 100) is how many rows you fetch; the cap is how many
rows *exist*. Asking for `?limit=100` returns at most 20.

### `DELETE /api/customer/recently-viewed`

```jsonc
{ "removed": 7 }
```

Forgets everything, and **also clears the legacy `Customer.recent_product_code`** — leaving that set
would make the profile still answer "the last thing you looked at" after the person asked for
exactly that to be forgotten. A history a customer cannot clear is a history they did not agree to
keep, and this one has no TTL.

---

## 5 · Migrating off `localStorage`

The storefront currently keeps favourites at `localStorage["wi-mall-shop-favorites"]` as a plain
array of product ids, with a one-time carry-over from the pre-rename key `wimall-shop-favorites`
(`FavoritesProvider.tsx:14-15`). There is **no recently-viewed implementation in the app at all** —
only `recent-searches.ts`, which is a different thing (search terms, not products).

A migration has to answer one question the API does not answer for you: **what happens to a
signed-out shopper's saves.** The endpoints are all `requireRole(['customer'])`, so there is no
anonymous wishlist server-side — unlike the cart, which has `POST /api/customer/cart/merge` for
exactly this. **There is no `wishlist/merge`.**

The shape that follows from that:

1. Keep `localStorage` as the anonymous store, unchanged.
2. On sign-in, replay the local ids through `POST /api/customer/wishlist` — it is idempotent, so
   replaying is safe and needs no diff. A `404` means that product is gone; drop it.
3. Once signed in, read from the server and stop writing local.
4. Hearts on a grid come from one `saved-among` call, not one call per card.

⚠ **Do not clear the local key on sign-out** until you are confident the replay works — it is the
only copy an anonymous shopper has.

---

## 6 · Errors

| Code | Status | When |
|---|---|---|
| `CATALOG_PRODUCT_NOT_FOUND` | 404 | saving or recording a product that is not publishable to you |
| `WISHLIST_ITEM_NOT_FOUND` | 404 | removing something not on your list — **also** the answer for another customer's row |
| `VALIDATION_ERROR` | 400 | a `productId` that is not 24 hex; an unknown body key (both schemas are `.strict()`); `productIds` empty or over 100 |
| `AUTH_ROLE_NOT_FOUND` | 403 | authenticated, but not as a customer |

---
