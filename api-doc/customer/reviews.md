# Reviews — the customer's half

**A customer reviews two different things, and they behave differently.** A **product** they bought,
and a **delivery** they received. Only the first is ever published.

> **Verified against source 2026-08-24.** Routes: `src/modules/reviews/routes/customer-review.routes.ts`
> and `public-review.routes.ts`. Rules: `domain/services/review-eligibility.service.ts`,
> `domain/review-targets.ts`. Shape: `validators/review.validator.ts`.
> Cross-role model: [`../reviews.md`](../reviews.md).

---

## 1 · The routes

| Method | Path | Auth |
|---|---|---|
| `POST` | `/api/customer/reviews` | customer |
| `GET` | `/api/customer/reviews/eligibility?subjectType=&subjectId=` | customer |
| `GET` | `/api/customer/reviews` | customer — **this customer's own reviews, every status** |
| `GET` | `/api/public/products/:productId/reviews` | 🔓 **none** |

Identity flows token → customer. **There is no `customerId` in any path.**

---

## 2 · The two subjects

| | `subjectType: "product"` | `subjectType: "delivery"` |
|---|---|---|
| `subjectId` | the product id | the **shipment** id |
| Earned by | a **completed order** containing that product | a **delivered shipment** |
| Published? | ✅ yes, after moderation | 🔴 **never** — internal quality signal |
| Rates | the item | the delivery experience |
| Attributed to | the product (and its vendor) | **the agent who carried it, server-side** |

### 2.1 🔴 A delivery review names an agent the customer never sees

The customer rates *the delivery*; the platform knows *whose it was*. Attribution happens
server-side and the customer is never told which agent carried their parcel by this endpoint.

⚠ This does **not** contradict the order-detail page showing a carrying agent
([ADR-A06](./FRONTEND-CHANGELOG-order-detail.md)) — that is a separate, deliberate disclosure with
its own `visibleFrom` gate. The review endpoint simply does not undo or extend it. **Do not build a
review form that names the agent from the shipment payload.**

**A delivery rating moves real money.** It feeds the agent's trust composite, which scales their COD
cash limit. That is why "who may rate this delivery" is gated as tightly as it is.

### 2.2 🔴 Never add `subjectType` to the public route

`GET /api/public/products/:productId/reviews` serves **product reviews only**. Delivery reviews are
an internal signal naming an agent; only their *aggregate* ever leaves the platform.

---

## 3 · Submitting

```jsonc
POST /api/customer/reviews
{
  "subjectType": "product",     // | "delivery"
  "subjectId": "66b1...",       // product id, or shipment id
  "rating": 5,                  // integer 1-5 - there is no half-star
  "title": "Great",             // optional, 1-120 chars
  "body": "Arrived quickly."    // optional, 1-2000 chars
}
```

`rating` is an **integer**; the trust composite reads it and a half-star is not a thing here.

### 3.1 🔴 Whether you send text decides whether it publishes immediately

```
title or body present  ->  status: "pending"    (held for moderation)
neither present        ->  status: "published"  (live now)
```

**The response tells you which happened, in `status`.** Branch on it — a bare five stars appears on
the product page at once; the same five stars with a sentence attached does not, and a UI that says
"your review is live" in both cases is wrong half the time.

### 3.2 One review per subject

A second review of the same subject answers **`409 REVIEW_ALREADY_EXISTS`**. Enforced by a unique
index, not a pre-check, so a double-tap cannot create two.

---

## 4 · Eligibility — check before showing the form

```
GET /api/customer/reviews/eligibility?subjectType=product&subjectId=66b1...
```

Call this before rendering a review form. The two refusals mean different things:

| Code | Status | Meaning | What to show |
|---|---|---|---|
| `REVIEW_SUBJECT_NOT_FOUND` | 404 | does not exist **or** is not yours | nothing — no form, no message naming the subject |
| `REVIEW_NOT_ELIGIBLE` | 422 | it **is** yours, but not reviewable yet | "you can review this once your order is complete" |
| `REVIEW_ROLE_NOT_ALLOWED` | 400 | this role may not review this subject type | — |
| `REVIEW_ALREADY_EXISTS` | 409 | you already reviewed it | show the existing review |

⚠ **The 404 is deliberately ambiguous** — a subject that does not exist and one that exists but is
not the caller's get **the same answer**, so probing ids cannot confirm which. The 422 is safe to be
specific about, because it tells the caller nothing they did not already know.

### 4.1 What "eligible" actually means

**Product** — a **completed** order of this customer containing this product. Completion is
`completion.confirmed_at`, not `fulfillment_status`: it is set by the customer confirming delivery,
by the COD cash handover, or by the auto-confirm sweep, so every route to *"this person actually
received what they bought"* converges on that one field. A partially-returned order still counts as
finished.

**The order need not be the most recent one.** Any completed order containing the product qualifies,
and the one that matched is snapshotted as the evidence.

**Delivery** — a shipment of this customer's that reached `delivered`.

---

## 5 · Reading reviews

### `GET /api/customer/reviews`

This customer's own reviews, **every status** — including `pending` ones not yet visible to anyone
else. That is what lets an account page show "awaiting moderation".

### `GET /api/public/products/:productId/reviews`

Unauthenticated. Published product reviews, newest first, with the rating breakdown in
`meta.rating` — **or `null` when there are none**.

⚠ **`meta.rating: null` is what keeps `aggregateRating` out of the storefront's JSON-LD until a real
aggregate exists.** Emitting a structured-data rating with no reviews behind it is exactly what
Google's review-spam policy earns a manual action for. **Do not synthesise a zero.**

The average is carried to **two decimals**, not one — it feeds the agent trust composite as well as
a star widget.

---

## 6 · Why the gate exists at all

Verified-purchase gating is not a nicety here. Publishing `aggregateRating` built from reviews
anybody can write earns a **manual action** from Google, which is worse for the storefront than
having no ratings at all. On the delivery side the stake is larger still: after Step 11 a delivery
rating moves an agent's COD cash limit.
