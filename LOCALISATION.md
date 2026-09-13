# Localising `/shop`

The `/shop` tree was written in English and only in English. This is the contract
for turning it into five languages — **en, fr, es, pt, ar** — across ten phases,
some of which run at the same time in separate worktrees.

**Read this file instead of asking for a briefing.** It is the whole agreement:
where strings live, who owns which part of the catalogue, how to merge, and what
must never be translated. Phase 1 wrote it and is finished; if you are here for
Phase 2 or later, everything below is already true of the repository.

---

## 1 · One namespace, one sub-object per area

All shop copy lives under a single top-level `shop` key in `messages/*.json`,
with one sub-object per area — the same shape the existing `pages` namespace
uses. Read `messages/en.json` before you write into it and follow it exactly.

```jsonc
{
    "auth": { /* … */ },
    "errors": { /* … */ },
    "pages": {
        "nav": { /* … */ },
        "common": { /* … */ }
    },
    "shop": {
        "common": { "cancel": "Cancel", "save": "Save" },
        "status":  { "fulfillment": { "shipped": "Shipped" } },
        "cart":    { /* your phase fills this */ }
    }
}
```

Every sub-namespace in the ownership table below **already exists** in all five
catalogues, scaffolded as `{}` where Phase 1 had nothing to put in it. Your phase
*fills* its namespace; it never has to *create* one. That is deliberate — see §7.

Depth is up to you inside your own namespace. Two levels (`shop.cart.emptyTitle`)
is the norm; three (`shop.status.fulfillment.shipped`) is fine where a real
sub-grouping exists. Do not go deeper without a reason.

---

## 2 · How components read it

**Client components** — `useTranslations`, scoped to your area:

```tsx
"use client";
import { useTranslations } from "next-intl";

export function CartPage() {
    const t = useTranslations("shop.cart");
    return <h1>{t("title")}</h1>;
}
```

**Server components** — `getTranslations`, awaited, with the locale:

```tsx
export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
    const { locale } = await params;
    const t = await getTranslations({ locale, namespace: "shop.cart" });
    return <h1>{t("title")}</h1>;
}
```

### The root-scoped translator, `tKey`

A namespace-scoped `t("title")` resolves *relative* to its namespace, so it
cannot resolve the **absolute** dotted keys the lib modules emit (§3). For those,
bind a second, root-scoped translator and call it `tKey`:

```tsx
const t = useTranslations("shop.orders"); // this screen's own copy
const tKey = useTranslations();           // absolute keys from lib modules

<Badge tone={chip.tone}>{tKey(chip.labelKey)}</Badge>
```

`tKey` is the house name for it — Phase 1 used it in fifteen files. Keep it.
It matters that it is not `t`: several components already bind `t` to something
else (`TicketDetail` binds `t` to the *ticket*), and `useTranslations("errors")`
is already in use across the account screens.

On the server the equivalent is `await getTranslations({ locale })` with no
`namespace`.

---

## 3 · Non-React modules must not translate

Anything under `src/lib/shop/` — and any other module that is not a component —
**never returns a translated sentence.** It returns a `labelKey`: a *full dotted
key*, from the root of the catalogue.

```ts
// src/lib/shop/order-status.ts
export interface StatusChip {
    labelKey: string; // "shop.status.fulfillment.shipped" — never "Shipped"
    tone: Tone;
    icon: IconName;
}
```

**Why.** `useTranslations` is a hook. Hooks only run inside a React render, and
these maps are module-level constants evaluated once at import time — there is no
render, no context, and no locale to read. There is no version of this that works
inside the module. The component has the context; the module names the string and
the component resolves it.

The consequences to respect:

- The key is **absolute**, so it is resolved with `tKey`, not with a
  namespace-scoped `t`.
- When you convert a module, **rename the export** — `unavailableLabel` →
  `unavailableLabelKey`, `shopPageTitle` → `shopPageTitleKey`, `label` →
  `labelKey`. The rename is what turns every call site into a compile error. Keep
  the old name and a missed call site renders `shop.status.fulfillment.shipped`
  into the UI with nothing to catch it.
- Then let `npx tsc --noEmit` find the call sites. Grep first to know the scale,
  but **the clean typecheck is the proof**, not the grep.

Where a module carries a message the *backend* wrote, keep both and let the call
site choose — the server's sentence is already in the shopper's language:

