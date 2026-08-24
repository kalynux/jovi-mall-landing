# Changing the email or phone you sign in with — `/api/me/{contact,email,phone}`

**Six routes, and one rule above all others: the identifier does not move until it is proved.**

`login_email` and `login_phone` are what `POST /api/auth/login` resolves an account by. A flow that
writes the new value first and marks it unverified is the one that cannot be recovered from — a
typo'd address becomes the only way in, the account cannot be signed into, and the correction form
is behind the sign-in. So **a request writes a pending block and nothing else.** Exactly one write
ever moves the identifier, and it clears the pending block in the same `$set`.

> **Verified against source 2026-08-24.** Routes: `src/modules/users/user.routes.ts:41-47` and the
> auth router. Handler: `contact-change.controller.ts`. Rules:
> `services/contact-change.service.ts`. Windows: `config/contact-change.config.ts`.
>
> ⚠ **Deliberately extended from the backend's copy.** A drift check will report this file as
> differing from `jovi-mall/api-doc/me/contact-change.md`. **Intentional, not staleness** —
> see `README.md` § 9.

---

## 1 · The routes

| Method | Path | Auth | What |
|---|---|---|---|
| `GET` | `/api/me/contact` | session | what you sign in with, and what is in flight |
| `PATCH` | `/api/me/email` | session | open an email change |
| `POST` | **`/api/auth/email-change/confirm`** | 🔴 **none** | spend the emailed token |
| `DELETE` | `/api/me/email/pending` | session | abandon an email change |
| `PATCH` | `/api/me/phone` | session | open a phone change |
| `POST` | `/api/me/phone/confirm` | session | complete a phone change |
| `DELETE` | `/api/me/phone/pending` | session | abandon a phone change |

Shared across **all roles** — `/api/me` carries `requireAuth` and no `requireRole`. The account
owner is resolved from the verified token, never from a body.

### 1.1 🔴 The email confirm is on a different router, and unauthenticated

This is the single most likely thing to get wrong. `POST /api/auth/email-change/confirm` is **not**
under `/api/me`, and it carries **no `requireAuth`**.

**Why:** the link is read in a mail client, which is routinely not the browser that started the
change and often not on the same device. Requiring a session would make the flow fail for exactly
the people it is for. The token *is* the credential and it names the account.

**The phone confirm is authenticated**, because its proof is a property of the account and needs the
session to be looked up at all. **That asymmetry is the design, not an oversight.**

Because it is mounted on the auth router it inherits the **credential rate-limit bucket**
(20/min) rather than the general one — it spends a bearer secret, which is what that bucket is for.

---

## 2 · `GET /api/me/contact`

```jsonc
{
  "email": "old@example.com",           // string | null - what you sign in with today
  "phone": "+237600000001",             // string | null
  "pendingEmail": {
    "target": "new@example.com",        // the value being proved
    "requestedAt": "2026-08-24T09:12:00.000Z",
    "expiresAt":   "2026-08-24T10:12:00.000Z"
  } | null,
  "pendingPhone": { /* same shape */ } | null
}
```

**Never the token and never its hash.** `target` is echoed because the account holder typed it.

---

## 3 · Email change

### `PATCH /api/me/email`

```jsonc
{ "email": "new@example.com" }     // .strict() - an unknown key is a 400
// ->
{ "pendingEmail": { "target": "...", "requestedAt": "...", "expiresAt": "..." } }
```

Nothing about the account changes yet. A confirmation link goes to **the new address**, pointing at
the storefront:

```
{STOREFRONT_URL}/account/confirm-email?token={token}
```

⚠ **The storefront must POST that token, not GET it.** The link lands on a storefront page, which
reads `?token=` and calls `POST /api/auth/email-change/confirm`. A `GET` that mutates is spent by
whatever prefetches the mail — link scanners, corporate relays, the mail client's own preview.

**Window: 1 hour** (`CONTACT_CHANGE_EMAIL_TTL_SECONDS`). Deliberately shorter than the 24-hour
registration verification window — that token proves an address somebody just typed into a signup
form and costs nothing if it lapses. This one bounds a change to an identifier the account
**already signs in with**.

