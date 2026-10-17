# Customer shop — the seller and the delivery side now join an order ticket

> **Date:** 2026-10-09 · **Audience:** the customer shop (signed-in area of the landing site) · **Status:** built, **not deployed yet**
> **Breaking:** no — no route, field or parameter changed. This is mostly a **verify** pass.
>
> Full contract: [tickets.md](./tickets.md) and
> [../vendor/tickets.md](../vendor/tickets.md) § *Order tickets reach every party automatically* (the shared payload reference).

---

## What changed

When a customer opens a ticket **about an order** (entity type `ORDER`, or `SHIPMENT`), the
order's **vendor**, its **delivery agency** and its **agent** now follow that ticket automatically
and can answer it. Before, only the customer and platform support were on it.

The customer's own list (`GET /api/customer/tickets`) does **not** grow: a customer is not added
to a ticket somebody else opens about their order.

## What the customer now sees on their ticket

`GET /api/customer/tickets/:id` and `GET /api/customer/tickets/:ticketId/notes`, same payloads:

| Field | Now |
|---|---|
| `followers[]` | Several entries instead of one — the customer, the vendor, the agency, the agent — each `{ user_id, role, name, avatar, verified? }` |
| Notes, `author.role` | A public reply can now come from **`vendor`**, **`agency`** or **`agent`**, not only `admin`. Label the author by `author.role` and `author.name`; do not assume every reply is "Support" |
| System notes | `is_system_note: true`, e.g. `User added as follower (Role: agent)` when an agent accepts the delivery after the ticket was opened. Render as a timeline event, not a message |

- The existing **`ticket.replied`** notification now also fires for those replies (it already
  fired for any public reply not written by the customer). Its wording should not say "support
  replied" if it does today — the reply may be the seller's or the courier's.
- The customer still creates **public** notes only, and still closes their own ticket.
- An agent joins when they **accept** the delivery, so the followers list can change while the
  ticket is open. Read it from the response each time; do not cache it.

## Checklist

- [x] Ticket detail renders several followers, with role labels ("Seller", "Delivery agency", "Courier")
- [x] A reply shows who wrote it (`author.role` / `author.name`), for vendor, agency and agent as well as admin
- [x] System notes render as timeline events
- [x] Notification and empty-state copy does not assume only support answers — **landing side only, see below**

### Landing status — 2026-10-11

Done in `src/components/shop/account/TicketDetail.tsx` and `src/lib/shop/ticket-parties.ts`.
Checked against the backend **source** and against stub payloads built from it, in a browser at
320 px, 390 px and 1280 px, in English, French and Arabic. **Not checked against a running API**:
the change is not deployed, and no local backend was available.

- The agency is labelled **"Delivery company"**, not "Delivery agency" — the name the shop already
  uses for it everywhere else.
- The followers list is read from each ticket response and held nowhere else. It is refreshed when
  the screen opens and after each reply or close; there is no polling, so a courier who joins
  while the screen is open appears on the next load.
- "User added as follower (Role: …)" is recognised by its text and shown in the customer's
  language. Every other system note is shown as the backend wrote it, in English.

Still open, on the backend:

- [ ] The `ticket.replied` sentence is the backend's, not the landing's — the notification list
      prints `title` and `body` as delivered. The catalogue still says **"We replied about
      "{{subject}}""** in all five languages
      (`src/modules/notifications/catalog/customer-notification-catalog.ts`), which is wrong when
      the seller or the courier wrote the reply.
