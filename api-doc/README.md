# `landing` API contract — marketing site · storefront · customer account

**Verified against source on 2026-09-08** — the two counts in § 5 and § 9.2 re-derived from
backend source today: the error registry is **640** codes on both sides
(`jovi-mall/src/core/error-codes.ts`, and this folder's own `error-codes.ts`), and jovi-mall serves
**764** routes overall. **Sections 11 and 12 are new** — the conventions and the phone/email rules,
which eleven links on other pages in this folder were already pointing at and which this README did
not carry (verified against `src/core/validation/{phone,email,zod.helpers}.ts`).

*(Previously: last verified against backend source 2026-08-24.)*

This folder is the specification this application is built from. It is not decoration — where it is
wrong, the app is wrong.

> ### Read these two first
>
> 1. **[`MIGRATION-2026-08.md`](./MIGRATION-2026-08.md)** — what changed since this mirror was last
>    refreshed. Two breaking changes and one capability the app is reimplementing client-side.
> 2. **[`auth/customer-auth.md`](./auth/customer-auth.md)** — **why there is no signup form.**
>    If you read one page, read that one.
>
> Newest change: **[`FRONTEND-CHANGELOG-email-verification.md`](./FRONTEND-CHANGELOG-email-verification.md)**
> (2026-08-24) — this app now serves **both** emailed-token pages for all four Wi-Mall apps.
> Registration verification moved off the API and onto `/verify-email`, and both links carry
> `app=<role>` so the page knows which dashboard to send the person back to.

---

## 1 · Three audiences, one Next.js app

| | What it is | Session | Reads |
|---|---|---|---|
| **Marketing** | acquisition for all four roles | 🔴 **never** | `/api/public/*` only |
| **Storefront** | the public catalog, nested under stores | optional | `/api/public/*`, plus cart/checkout when signed in |
| **Account** | orders, bookings, saved items, tickets, connections | required | `/api/customer/*`, `/api/me/*` |

⚠ **The marketing site is a separate consumer with no session, ever.** Do not document or call a
session-bearing endpoint from a logged-out marketing page. Its asks to the backend go through
[`public/BACKEND-REQUIREMENTS.md`](./public/BACKEND-REQUIREMENTS.md) and come back as `/api/public`
routes.

Users are shoppers in Francophone Central Africa (Cameroon first), mobile-dominant, often on
low-bandwidth connections, **who buy by chatting on WhatsApp with an AI assistant.** That framing is
not decoration either — it is why customer auth has no password and no registration form.

---

## 2 · 🔴 Customer authentication, in six lines

**There is no registration endpoint and no password field for customers.**

- The account is created on the customer's **first contact with the WhatsApp/Telegram bot**.
- Sign-in redeems a bot-issued magic link or **8-character code** at `POST /api/auth/magic/{link,code}`
  (bearer clients: `/api/auth/mobile/magic/*`).
- A storefront **deep-links to the bot** and calls no registration endpoint.
- A customer holds a system-generated password nobody knows, so `POST /api/auth/login` is not their
  path unless they have run a password reset.
- ⚠ **Bot-side registration is not built yet** — it lands with the n8n work. The contract is
  documented; the producer is inert.

Full chapter: [`auth/customer-auth.md`](./auth/customer-auth.md) ·
[`auth/magic-login.md`](./auth/magic-login.md)

---

## 3 · Base URLs and the two auth modes

| Service | Dev | Purpose |
|---|---|---|
| jovi-mall | `http://localhost:8022/api` | everything below except the live map |
| geo-tracker | `http://localhost:8080` | the live delivery map only — **unversioned, mounts at root** |

**The delivery mode is chosen by route namespace, never by a header.**

| | Browser | Capacitor / WebView |
|---|---|---|
| Namespace | `/api/auth/*` · `/api/auth/browser/*` | `/api/auth/mobile/*` |
| Credential | HttpOnly cookies (access 15 min, refresh 30 d) | `data.tokens` — no cookie is set |
| Every request | `credentials: 'include'` | `Authorization: Bearer …` |
| Expired access | silently refreshed server-side | `401 AUTH_TOKEN_EXPIRED` — **never silent** |
| Renewal | none needed | `POST /api/auth/mobile/refresh` |

⚠ **Do not ask for `X-Client-Type`.** It was requested and **declined** — geo-tracker's CORS allows
a closed header list, so a new request header would have forced an edit in two repositories. The
namespace split is the mechanism, and it makes "browser behaviour is unchanged" true by
construction.

⚠ **Both present → bearer wins.** `Authorization` is read before the cookie.

⚠ **Capacitor origins must be in `ALLOWED_ORIGINS`** — `capacitor://localhost`, `https://localhost`.
One variable drives geo-tracker's HTTP CORS **and** its WebSocket origin check.

### Terminal 401s — route to sign-in, never retry

`AUTH_PASSWORD_CHANGED` · `AUTH_SESSION_CAP_REACHED` (the 90-day absolute cap)

---

## 4 · The response envelope

```jsonc
{ "success": true, "data": …, "meta": { "total": 120, "page": 1, "limit": 20, "pages": 6 } }
{ "success": false, "requestId": "req_…",
  "error": { "code": "…", "message": "…", "statusCode": 401, "category": "…", "details": {…} } }
```

- **Branch on `error.code`**, never `error.message`.
- `details` is **omitted entirely** when absent — not `null`, not `{}`.
- `error.category` is one of nine and is **always present**; use it as the default branch.
- An empty list has **zero pages**, not one.

**Three exceptions this app actually hits:**

| Exception | Where |
|---|---|
| `pagination` instead of `meta` | `GET /api/customer/tickets` and the two `tickets/reference/*` lookups |
| **No `data` key at all** — a flat body | the four `/api/payments/*` routes. `apiFetch` already handles it: it unwraps only when `data` is present (`src/lib/api/client.ts:320`) |
| provider-shaped bodies | `/api/webhooks/*` — no frontend calls them |

⚠ The claim *"`data` is always present on success"* appears in several shared docs. **It is false for
the payment routes.** Filed as **F-34**.

---

## 5 · Index

### Start here
| | |
|---|---|
| [`MIGRATION-2026-08.md`](./MIGRATION-2026-08.md) | what changed, and what must not be "fixed" |
| [`ROUTE-MAP.md`](./ROUTE-MAP.md) | **all 141 routes → the one document that covers each** |
| [`error-codes.ts`](./error-codes.ts) | the registry — **640 codes**, re-counted from backend source 2026-09-08 (the file was already current; this line was behind) |

### Marketing & storefront
| | |
|---|---|
| [`public/README.md`](./public/README.md) | the anonymous surface · plans · credit packs |
| [`public/catalog.md`](./public/catalog.md) | products, stores, categories |
| [`public/articles.md`](./public/articles.md) | the blog |
| [`public/FRONTEND-CHANGELOG-shop.md`](./public/FRONTEND-CHANGELOG-shop.md) | the storefront build record |
| [`FRONTEND-CHANGELOG-bargainable-pricing.md`](./FRONTEND-CHANGELOG-bargainable-pricing.md) | bargainable pricing — a shop concern |

### Authentication & account
| | |
|---|---|
| [`auth/customer-auth.md`](./auth/customer-auth.md) | 🔴 **canonical — read first** |
| [`auth/README.md`](./auth/README.md) · [`auth/magic-login.md`](./auth/magic-login.md) · [`auth/onboarding.md`](./auth/onboarding.md) | |
| [`auth/FRONTEND-CHANGELOG-mobile-auth.md`](./auth/FRONTEND-CHANGELOG-mobile-auth.md) · [`mobile-auth-backend-spec.md`](./mobile-auth-backend-spec.md) | the bearer namespace |
| [`me/password.md`](./me/password.md) · [`me/contact-change.md`](./me/contact-change.md) · [`me/account-closure.md`](./me/account-closure.md) | |
| [`connections/README.md`](./connections/README.md) | WhatsApp / Telegram linking — **the app already calls this correctly** |

### Shopping & the account area
| | |
|---|---|
| [`customer/cart.md`](./customer/cart.md) · [`customer/orders.md`](./customer/orders.md) · [`customer/bookings.md`](./customer/bookings.md) | |
| [`customer/saved-and-viewed.md`](./customer/saved-and-viewed.md) | 🔴 **replaces `localStorage`** |
| [`customer/reviews.md`](./customer/reviews.md) · [`reviews.md`](./reviews.md) | product **and** delivery |
| [`customer/profile.md`](./customer/profile.md) · [`customer/payment-methods.md`](./customer/payment-methods.md) | |
| [`customer/notifications.md`](./customer/notifications.md) · [`customer/tickets.md`](./customer/tickets.md) · [`ticket_types.txt`](./ticket_types.txt) | |
| [`customer/digital-products.md`](./customer/digital-products.md) | |
| [`payments/README.md`](./payments/README.md) · [`phase-d-0-1/customer-app.md`](./phase-d-0-1/customer-app.md) | |
| [`geo/README.md`](./geo/README.md) | address search on checkout |

### Delivery tracking
| | |
|---|---|
| [`tracking/README.md`](./tracking/README.md) | 🔴 **the customer's live map — two services, one token** |
| [`tracking/geo-tracker/tracking-websocket.md`](./tracking/geo-tracker/tracking-websocket.md) | the full socket contract |

### Files, errors, operations
| | |
|---|---|
| [`uploads/README.md`](./uploads/README.md) · [`files/private-files.md`](./files/private-files.md) | |
| [`errors/README.md`](./errors/README.md) · [`rate-limits.md`](./rate-limits.md) | |
| [`health.md`](./health.md) · [`system-uptime-status.md`](./system-uptime-status.md) | |
| [`notifications/whatsapp-templates.md`](./notifications/whatsapp-templates.md) · [`whatsapp/README.md`](./whatsapp/README.md) | |

---

## 6 · The customer's permission row, verified

A JWT is scoped to **one active role**. `customer` can reach:

```
/api/public/*      /api/customer/*    /api/me/*        /api/auth/*
/api/payments/*    /api/digital/*     /api/files/*     /api/geo/*
/api/products/*    /api/bookings/*    /api/health/*    /api/tracking/visible-agents
```

and **nothing else**. `/api/vendor/*`, `/api/agency/*`, `/api/agent/*` answer `403
AUTH_ROLE_NOT_FOUND`. `/api/internal/*` needs a service token. **`/api/admin/*` is deleted** — the
admin surface lives in a different service entirely.

Role switching is `GET /api/auth/auth-me/:role`, no password. 🔴 **`admin` is not a role you can
authenticate as in jovi-mall.**

---

## 7 · Rate limits — backstops, not budgets

| Class | Per minute |
|---|---:|
| `/api/public/*` | 3000 |
| customer identity | 600 |
| global, per IP | 1200 |
| auth endpoints | 20 |

⚠ **`Retry-After` is not readable by a browser client** unless CORS-exposed. Back off on your own
schedule.

---

## 8 · Maintenance mode

`503 SYSTEM_MAINTENANCE_ACTIVE`. Three modes: `off`, `readonly` (mutations refused, `GET` passes),
`down`. **`POST /api/auth/mobile/refresh` is exempt in `readonly`** — it is a bearer client's only
renewal path, and without the exemption a read-only window would sign out every native client
fifteen minutes in while browsers carried on.

---

## 9 · How this folder relates to the backend, and how to keep it that way

**67 files** — 65 `.md` plus `error-codes.ts` and `ticket_types.txt`. **Measured 2026-09-08**, by
diffing every `.md` against `jovi-mall/api-doc/` at the same path with line endings normalised:

| Class | Count (2026-09-08) | Was |
|---|---:|---|
| **Byte-identical to its backend counterpart** | **24** | 55 |
| **Has a counterpart, and differs** | **31** | 4 |
| **No backend counterpart at all** | **10** `.md` | 6 (+`error-codes.ts`) |

The 10 with no counterpart: `MIGRATION-2026-08.md` · `ROUTE-MAP.md` · `tracking/README.md` ·
`customer/reviews.md` · `files/private-files.md` and the five under `tracking/geo-tracker/`, which
mirror `geo-tracker/api-doc/` rather than jovi-mall's and so are invisible to a jovi-mall diff.

> ⛔ **This table used to say "those four are the only expected drift — any fifth is real
> staleness." That rule no longer holds, and following it would send you chasing 27 false
> alarms.** The 2026-09 documentation programme adds *Verified against source* banners and
> corrections to the frontend copies, deliberately, so a frontend page is now routinely **ahead
> of** its backend twin rather than behind it. **Read the banner at the top of a page before
> concluding it is stale**; a page dated later than the backend's copy is the newer one.
>
> The four originally-named divergences are still divergent and still deliberate:
> `README.md` (this page), `customer/saved-and-viewed.md`, `me/contact-change.md`,
> `me/account-closure.md`. Each of the three content pages carries a banner saying so. This
> `README.md` diverges because the backend's copy indexes the *whole* backend contract — it links
> to `vendor/`, `agency/`, `agent/` and `admin/` pages that do not exist here, and it is not
> organised by this app's three audiences.

### 9.1 Why the mirrors were left untouched

They contain **308 relative links that do not resolve here** — almost all pointing at `vendor/`,
`agency/`, `agent/`, `admin/` and `telegram/` pages this repository has never mirrored, because they
belong to other roles. Repairing them would have made all 54 files register as *drifted*, destroying
the only automated staleness signal this repository has.

**So the rule is: a broken cross-role link in a mirrored file is expected.** Read it as
`jovi-mall/api-doc/<that path>`. Every link inside the 7 authored files resolves.

### 9.2 Verifying this folder is still current

```bash
node backend/FRONTEND-SYNC/tools/doc-drift.js  | sed -n '/landing/,/^$/p'
node backend/FRONTEND-SYNC/tools/call-audit.js | sed -n '/landing/,/^$/p'
```

**Expected, and true on 2026-08-24:**

| Check | Measured 2026-09-08 | Was expected (2026-08-24) |
|---|---|---|
| drift | **24 identical · 31 drifted** — see the ⛔ box in § 9; drift is no longer a staleness signal on its own | `IDENTICAL (48) · DRIFTED (4)` |
| dead calls | **0** | **0.** 42 path literals, 36 matched, 6 unmatched and all benign |
| `error-codes.ts` | **640** codes | 603 |
| route total | **764** overall | 677 overall, 141 customer-reachable |

⚠ **Re-measure; never quote a number from this table.** The registry figure has read
541 → 621 → 623 → 625 → **640** across editions of this program, and each stale value was carried
onward into other repositories before anyone checked it.

⚠ `doc-drift.js` compares against `jovi-mall/api-doc/` only, so the 5 files under
`tracking/geo-tracker/` appear in neither column. They mirror `geo-tracker/api-doc/` and are
byte-identical to it.

⚠ **Every `call-audit.js` hit must be opened and read.** It finds string literals, not calls — the
six here are namespace constants and comments, one of which says the path does *not* exist.

### 9.3 What was deliberately NOT brought over, and why

The audit listed **33 backend documents** as missing from this repository. **22 were added**; the
other **11 are excluded on purpose**, so nobody re-adds them thinking they were forgotten:

| Excluded | Why |
|---|---|
| `billing-plans-across-roles.md` | vendor/agency subscription billing. A customer has no plan and no credit wallet — which is also *why* the phone-change flow cannot send a WhatsApp template |
| `booking-implementation-guide.md` · `integrations/google-calendar.md` | the **vendor** side of bookings — availability rules, calendar sync. The customer's half is `customer/bookings.md` |
| `FRONTEND-CHANGELOG-rich-descriptions.md` · `FRONTEND-CHANGELOG-agency-storage.md` | vendor and agency product/storage features |
| `agent-shipment-discovery-integration.md` | agent app only |
| `phase-d-0-1/{README,admin-dashboard,agency-agent-app,vendor-agency-dashboard}.md` | the other three audiences of that phase. **`phase-d-0-1/customer-app.md` is here** |
| `auth/N8N-HANDOFF.md` | the n8n **operator's** integration spec, not a client contract |
| `telegram/README.md` | ⚠ excluded with a caveat — it documents `POST /webhooks/telegram/send`, **a route that moved** (finding F-29), so mirroring it would import a known error. Everything a customer needs for Telegram is in [`connections/README.md`](./connections/README.md) |

These are *"relevant"* only because the audit's filter counted every cross-cutting document plus the
role's own folder, which is deliberately generous.

### 9.4 🔴 The propagation gap (finding F-6)

**The backend wrote fourteen documents whose entire purpose was to tell frontends what broke. Not
one had reached any frontend repository.** They are here now, but nothing prevents it recurring:
**the propagation step does not exist.**

Three proposals, cheapest first. Only the third fixes the cause:

1. **A CI check on two numbers** — `error-codes.ts` count (603) and the route total (677). A
   one-line failure when either moves. Detects, does not fix.
2. **A path-literal check** — run `call-audit.js` in CI and fail on a new unmatched literal that is
   not in an allowlist. Would have caught the six dead calls in the other three apps on the day they
   broke.
3. **Propagation as a release step** — when the backend writes a `FRONTEND-CHANGELOG-*`, opening a
   PR against each consuming frontend is part of shipping it, not a follow-up. **This is the only
   one that addresses the cause**, and it is the owner's call because it spans repositories.

---

## 10 · A note on trust

Every claim in the authored pages was checked against the **implementation**, not against a
document — because in this workspace documents have been measured to be wrong. The audit that
preceded this work found contradictions between backend documentation and backend source, including
in `backend/CLAUDE.md` itself.

**The rule that produced this folder:** read the route from the router, the shape from the validator
or serialiser, the rule from the service. An `api-doc` page is a fast way to find *where to look* —
it is not the answer.

Where a document and source disagreed, the disagreement is filed in
`backend/FRONTEND-SYNC/03-FINDINGS-REGISTER.md`.

---

## 11 · Conventions

**Verified against `jovi-mall/src/` on 2026-09-08** — the clearing rule against
`src/core/validation/zod.helpers.ts`, the contact rules against `src/core/validation/{phone,email}.ts`.

- **IDs** are MongoDB ObjectIds — 24-character hex strings. Treat them as opaque.
- **Timestamps** are ISO-8601 UTC strings (`2026-07-17T10:20:30.000Z`).
- **Phone numbers** are **E.164, everywhere** — see § 12.
- **Email addresses** are trimmed and lowercased before storage and comparison — see § 12.
- **Clearing an optional field.** Optional *string* fields in `PATCH`/`POST` bodies are **clearable**
  unless a page says otherwise, and there are three states, not two:

  | You send | Result |
  |---|---|
  | the key **absent** | stored value unchanged |
  | `null`, `""`, or whitespace-only | field **cleared** — stored and returned as `null` |
  | a value | must satisfy the field's own constraint (URL, email, length…); an invalid non-empty value is rejected with `VALIDATION_ERROR` |

  An emptied form input naturally submits `""`, and the server normalises that to `null` for you —
  you do not have to special-case it. **Required fields are not clearable**, and neither are verified
  identity fields. Numeric, boolean and date fields accept `null` where a page says so, but never `""`.
- **`Content-Type: application/json`** on every non-multipart `POST`/`PATCH`/`PUT`.
- **Soft delete**: most resources are soft-deleted, and list endpoints never return deleted records.

---

## 12 · Contact formats (phone & email)

**One rule, every endpoint.** Registration, sign-in, the profile, payment channels, payout
destinations — wherever this API accepts a phone number or an email address, the same validation
applies. There is no endpoint with a looser rule, and no field where "it's optional" means
"it's unchecked". Optionality itself is unaffected: the rule is only applied to a value you actually
send.

### Phone numbers — E.164 only

```
+237670000000        ✅
+237 670 00 00 00    ✅  formatting is stripped for you; stored as +237670000000
+1 (555) 010-9999    ✅
670000000            ❌  no country code — VALIDATION_ERROR
00237670000000       ❌  00-prefixed dialling is not E.164 — send the +
+0237670000          ❌  a country code cannot start with 0
+237                 ❌  incomplete
```

- A leading **`+` and country calling code are required.** The server will not guess a country —
  the platform serves several, so a national number has no single correct expansion.
- **7 to 15 digits** after the `+` (15 is the E.164 ceiling; 7 is the shortest real international
  number).
- **Spaces, dashes, dots and parentheses are accepted and stripped.** What is stored and echoed back
  is the canonical form, so send the number however your input mask produces it. Typographic dashes
  (–, —) are **not** stripped and will be rejected.
- This validates *format*, not reachability — a well-formed number may still be unassigned.

### Email addresses

```
name@example.com          ✅
  Name@Example.COM        ✅  trimmed and lowercased; stored as name@example.com
o'brien+tag@my-shop.io    ✅
name@example              ❌  no TLD
root@localhost            ❌  bare host
"john doe"@example.com    ❌  legal in the RFC, undeliverable in practice
na..me@example.com        ❌
```

- An RFC 5322 dot-atom local part, a real dotted domain with an alphabetic TLD, and the RFC 5321
  length limits — 64 characters for the local part, 254 for the whole address.
- **Addresses are trimmed and lowercased** before storage and comparison, so `Ada@Example.com` and
  `ada@example.com` are the same account. Sign in with either.

### When it fails

The standard envelope, `error.code = "VALIDATION_ERROR"`, HTTP `400`, with the offending field named
in `error.details.fields[]`. Show the message against that field rather than as a page-level error.