```ts
| { kind: "error"; message: string | null; messageKey: string }
// call site:
flash(outcome.message ?? tKey(outcome.messageKey));
```

---

## 4 · Interpolation, markup, and the one rule that is not negotiable

**Values go through `t()`:**

```tsx
t("itemCount", { n: items.length })     // "You have {n} items"
```

**Markup goes through `t.rich()`:**

```tsx
t.rich("terms", { link: (chunks) => <Link href="/terms">{chunks}</Link> })
```

**🔴 Never concatenate translated fragments.** Not with `+`, not with template
literals, not by splitting a sentence across two JSX children:

```tsx
{/* WRONG — cannot be translated into anything */}
<p>{t("youHave")} {n} {t("itemsInCart")}</p>

{/* RIGHT */}
<p>{t("itemsInCart", { n })}</p>
```

Word order is not a constant. French puts adjectives after nouns, German sends
the verb to the end, and Arabic runs right to left. A sentence assembled from
parts can only ever come out in English order, and no translator can fix it from
the catalogue — the damage is in the code. This is the single most expensive
mistake available in this project, which is why `scripts/check-i18n.mjs` counts
the text fragments on either side of a `{…}` in a JSX node as *two* hardcoded
strings rather than skipping them.

Plurals use ICU in the message, not an `n === 1 ? … : …` in the component:

```json
"itemsInCart": "{n, plural, =0 {Your cart is empty} one {# item} other {# items}}"
```

---

## 5 · ⚠ The catalogues are CRLF and 4-space

`messages/*.json` use **CRLF line endings** and **4-space indentation**, with a
trailing newline. Writing LF or 2-space reformats every one of the ~1960 lines
and buries your actual change in the diff.

Editors and `JSON.stringify` both default to LF and 2-space. The exact formula
that round-trips these files byte-for-byte is:

```js
JSON.stringify(catalogue, null, 4).replace(/\n/g, "\r\n") + "\r\n"
```

**Verify it after your first write, before you write anything else:**

```bash
node -e "const r=require('fs').readFileSync('messages/fr.json','utf8');
  const crlf=(r.match(/\r\n/g)||[]).length, lf=(r.match(/\n/g)||[]).length;
  console.log('allCRLF', crlf===lf, '| no2space', !/\n  [^ ]/.test(r))"
```

Both must print `true`. A `git diff --numstat -- messages/` that reports hundreds
of changed lines for a handful of new keys is the same failure seen from the
other side.

---

## 6 · What is never translated

**Money and dates.** `formatMoney` / `formatXAF` in `src/lib/shop/format.ts`
already handle the currency, and they emit strings carrying **invisible Unicode
bidi isolate marks** so that "12 000 FCFA" survives an Arabic paragraph intact.
Never wrap their output in `t()`, never rebuild an amount from parts, and never
put a currency symbol in a message. Dates go through `useFormatter()` /
`format.dateTime(…)`, which is locale-aware already.

**Backend error codes.** They stay in the existing top-level `errors.*`
namespace, keyed by wire code (`errors.CART_NOT_FOUND`). Do not copy them into
`shop.*`, and do not invent a second home for them. The pattern in the account
screens — `const t = useTranslations("errors")` — is correct and stays.

**Vendor-written data.** Product titles, descriptions, store names, category
names as typed by a seller, review text, ticket subjects. These are data. A
vendor in Douala writing *"Sac à main en cuir"* has written the product name; it
is not ours to translate and there is nothing to translate it from.

**Enum values and wire constants.** `sort=price_asc`, `AWAITING_PAYMENT`, route
paths, slugs. These go on the wire. Translate the *label*, never the value.

---

## 7 · Namespace ownership

This table is what stops two phases writing into the same JSON subtree. It is
the reason phases 2–9 can run at the same time.

| Phase | Namespaces |
|---|---|
| **1** | `shop.common` · `shop.status` · `shop.nav` · `shop.query` · `shop.cartErrors` |
| **2** | `shop.ds` · `shop.chrome` · `shop.feedback` · `shop.query.screens` |
| **3** | `shop.browse` · `shop.product` · `shop.store` · `shop.payMethods` · `shop.meta` |
| **4** | `shop.cart` · `shop.checkout` · `shop.saved` · `shop.pay` |
| **5** | `shop.orders` · `shop.tracking` |
| **6** | `shop.account` · `shop.security` · `shop.downloads` · `shop.close` |
| **7** | `shop.addresses` · `shop.paymentMethods` |
| **8** | `shop.notifications` · `shop.channels` |
| **9** | `shop.support` · `shop.reviews` · `shop.bookings` |
| **10** | `auth.*` (extend) · `shop.native` · the `errors.*` backfill |