The token is stored **hashed** (SHA-256), because a pending change is durable and the collection
must not hold a spendable credential.

### `POST /api/auth/email-change/confirm`

```jsonc
{ "token": "..." }     // 1-512 chars, .strict(). The minted token is 64 hex characters
```

The bound is generous on purpose: a mail client that wraps a URL is a real thing, and a near-miss
should be told the token is *invalid*, not that it is *malformed*.

On success the identifier moves and the pending block clears in one write.

### `DELETE /api/me/email/pending`

Abandons the change. `404 CONTACT_CHANGE_NOT_PENDING` if nothing is in flight.

---

## 4 · Phone change

### `PATCH /api/me/phone`

```jsonc
{ "phone": "+237600000001" }      // E.164, .strict()
// ->
{ "pendingPhone": { "target": "...", "requestedAt": "...", "expiresAt": "..." } }
```

**Window: 24 hours** (`CONTACT_CHANGE_PHONE_TTL_SECONDS`) — longer than email, because the proof is
not *delivered*: the person has to go and message the bot from the new number, possibly on a handset
that is not in the room. Still bounded, because an unbounded pending request would be completed by
the next WhatsApp connection made for any reason at all, months later.

### 🔴 There is no OTP. The proof is a WhatsApp connection.

There is **no SMS provider in this service**, and a WhatsApp message to a number that has not
messaged us is outside the 24-hour service window — so it would have to be an approved paid
**template** billed to a credit wallet, and a customer has no wallet.

What the platform already has is the *inbound* direction. A `channel_connections` row binding an
account to a WhatsApp identity exists only because a message arrived **from that number** and the
account holder redeemed the resulting code while signed in. That is a stronger proof of control than
an OTP, and it is already built.

**So the phone confirm asks for exactly that:** the pending number must match a WhatsApp connection
on the caller's own account.

⚠ **Two consequences, stated rather than buried:**

- **An account with no WhatsApp connection cannot change its phone here.**
- **A Telegram connection does not count.** A `chat_id` bears no relation to any phone number.

Both surface as `CONTACT_CHANGE_PHONE_UNPROVEN`, whose message says what to do. The UI should route
that code to [`../connections/README.md`](../connections/README.md) — connect WhatsApp first, then
come back and confirm.

### `POST /api/me/phone/confirm`

**Takes no body.** There is no token to present; the proof is looked up from the session.

### `DELETE /api/me/phone/pending`

Abandons the change.

---

## 5 · What this deliberately does NOT do

**It does not stamp `password_changed_at`.** That field is the session revocation list, and changing
an identifier changes no credential — the password still authenticates. Signing every device out
over an email edit would be a surprise with no security story behind it.

**So a contact change does not sign anyone out.** A compromised account's remedy is still
[the password change](./password.md).

---

## 6 · Errors

| Code | Status | When |
|---|---|---|
| `CONTACT_CHANGE_SAME_IDENTIFIER` | 400 | the new value equals the current one |
| `CONTACT_CHANGE_IDENTIFIER_TAKEN` | 409 | another account already signs in with it |
| `CONTACT_CHANGE_NOT_PENDING` | 404 | confirming or cancelling with nothing in flight |
| `CONTACT_CHANGE_EXPIRED` | 400 | the window lapsed — **start again** |
| `CONTACT_CHANGE_TOKEN_INVALID` | 400 | the token does not resolve — **check the link** |
| `CONTACT_CHANGE_PHONE_UNPROVEN` | 400 | no WhatsApp connection matching the pending number |
| `VALIDATION_ERROR` | 400 | malformed email/phone, unknown body key, token over 512 chars |

⚠ **`CONTACT_CHANGE_EXPIRED` and `CONTACT_CHANGE_TOKEN_INVALID` are separate codes on purpose** —
*"start again"* and *"check the link you clicked"* are different instructions to a user. Do not
collapse them into one message.

Contact validation is strict E.164 for phones and RFC-shaped for email
(`core/validation/{phone,email}.ts`).
