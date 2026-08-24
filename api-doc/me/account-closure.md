# Closing an account — `POST /api/me/close`

## 🔴 This is **anonymise-and-retain**. It is not a deletion.

The word matters, and it is a product promise. Everything this endpoint surfaces says **close** and
**anonymise**, never *delete*. ADR-A02 D-2 is explicit that **no legal erasure obligation has been
established in this market**, and that nothing here may be described to a customer — or in a privacy
policy — as satisfying one.

It satisfies a *reasonable expectation*. The two are not the same promise, and the second is the one
that is true. **Do not label this button "Delete my account".**

> **Verified against source 2026-08-24.** Route: `src/modules/users/user.routes.ts:60`. Handler:
> `user.controller.ts:89-129`. Rules: `account-closure.service.ts`. Manifest:
> `account-closure.repository.ts`. Schema: `user.validator.ts:98`.
>
> ⚠ **Deliberately extended from the backend's copy** — § 5 (what is not built) is specific to this
> app. A drift check will report this file as differing from
> `jovi-mall/api-doc/me/account-closure.md`. **Intentional, not staleness** — see `README.md` § 9.

---

## 1 · The request

```jsonc
POST /api/me/close
{ "confirm": "CLOSE MY ACCOUNT" }     // exact literal, .strict()
```

**`POST`, not `DELETE`** — the account row is not removed, and `DELETE /api/me` would promise on the
wire exactly the thing the design refuses to do.

### 1.1 Why a typed phrase and not the password

The obvious guard for an irreversible self-service action is a password check. **It is the wrong one
here:** customers are passwordless by default on this platform — registration strips a supplied
password for `role: 'customer'` and mints a random one, and they sign in through the messaging bot.
Requiring a password would make closure impossible for most of the people entitled to it, and
possible only for the minority who had once used the reset flow.

The phrase does the one job a confirmation can do: **it makes the request impossible to send by
accident.** It is not a credential and is not treated as one — the caller's access token is what
proves who they are.

⚠ The literal is case- and space-exact. The validation message is `Type "CLOSE MY ACCOUNT" to
confirm`. If you localise the surrounding UI, **the phrase itself must stay in English** or the
request will not validate.

### 1.2 The response

```jsonc
{
  "success": true,
  "message": "Your account has been closed and your personal details anonymised. Past orders are kept as business records, without your name or contact details.",
  "data": { "closedAt": "2026-08-24T09:12:00.000Z" }
}
```

**That sentence is the product promise** and it is deliberately specific about what survives,
because the alternative is a customer believing their orders are gone. Show it verbatim, or
translate it faithfully — do not shorten it to "Account deleted".

**Cookies are cleared on the way out.** The closure already revoked every token (see § 4), so this is
the client-side half. **A bearer client must discard its own pair itself** — the response clears no
cookie it holds.

---

## 2 · What actually happens to the data

Rows fall into exactly three groups. Which group a collection is in is a decision about what the row
**is**, not about how much data it holds.

| | Collections | What happens |
|---|---|---|
| **Anonymise** | `users`, `customers` | keeps its `_id`, loses its identifiers. `Customer.name` becomes **`"Closed account"`** (the schema requires it, so it cannot be unset) |
| **Delete** | `channel_connections`, `device_tokens`, `user_payment_methods`, `customer_notifications` | the row **is** an identifier or an address to reach the person on. Anonymising would keep exactly the identifying part — and in two cases would go on delivering to them |
| **Untouched** | orders, shipments, cash collections, earnings, payouts, refunds, bookings, entitlements, tickets | keep their reference to the retained `_id` and become **pseudonymous by construction** |

`vendor_customers` is the one row in two groups at once and gets a partial write.

**Money records are untouched on principle**, not by omission — ADR-A02 D-1: they *"are not the
customer's personal data to remove, and removing them would corrupt somebody else's balance"*. None
of those collections snapshots a name, email or phone number (verified in source, 2026-08-21), which
is what makes retaining them pseudonymous rather than a loophole.

**What a customer should be told, honestly:** their name and contact details are gone; their order
history remains as a business record that no longer names them; anything they were owed or owe is
unchanged.

---

## 3 · The three refusals

All three are `422` and all three are refusals rather than cascades.

| Code | Status | When | `details` |
|---|---|---|---|
| `ACCOUNT_CLOSURE_ROLE_NOT_ELIGIBLE` | 422 | the account holds **any** role beyond `customer` | `blockingRoles: string[]` |
| `ACCOUNT_CLOSURE_ORDERS_IN_FLIGHT` | 422 | an order is still moving, or under a dispute hold | `activeOrderCount: number` |
| — | 409 | the account is not `active` (a second closure request) | — |

### 3.1 Dual-role accounts

Phrased as *"anything that is not customer"* rather than *"vendor"*, so an account holding `agency`
or `agent` is refused too. That is deliberate: an agent carries a COD liability balance and a
contract with an agency, and neither has a self-service close. **`details.blockingRoles` names them
so the UI can say which one** — render it, rather than a generic refusal.

### 3.2 Orders in flight

⚠ **This refusal is not in the ADR; it is a judgement call made in the code, and the reason is
concrete.** Closure clears `Customer.phone` — which is where the COD delivery code is sent — and
deletes the messaging connections carrying every other delivery notification. **So closing
mid-delivery does not merely lose contact: it strands a parcel an agent is holding.**

"In flight" has two clauses, because they do not imply each other:

- `fulfillment_status` is **not** one of `fulfilled`, `cancelled`, `returned` — the order still
  being fulfilled needs the customer *reachable*
- **or** `dispute_hold.active` is true — an order under dispute needs them *answerable*

⚠ The settled list is derived **by exclusion**, so a fulfilment status added later counts as
*in flight* until somebody deliberately says otherwise. The safe direction — the cost of the wrong
answer is an undeliverable parcel.

**Render `activeOrderCount` and link to the order list.** "You have 2 orders still in progress" is
actionable; "cannot close account" is not.

---

## 4 · It is irreversible, and every session dies

**There is no un-close verb and there cannot be one** — the identifiers are gone, not archived. An
administrator cannot restore it either: the admin restore path compare-and-sets from `suspended`, so
it misses a closed row and answers `409`. That is exactly why `closed` is a third status rather than
a reuse of `suspended`.

`password_changed_at` is stamped to the closure instant, so **every token minted before it is
refused on sight** — including refresh tokens, on every device. The client sees
`AUTH_PASSWORD_CHANGED` (401), which is **terminal: route to sign-in, never retry**.

---

## 5 · What is NOT built

Two of the account-management gaps recorded in the shop requirements (§ 5.2) are still unbuilt as of
2026-08-24, verified against the live route dump:

- **Data export** — no route exists.
- **Session list / revoke other devices** — no customer-facing route exists.

Closure, email change and phone change **have** since been built. If a screen needs either of the
two above, it is a backend ask, not a missing document.
