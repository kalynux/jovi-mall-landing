# Backend requirements — standalone marketing pages

State of the integration between the pages under `src/app/[locale]/(marketing)/`
and `backend/jovi-mall`.

Pages: `/pricing`, `/vendors`, `/agencies`, `/agents`, `/faq`, `/cameroon`, and
`/cameroon/{douala,yaounde,bafoussam,bamenda,garoua}` — each in five locales.

---

## 1. Plan catalog — **done, wired 2026-08-08**

`/pricing` reads the live public endpoints. `src/lib/marketing/plans.ts`, which
mirrored `seed-pricing-plans.ts` and `credit.config.ts` by hand, is deleted.

| Endpoint | Used for |
|---|---|
| `GET /api/public/plans?role=…&includeInactive=true` | Every tier on the pricing cards, including the ones not on sale |
| `GET /api/public/credit-packs` | The pack table and the per-action credit costs |

Fetched server-side in the RSC at `src/lib/marketing/plans.api.ts`, with
`next: { revalidate: 300 }` matching the endpoint's own `max-age=300`. No CORS
involved, and the numbers land in the prerendered HTML. The module imports
`server-only`, so pulling it into a client component fails the build rather than
leaking a fetch into someone's browser.

**Four things the module encodes, from the handover notes:**

- **`PLAN_LIMITS` is the null-disambiguation.** The projection is flat, so a plan
  carries every limit field with `null` in the ones its role does not use.
  `agency_free.commission_percent === null` means agencies pay no commission;
  `agency_scale.max_unterminated_shipments === null` means unlimited. A role
  renders only the fields on its own list, and within that list `null` always
  means unlimited — so "unlimited commission" cannot be printed.
- **`is_active: false` renders as "Not on sale", not "Coming soon."** The flag
  means both "not launched yet" and "withdrawn from sale" and the catalog does
  not distinguish them. The badge now says the one thing true either way. If the
  catalog ever grows a reason field, the copy can get sharper.
- **Everything keys off `code`.** `name` is admin-editable and unlocalized, so it
  is display-only — never a lookup key, in the page, the JSON-LD `category`, or
  the copy assertions.
- **Currency is rendered per plan.** `formatPrice()` takes the plan's `currency`
  and maps ISO → local usage (`XAF` → `FCFA`), falling back to the raw code for
  anything unmapped. Nothing hardcodes FCFA any more.

**Cache window:** a catalog edit is invisible for up to 300s plus the page's own
revalidation. Documented in the module; not to be described to anyone as instant.

**Build fails loudly if the catalog is unreachable.** `/pricing` has no fallback
prices — publishing the page without them would be worse than a red build — so
`PlanCatalogError` names the URL and points at `NEXT_PUBLIC_API_URL`. Verified by
building against a dead port.

### 1a. The drift that deleting `plans.ts` did *not* fix

The cards are live. The **sentences around them are not**: "Growth is 5,000 FCFA
per 30 days: 150 products, 10 GB, and the commission drops to 5%" is hand-written
prose in five languages, and it goes stale exactly as silently as the old mirror
did — worse, because nobody thinks of a message catalog as containing data.

