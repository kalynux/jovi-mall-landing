# Private files and the `access` field

**Every referenced file on this platform is a `FileDetail` object, never a URL string** — and since
Phase 4 some of them have **no URL at all**.

> **Verified against source on 2026-09-08** — the `FileDetail` shape, all **three** `access`
> values and their precedence. Resolver:
> `src/modules/catalog/read-models/file-detail.resolver.ts`. Type:
> `.../product-detail.read-model.ts`. Classification: `src/core/storage/storage-trees.ts`.
> Break notes:
> [`../FRONTEND-CHANGELOG-private-files.md`](../FRONTEND-CHANGELOG-private-files.md).
>
> 🆕 **`access` gained a third value, `"quota_blocked"`, on 2026-09-07.** It is **not** about
> privacy and it reaches **public** trees — product photos included. See [§ 1.2](#12--the-third-value-quota_blocked).

---

## 1 · The shape

```jsonc
{
  "id": "66b1...",
  "key": "digital/2026/08/9f2c..._manual.pdf",
  "url": null,                    // string | null
  "access": "authorized",         // "public" | "authorized" | "quota_blocked"  - ALWAYS present
  "mimeType": "application/pdf",
  "size": 284119,
  "originalName": "manual.pdf"
}
```

```ts
// The resolver, in order. The quota check runs FIRST and that ordering is load-bearing.
if (file.quotaBlockedAt) return { url: null, access: 'quota_blocked', ... }
url    = isPrivate ? null : storage.getPublicUrl(file.key)
access = isPrivate ? 'authorized' : 'public'
```

**`url` and `access` are derived together**, so they can never disagree: `url` is a string when
and only when `access === "public"`. Branch on `access`; treat `url === null` as the same signal
but **not** as a single meaning — there are now two reasons for it and they need different screens.

### 1.1 Why a type change and not a different string

An authorized path looks **exactly** like a public URL. Had the backend simply returned a different
string, a client keeping `<img src={url}>` would have shipped a broken image to every signed-out
visitor and nobody would have noticed until support did. `null` breaks loudly, at the point of use.

### 1.2 · The third value: `quota_blocked`

| `access` | `url` | What it means |
|---|---|---|
| `"public"` | a real URL | ordinary media — render it |
| `"authorized"` | **`null`** | the file is in a private tree (§ 2); reachable only through a route that checks who is asking (§ 3) |
| `"quota_blocked"` | **`null`** | **the file's owner is over their storage plan** |

`quota_blocked` is a **billing** state, not a privacy one and not a missing file. The row, the
bytes and the file's contribution to the owner's used storage all survive — blocking is what a
vendor gets *instead* of losing data when a downgrade puts them over the cap, and the file comes
back unchanged the moment they upgrade or free room.

⚠ **This one reaches public trees.** The quota check and the tree classification are independent,
so a product photo in `images/` — the most ordinary file on the storefront — can come back
`quota_blocked`. **A storefront that only handles `null` on the digital surface will show broken
images on product cards.**

⚠ **`quota_blocked` outranks `authorized`.** A blocked file that also sits in a private tree
reports `quota_blocked`. Check it first, or you will send the client to an authorized route and
get an answer about permissions when the real problem is billing.

**For a public storefront**, render the ordinary image placeholder — the same one you use for a
product with no photo. Do **not** show a customer anything about the vendor's plan, and do not
say "image deleted": nothing was deleted.

---

## 2 · What is private, and what is not

| Tree | Visibility | Why |
|---|---|---|
| `digital/` | 🔒 **authorized** | a vendor's digital product, sold to a named buyer |
| `shipments/` | 🔒 **authorized** | a delivery-proof photo — a delivery address and a timestamped location |
| `ticket-attachments/` | 🔒 **authorized** | legacy; holds one pre-existing file |
| `images/` `videos/` `audio/` `documents/` `archives/` `other/` | 🌍 public | general upload intake — avatars, logos, banners, product imagery |
| `products/` `variants/` | 🌍 public | product media |
| `vendor-policy-documents/` `agency-policy-documents/` | 🌍 public | both endpoints **return the public URL** for the owner to submit back |
| `system/` | 🌍 public | no writer today; classified so it cannot become a surprise |

**For a customer client this means:** product imagery, avatars and store branding are unchanged and
still carry a URL. **Digital product assets do not.**

### 2.1 It is an allowlist, and unknown means private

Every tree carries an **explicit verdict**, and an unclassified one is treated as **private** — the
safe direction. `test:uploads` asserts that every folder any writer in `src/` can name is
classified, so an unclassified tree fails a test suite rather than 404ing in production.

**So a storage tree added next year is private until somebody deliberately says otherwise.** Do not
build a client that assumes a new `key` prefix will be publicly fetchable.

### 2.2 ⚠ A ticket attachment uploaded *today* is still public

Despite the legacy `ticket-attachments/` tree being private. A ticket attachment is an ordinary
`POST /api/files/upload` that lands in `documents/` or `images/` and is attached to the ticket by id
afterwards. **Making those private needs a dedicated upload path that does not exist yet.**

Do not tell a customer their ticket attachment is private. It is not.

---

## 3 · Reading an authorized file

`access: "authorized"` means **there is no URL you can put in an `<img>` or an `<a href>`.** The
file is reachable only through a route that checks who is asking.

For a customer, the one such route is the digital-download flow:

```
POST /api/digital/download-links     -> mint a single-use token
GET  /api/digital/download/:token    -> spend it
```

See [`../customer/digital-products.md`](../customer/digital-products.md).

### 3.1 What the private mount actually closed

Before ADR-A01 D-2, `api/index.ts` served the **whole** of `storage/` through one unguarded
`express.static`, and a stored file's `url` *is* that path. So a digital product's file and an
agent's delivery-proof photo were fetchable by anyone holding the URL, **forever**.

For the digital tree that made three enforcement mechanisms **advisory**: the download token's
single-use consumption, its download counter, and its revocation were all bypassed by the raw path —
permanently, with nothing recording that it happened.

**That is why a download token is worth using properly.** Do not cache the resolved storage path and
re-fetch it later; it will not work, and it is not meant to.

---

## 4 · Client checklist

- [ ] Never render `url` without checking `access` first.
- [ ] Handle **all three** `access` values, and check `quota_blocked` **before** `authorized`.
- [ ] Never treat `url === null` as "no file" — the file exists; `id`, `key`, `mimeType`, `size` and
      `originalName` are all still there. Render a name and a download action, not an empty slot.
- [ ] Never say "deleted" or "missing" for a `quota_blocked` file. Nothing was deleted.
- [ ] Never store a resolved public URL as if it were stable across trees.
- [ ] Do not assume a new tree is public.