**Write only into your own row.** If you need a string that belongs to another
phase's namespace, put your own copy in your own namespace. A duplicated string
is cheap; a merge conflict between two parallel worktrees is not.

> **This table is history now.** It existed to stop two phases writing into one
> JSON subtree while phases 2–9 ran in parallel worktrees. All ten have landed,
> nothing runs in parallel any more, and §12 is the live procedure. Phase 10
> itself wrote outside its row four times, deliberately, because the string
> belonged where it put it rather than where the table said: `authMe.subtitle`
> and `authMe.roleAriaCurrent` (replacing `subtitlePrefix`), `shop.meta.payTitle`
> for the `/pay/:token` tab title, and `shop.support.replyCharCount` for the
> reply counter. Each sits with the screen that renders it.

### 🔒 `shop.common` is FROZEN

`shop.common` is the one region more than one phase could plausibly reach for,
which makes it the one thing that can break a parallel run. So:

- **Phase 1 populated it generously** — 71 keys covering the shared vocabulary
  every screen needs: Cancel, Save, Close, Retry, Try again, Loading, Delete,
  Edit, Back, Done, Yes, No, Search, Filter, Sort, See all, Something went
  wrong, and the rest. Read it before you write anything.
- **Phases 2–10 READ `shop.common`. They do not add to it.** Not one key.
- If something you need is missing from it, that is not a signal to extend it.
  Put the string in **your own** namespace and move on.