Interpolating all of it would read badly ("Twenty on the free tier" → "{n} on the
free tier") and would restructure sentences in four languages around tokens they
do not want. So `src/lib/marketing/copy-claims.ts` asserts the prose against the
live catalog at build time instead. A price moving in the admin catalog fails the
next build naming the message keys to rewrite:

```
Marketing copy no longer matches the public plan catalog:
  • growth.price is 6000, copy says 5000 — update pages.vendors.cost.p2,
    pages.faq.q.vendorCost.a, pages.pricing.vendor.lead in all five locales
```

Verified by flipping an expected value and building. **Adding a catalog number to
the copy means adding a claim to that file** — it cannot be derived from strings.

---

## 2. Facts the pages assert that are not per-request

Verified against `api-doc/` and the services, and cited in code comments. If any
of these change, the copy in `messages/*.json` under `pages.*` changes with it —
these are *not* covered by the build-time assertion, which only checks numbers.

| Claim on the pages | Verified against |
|---|---|
| Commission is a % of order gross, taken at payment, set by the vendor's plan | `earnings-split.service.ts` (`splitOrder`) |
| Platform takes no share of the delivery fee; agency keeps fee − agent cut | `earnings-quote.service.ts` (`applyFeeSplit`, `computeAgencyCut`) |
| Agent cut is per-contract, percentage or flat, quoted before accepting | `api-doc/agent/shipments.md`, `api-doc/agent/agency-membership.md` |
| Agency cap is soft (alert only); agent cap is hard (`422 AGENT_AT_CAPACITY`) | `api-doc/billing-plans-across-roles.md` |
| No recurring charge; term expires → queued plan or free tier | `api-doc/billing-plans-across-roles.md` |
| Payout: escrow → completion (or 7-day auto-confirm) → 7-day hold → request | `api-doc/vendor/earnings.md` |
| Vendor required onboarding = country + payout details only | `api-doc/vendor/onboarding.md` |
| Agency required onboarding = coverage + HQ address + payout + policies | `api-doc/agency/onboarding.md` |
| Agents sign up independently, may hold several agency contracts | `api-doc/agent/agency-membership.md` |
| Payments: NotchPay / MyCoolPay (MTN, Orange, Moov), Stripe, COD | `api-doc/payments/README.md`, `modules/payments/gateways/` |
| Cameroon only; ten regions; region-keyed coverage | `locations.json`, `locations.helper.ts` |

---

## 3. Coverage and stats — answers to "say which way you want them framed"

### 3a. `/api/public/coverage` — **yes, please build it. Return raw counts.**

`[{ region: "littoral", agencies: 4 }, …]` for all ten regions. Counts rather
than a boolean, so the page can change its mind about thresholds without another
round-trip to you.

**The framing, which is the actual question:** the page will never render a zero.
Two audiences read `/cameroon` and the city pages and they want opposite things
from the same number — a vendor seeing "0 agencies in Nord" bounces, an agency
seeing it leans in. So the page renders the *covered* regions as a positive
statement ("deliveries are running in Littoral, Centre and Ouest today") and says
nothing numeric about the rest. The line already written for the uncovered
remainder — that a region with no agency is an opening rather than a refusal —
carries that half without printing a figure.

That means the endpoint can be blunt and honest; the suppression is a rendering
decision and belongs here, not in your query.

### 3b. `/api/public/stats` — **not yet, and the trigger is a threshold, not a date.**

Don't spend the afternoon. `PRODUCT.md` puts the product at "early live, real but
small", and these pages deliberately quote no counts at all. A real number that
is small is worse on a conversion page than no number: it invites the reader to
do arithmetic you will lose.

Build it when any single figure is persuasive standing alone — my instinct is
four figures of vendors, or orders in the tens of thousands. When you do, return
**raw counts**, not pre-rounded or "10K+" strings, so the page owns the
presentation and can suppress an individual figure that is still below the bar
without you shipping a change.

Note that `TRUST_STATS` in `src/lib/constants.ts` (10K+ vendors, 500+ agencies,
2M+ orders, 15+ cities) are first-year *goals*, labelled as such in code and on
the landing page. They are not what this endpoint would replace.

### 3c. Ratings

`src/lib/seo/jsonld.ts` omits `aggregateRating` and `review` everywhere, because
`shop.fixtures.ts` ratings are invented and publishing invented review counts as
structured data earns a manual action. A public per-vendor rating aggregate,
once reviews are real, would let the store and city pages carry rating rich
results legitimately. Blocked on real reviews, not on you.

### 3d. WhatsApp number

`BRAND.whatsappNumber` is still `+2340000000000`, and `WHATSAPP_CUSTOMER_LINK` is
built from it. The marketing pages route CTAs to `/register?role=…` rather than
to WhatsApp specifically because of this — the customer path is the one they do
not push. Set the real number and that CTA becomes usable sitewide. (Note the
placeholder is a Nigerian `+234` prefix; presumably `+237`.)

---

## 4. Currency — settled, FCFA

Confirmed 2026-08-08: every seeded plan and credit pack is XAF on the wire, which
is what the platform charges. The pricing pages were right.

Done here:

- `formatPrice()` renders the plan's own `currency` field rather than a constant.
- `timeZone` moved from `Africa/Lagos` to `Africa/Douala` in `src/i18n/request.ts`
  and `src/lib/i18n-provider.tsx`. Same UTC offset, so nothing renders
  differently — it just no longer names the wrong country.

**Still outstanding, and deliberately not done unasked:** the landing page's demo
copy prices in ₦ and delivers to Lagos. That is 15 message keys × 5 locales, plus
three hardcoded `₦` values in `DashboardMockup.tsx`:

```
hero.orderDetail, hero.chatCustomer1, hero.chatAI1, hero.chatCustomer3,
hero.chatAI3, customer.chat.m1, customer.chat.productPrice,
customer.chat.orderDetail, africaFirst.phone.chat2Customer,
africaFirst.phone.chat2AI, africaFirst.phone.earnedBadge,
trust.features.scaleDesc, trust.dashboard.recentActivity3,
trust.dashboard.toastOrder, trust.dashboard.toastDelivered
```

It is a copy rewrite with product judgment in it — which price points, which
city, whether `trust.features.scaleDesc` keeps "Lagos to Nairobi to Accra" as an
aspirational line or moves to Cameroonian cities. Worth doing before launch: a
hero in ₦ sits one click from a pricing page in FCFA.

---

## 5. Geography is Cameroon only

`locations.json` has one country. The five city pages are hand-written, not
generated — see the comment on `CITIES` in `src/lib/marketing/geo.ts`. Adding the
other 61 from a template would be a doorway-page set, which is a spam-policy
problem rather than an SEO win. Add a city page when there is something specific
and true to say about commerce there.