The same freeze applies to the other four Phase 1 namespaces — `shop.status`,
`shop.nav`, `shop.query` (except `shop.query.screens`, which is Phase 2's) and
`shop.cartErrors`. They are shared vocabulary and they are done.

---

## 8 · Running phases in parallel

Phases 2–9 may run at the same time, each in its own git worktree. Their **source
files are disjoint** and merge normally. Their **message files are not** — all
eight write the same five `messages/*.json`.

Two things make that safe, and both already exist:

**1. Every namespace is scaffolded.** Phase 1 created the complete `shop` object
in all five catalogues, including empty `"cart": {}`, `"orders": {}` and the rest
in the table's order. A phase that has to *create* its namespace collides with
every other phase creating one; a phase that only *fills* an existing one usually
does not.

**2. The message files are merged structurally, never textually.** Scaffolding
alone is not enough — this was tested, and two phases filling namespaces on
*adjacent lines* still produce a textual conflict, because git merges JSON as
lines. So do not let git merge them at all:

```bash
node scripts/merge-i18n.mjs messages/fr.json main phase-2 phase-3 > messages/fr.json
```

It reads each ref's version with `git show`, deep-merges the **objects**, and
prints the result in CRLF/4-space. The first ref is the base; the rest are folded
into it. Because no two phases write the same key, a deep merge is always
unambiguous.

If two refs ever set the same leaf to different values, the script **names the
key and exits non-zero.** That is a planning error — two phases wrote into one
namespace — and it must be loud rather than silently resolved. Fix it on the
branch; nothing is merged until you do.

Run it once per locale (five times), then commit.

---

## 9 · The gate

```bash
npm run check:i18n                     # the gate — this is what CI runs
node scripts/check-i18n.mjs --verbose  # with every offending string
node scripts/check-i18n.mjs --allowlist # print the deliberately-English list
```

It answers two questions, and **since Phase 10 both of them fail the run**:

1. **Are the five catalogues in step?** Every key in `en.json` must exist in fr,
   es, pt and ar, and no locale may carry a key `en.json` does not. A missing key
   is a `MISSING_MESSAGE` crash in next-intl, not a cosmetic gap.
2. **Is there hardcoded English in the shop, auth or pay trees?** A per-file
   count with the strings, plus a percentage against the frozen Phase 1 baseline
   of **625 strings across 94 files**.

Question 2 was a progress report through phases 1–9 — the tree was still being
converted, and a build broken by a miscounting regex would have been worse than
useless. Phase 10 finished the conversion, so it is now a gate. The scanner is
still a regex pass rather than a parser, and the **`ALLOWLIST`** at the top of
the script is what keeps that honest: see §11.

Do not "refresh" the baseline constants. They are the fixed denominator every
phase divides into; moving them makes the percentage meaningless. They were
measured over the *shop* tree, which is why the percentage is still reported
against the shop tree alone now that auth and pay are scanned too.

**The `errors.*` exception is gone.** `pt` was missing 161 backend error codes
and `ar` 163 — a gap that predated the project, and one that handed a Portuguese
or Arabic shopper English at the exact moment something went wrong. Phase 10
translated all of them, and `KNOWN_GAP_PREFIXES` in the script is now empty and
must stay empty. A namespace that is not ready is a reason not to merge it, not
a reason to stop checking it.

**ESLint is a second opinion, not the gate.** `eslint.config.mjs` runs
`react/jsx-no-literals` over the same three trees, which catches a bare
`<p>Hello</p>` at the moment it is typed. It is a **warning**, and `npm run lint`
is not a reliable gate in this repository — the script is.

### Finish your phase with all three

```bash
npx tsc --noEmit             # must exit 0 — this is what proves you got every call site
node scripts/check-i18n.mjs  # must report five catalogues at parity
# then load /fr/shop and /ar/shop and look at it
```

Note `trailingSlash: true` and `localePrefix: "as-needed"`: English is
**unprefixed** (`/shop/`), every other language is prefixed (`/fr/shop/`).
Arabic additionally flips the document to RTL, so `/ar/shop/` is worth loading
even when your phase has nothing Arabic-specific in it.

---

## 10 · Translation quality

Translate into all five yourself; do not leave English in a non-English
catalogue to "fill in later" — the checker will pass and the shopper will not.

- **French matters most.** Cameroon is francophone and it is the first market.
- **Portuguese** is the other market language. The catalogue's shop-adjacent copy
  (`checkout.errors`) is **European Portuguese** — "correu mal", "a sua ligação",
  "artigos", "stock" — and `shop.*` follows it. Use *pedido* for an order,
  *carrinho* for a cart, *reserva* for a booking.
- **Arabic** should read naturally, not literally. It is MSA in this catalogue.
  Remember the page is RTL: check that anything you write survives being mirrored,
  and never hand-build a string that mixes a number, a currency and a word.
- Match the register already in the file. This product speaks plainly and in the
  second person; it does not say "Please be advised".

---

## 11 · What Phase 1 actually did

For anyone tracing why a file looks the way it does.

**Built**
- `scripts/check-i18n.mjs` — the gate (§9).
- `scripts/merge-i18n.mjs` — the structural merge (§8), verified on throwaway
  branches for both the clean-merge and the conflicting-key cases.
- The full `shop` namespace in all five catalogues: five namespaces filled,
  twenty-six scaffolded as `{}`.

**Converted** — these now emit keys, and every call site was patched:

| Module | What changed |
|---|---|
| `order-status.ts` | `StatusChip.label` → `labelKey` → `shop.status.{fulfillment,payment,groupPayment}.*` |
| `tickets.api.ts` | `TICKET_STATUS_LABEL` → `shop.status.ticket.*`; `TICKET_TYPE_GROUPS` optgroups → `shop.common.*` |
| `bookings.api.ts` | `BOOKING_STATUS_LABEL`, `BOOKING_PAYMENT_LABEL` → `shop.status.{booking,bookingPayment}.*` |
| `shop.pages.ts` | `ShopTab.label` → `labelKey`; `shopPageTitle` → `shopPageTitleKey`; both title tables → `shop.nav.*` |
| `shop.query.ts` | `SORT_OPTIONS[].label` → `labelKey` → `shop.query.sort.*` |
| `availability.ts` | `unavailableLabel` → `unavailableLabelKey`, `availabilityLabel` → `availabilityLabelKey` → `shop.status.availability.*` |
| `cart-errors.ts` | `CART_OFFLINE_MESSAGE` → `CART_OFFLINE_MESSAGE_KEY`; `{kind:"error"}` gained `messageKey` and `message` became nullable |
| `tracking.api.ts` | `onError` now takes `{ messageKey, message }` — exactly one is set |

**Deliberately left alone**, with the reason:

- `catalog.api.ts` — its only English is inside `CatalogApiError`, a **build-time
  diagnostic** telling a developer the catalog API was unreachable. No shopper
  ever sees it. Not translated, and should not be.
- `addresses.api.ts`, `map.ts`, `cm-operator.ts`, `useApiResource.ts` — surveyed
  and found to contain **no user-visible strings** at all. Their labels are
  written at the call sites, which belong to phases 5, 6 and 7.
- `ticketTypeLabel()` in `tickets.api.ts` — a mechanical prettifier over the
  ~50-member `TicketType` enum (`ORDER_ISSUE` → `Order issue`). Those names
  belong to `shop.support`, which the table gives to **Phase 9**. It is flagged
  in the source. Phase 9 replaces it with a lookup into
  `shop.support.types.<TICKET_TYPE>`.

**State at handoff:** `npx tsc --noEmit` exits 0; five catalogues at parity.

---

## 12 · Adding a string from now on

The project is finished. This is the whole procedure for the next string anybody
writes in the shop, auth or pay trees.

**1. Put the English in `messages/en.json`,** in the namespace that owns the
screen (§1, §7). Read the neighbouring keys first and match them — this product
speaks plainly and in the second person.

**2. Translate it into the other four, yourself, in the same commit.** Not
later. A key that exists in `en.json` and not in `ar.json` is a
`MISSING_MESSAGE` crash, and the gate will stop you — but a key that exists in
all five with English text in four of them passes every check and ships. French
matters most; Portuguese is European Portuguese; Arabic is MSA and the page is
RTL. §10 has the detail.

**3. Write the files with the exact formula in §5** — CRLF, 4-space, trailing
newline — or your two-line change arrives as a 2 000-line diff:

```js
JSON.stringify(catalogue, null, 4).replace(/\n/g, "\r\n") + "\r\n"
```

**4. Read it in the component**, never in a plain module:

```tsx
const t = useTranslations("shop.cart");       // client
const t = await getTranslations({ locale, namespace: "shop.cart" });  // server
const tKey = useTranslations();               // absolute keys from lib modules
```

A module that is not a component **emits a key** and the component resolves it
(§3). Two patterns already exist for that and you should copy one rather than
invent a third:

- a `labelKey` field, as `lib/shop/order-status.ts` does;
- a prefixed sentinel string, as `lib/phone/phone.ts` and
  `lib/auth/auth.schemas.ts` do — the value carries `phone.errors.` or
  `auth.fieldErrors.` and one seam (`usePhoneErrorText`,
  `useLocalizedResolver`) turns every one of them back into copy.

**5. Interpolate; never concatenate.** `t("itemsInCart", { n })`, not
`{t("youHave")} {n} {t("items")}`. Markup goes through `t.rich()`. This is §4
and it is the one rule that cannot be fixed later from the catalogue.

**6. Do not translate** money, dates, backend error codes, vendor-written data,
enum values or wire constants. §6 says which is which.

**7. Run the gate before you push:**

```bash
npx tsc --noEmit      # proves you caught every call site
npm run check:i18n    # parity + no hardcoded copy; both fail the run
```

### If the string genuinely should stay English

There are a few: a build-time diagnostic, a brand name, a message that is only
reachable when the catalogue itself failed to load. If you have one:

- add it to **`ALLOWLIST` in `scripts/check-i18n.mjs`** — the *file plus the
  exact string plus the reason*. Never a blanket file skip: the allowlist
  forgives the strings it names and nothing else, so real copy added to the same
  file tomorrow still fails.
- record it in §13 below, so the decision is readable without grepping a script.
- if the scanner does not flag it, **do not add a dead allowlist entry** — the
  script warns about entries that match nothing. Record it in §13 only.

---

## 13 · What Phase 10 did

The last phase. It closed the three things that were still open.

**Built**
- `npm run check:i18n`, and the gate now **fails** on hardcoded copy as well as
  on catalogue drift (§9). The scan covers the shop, auth and pay trees.
- `ALLOWLIST` in `scripts/check-i18n.mjs` — exact-string exemptions with
  reasons, plus a warning for any entry that stops matching.
- `react/jsx-no-literals` in `eslint.config.mjs`, scoped to the same three
  trees, as an editor-time second opinion. A warning, not the gate.
- `lib/auth/useLocalizedResolver.ts` — wraps `zodResolver` so every
  react-hook-form validation message is resolved once, at the seam, instead of
  at each of the ~20 places a field error is rendered.

**Converted**

| Module | What changed |
|---|---|
| `auth.schemas.ts` | Every Zod message → `auth.fieldErrors.*` keys, via `AUTH_FIELD_ERROR_PREFIX`. The numeric rules (`PASSWORD_MIN`, `BUSINESS_NAME_MAX`…) became named constants the catalogue interpolates, so the rule and the copy cannot drift. |
| `RolePicker.tsx` | `ROLE_CONFIG` lost its dead English `label`/`headline`/`description` — all three were already rendered from `modal.roles.*`. The two badge defaults now come from `authMe.*` instead of literals. |
| `auth-me/page.tsx` | Two concatenations of translated fragments (§4) became single interpolated messages: `authMe.subtitle` replaced `subtitlePrefix`, and `authMe.roleAriaCurrent` replaced a hand-built aria-label. |
| `pay/[token]/page.tsx` | Static `metadata` → `generateMetadata`, so the tab title follows the locale in the URL. |
| `addresses/page.tsx`, `payment-methods/page.tsx` | Phase 7 filled `shop.addresses` and `shop.paymentMethods` in all five catalogues but never wired the two pages, which still held 51 hardcoded strings. Wired. `TYPE_META` now carries a `labelKey` (§3). |
| `TicketDetail.tsx` | `{reply.length}/300` → `shop.support.replyCharCount`, and the `300` became one constant shared by the cap and the counter. |
| `layout/Footer.tsx` | `BRAND.description` rendered an English paragraph on every localised page, the shop screens included — the web build puts the marketing footer under them. The **visible** usage now reads `footer.description`; the constant still feeds `app/manifest.ts` and `lib/seo/jsonld.ts`, which are not per-locale. |

**Found and NOT fixed — it is the backend's string.** A support ticket's related
entity arrives already labelled: `ticket-enrichment.service.ts:412` builds
``label: `Order ${d.order_number}` `` server-side, so `/fr/shop/account/support/`
shows "Order ORD-2026-000042" whatever the locale. Nothing in this repository can
translate it — the fix belongs in the API.

**Backfilled** — `errors.*` was missing 161 codes in `pt` and 163 in `ar`, so
those two languages fell back to the backend's English at the exact moment
something went wrong. All translated. Every catalogue now carries all 266 error
codes and `KNOWN_GAP_PREFIXES` is empty.

**Deliberately English**, with the reason. The first two are in `ALLOWLIST`
because the scanner flags them; the rest are recorded here only, because it does
not, and a dead allowlist entry rots:

- `lib/shop/catalog.api.ts` — `CatalogApiError`'s message is a **build-time
  diagnostic**, read by a developer in a `next build` log. Phase 1's decision,
  unchanged.
- `components/shop/ShopHeader.tsx` — the **Wi-Mall wordmark**. A brand name, the
  same in five languages, and the hyphen is load-bearing (`wi-mall.com`; plain
  `wimall.com` is somebody else's). Split in two only to colour the second half.
- `lib/errors/is-network-error.ts` — `OfflineError`'s default constructor
  message. Never rendered: `isNetworkError` claims the error by name and the UI
  resolves it to `errors.NETWORK_ERROR` rather than reading `.message`.
- `lib/auth/error-translator.ts` — the last rung of the fallback ladder, reached
  only when `t("UNKNOWN_ERROR")` itself throws, i.e. when the catalogue failed
  to load. There is no locale to translate into at that point.
- `MOMO_PROVIDERS` in `payment-methods/page.tsx` — "MTN Mobile Money", "Orange
  Money", "Moov Money" are **proper nouns**, and the string is also half of the
  `display_label` stored on the backend and read back later. Translating it
  would make a saved label disagree with itself the moment somebody switched
  language. The field is named `brandName`, not `label`, to say so.
- `KB` / `MB` / `GB` in the file-size helper — unit symbols, on the
  `allowedStrings` list in `eslint.config.mjs`. French would prefer *Ko*; if
  that is ever wanted it is a real string and it comes off the list.

**State at handoff:** `npx tsc --noEmit` exits 0. `npm run check:i18n` reports
five catalogues at 2 388 keys each and **zero** hardcoded strings across the
shop, auth and pay trees.
