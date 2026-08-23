# Shipping the shop as a native app — the working plan

The scope is `src/app/[locale]/shop/**` plus the `(auth)` sign-in routes, wrapped in
Capacitor for Android and iOS. **Not** the marketing site, **not** the blog, and **not** a
redesign — the shop is already an app shell below `md` and stays exactly as it looks.

This file is the checklist we work from. Tick things off in it, and when a step teaches us
something the next person needs, write that down here rather than in a commit message.

**Phase 0 audit:** <https://claude.ai/code/artifact/988d03d7-2de4-4afd-9b89-c83ffb2f1763>

---

## Rules that hold for every step below

These are not preferences. Each one has already caught something.

1. **The web build is untouchable.** `npm run build` must keep producing the same routes,
   the same server rendering, the same sitemap. Anything native goes behind
   `IS_NATIVE_BUILD` (compile-time, so the branch is dropped) or `isNative()` (runtime).
   Run both builds before calling anything done.
2. **No redesign.** If a screen looks different on a phone than it did in a mobile browser,
   that is a bug unless it is a safe-area or keyboard fix.
3. **Permissions at the point of use, never at launch.** Location is requested when the
   shopper presses "Use my current location" and at no other moment. Do not add a plugin
   before the feature that needs it.
4. **Native access lives behind `src/lib/native/*`; UI lives behind
   `src/components/shop/ds/*`.** Those two seams are what let Ionic replace the UI layer
   later without a rewrite. **Do not install Ionic yet** — nothing in this plan needs it.
5. **Every native call degrades to the web behaviour.** `withNative()` returns `undefined`
   on failure and the caller falls back. A missing plugin must never break a screen.
6. **Report what the code did, not what it meant to do.** A toast that says "Link copied"
   after a share sheet is a lie; that exact bug is why `shareLink` returns an outcome.

---

## Where we are

Phases 1–3 are done, and **Phase 7 is closed**: the app ships `en,fr`, the release APK is
10.34 MB, and the minified build has now been built, signed, installed and checked for R8
damage. Phase 4 is **part-done and then deliberately parked** — see below. Phases 5, 6 and
9 have had a pass; 8 is blocked on hardware and 10 is not started, by design.

**Session 2 (2026-08-21) ran the app on a real phone** (TECNO KL6, Android 14) and the
boot loop is confirmed fixed: `logcat` shows each path requested once. But the app got no
further than its own splash screen, and the reason was worth the trip — see 4.2.

Session 3 (2026-08-22) went back to the device with Tailscale actually routing. **The shop
paints, loads live data and takes an item to the cart.** Five real defects were found and
fixed on the way there, all of them invisible to a build:

| Defect | Why it mattered |
|---|---|
| `Preferences.then()` thenable trap | Every stored read/write rejected — no session could persist |
| Splash gated solely on session state | App sat on its logo forever; the working shop was underneath |
| Mixed content (https page, http API) | Nothing could be fetched; then images auto-upgraded and vanished |
| `window.history.length` misread | Back could never exit the app |
| `trailingSlash` vs `/shop` comparisons | No tab ever highlighted; back never recognised the root |

Details in 4.2. What is still unobserved is sign-in and everything behind it: checkout,
downloads, addresses, RTL. Those need a bot code, so they need a person.

<details>
<summary><strong>Phase 1 — Foundation (done)</strong></summary>

- [x] Capacitor 8 + 11 plugins; `capacitor.config.ts`
- [x] Two build targets: `next.config.ts` reads `NEXT_PUBLIC_APP_TARGET`,
      `scripts/build-native.mjs`, `tsconfig.native.json`, npm scripts
- [x] `src/lib/platform/` — environment detection and key/value storage, importing no
      Capacitor package at module scope
- [x] Bearer auth: `src/lib/auth/token-store.ts`, `Authorization` header and
      single-flight 401→refresh→retry in `src/lib/api/client.ts`, namespace switching in
      `auth.api.ts`
- [x] `src/components/native/NativeShell.tsx` — back button, status bar, splash, deep
      links, network watch
- [x] Client containers for the four server-rendered shop routes
- [x] Query-string route aliases (`/shop/p`, `/shop/store`, `/shop/account/order`) chosen
      by `shop.routes.ts`; web URLs unchanged
- [x] `localePrefix: "always"` on the native target + `out/index.html` locale bootstrap
- [x] Android project committed, with deep-link intent filters and a debug-only cleartext
      policy
- [x] `./gradlew assembleDebug` → 27 MB APK

</details>

<details>
<summary><strong>Phase 2 — The sign-in blocker, in the backend (done)</strong></summary>

`POST /api/auth/mobile/magic/{link,code}` in `backend/jovi-mall`.

- [x] `mobile-messaging-login.{controller,routes}.ts`, mounted at `/auth/mobile/magic`
- [x] Same service and validators as the cookie twin; strict 20/min bucket preserved
- [x] 13 new invariants in `test:messaging-login` (184 passing)
- [x] 4 live assertions in `verify:messaging-login` — including that the returned token
      actually authenticates against `requireAuth`
- [x] `api-doc/auth/magic-login.md` and `customer-auth.md` updated

</details>

<details>
<summary><strong>Phase 3 — Native services (done)</strong></summary>

`src/lib/native/` — links, share, download, haptics, network, location, useAppResume.

- [x] Downloads no longer navigate the app off its own origin
- [x] Store share reports what actually happened
- [x] WhatsApp links go to WhatsApp, not WhatsApp Web in our shell
- [x] Payment verify poll restarts on app resume
- [x] "Use my current location" on the address form, via `GET /api/geo/reverse`
- [x] Coarse location only — the merged manifest has no `ACCESS_FINE_LOCATION`
- [x] **Audited for dead code.** Four exports had no call site. `selectionFeedback` went
      to `QtyStepper` and `errorFeedback` to the toast's error path; `closeExternal` and
      `isOffline` were removed as capability ahead of a feature, and `copyLink` became
      module-private. Every remaining export is called.

</details>

---

## Phase 4 — Get it running on a real device

**This is the next thing, and nothing after it is trustworthy until it is done.** Every
behaviour above is verified by a build, not by a person tapping a screen.

### 4.1 — Point the app at a reachable API ✅

- [x] `NATIVE_API_URL` in `.env.local`, read by `build-native.mjs` and passed through as
      `NEXT_PUBLIC_API_URL` for that build only. It is a **separate variable on purpose**:
      `10.0.2.2` and a LAN IP do not resolve from a desktop browser, so putting either in
      `NEXT_PUBLIC_API_URL` would break `npm run dev` for whoever set the app up.
- [x] `10.0.2.2` (emulator) and a LAN slot are in
      `android/app/src/debug/res/xml/network_security_config.xml` — debug-scoped.
- [x] Backend `ALLOWED_ORIGINS` already carries `https://localhost` and
      `capacitor://localhost`.
- [x] **Physical device:** solved with Tailscale rather than a LAN IP — this PC is
      `100.124.149.1`, set in `.env.local` (`NATIVE_API_URL`) and permitted in the debug
      network security config. Verified reachable from the PC.
- [ ] **The phone must be on the tailnet.** Session 2 failed here: the phone had Wi-Fi
      **off**, was on 4G, and Tailscale was installed but not routing, so
      `ping 100.124.149.1` was 100% packet loss. Turn Tailscale on on the phone before
      testing, or the app cannot reach the API at all.

### 4.2 — Defects found and fixed ✅

The app was installed on an emulator and launched. It did not work, and the reasons were
worth the trip.

- [x] **The app never rendered — an infinite boot loop.** Capacitor's `html5mode`
      (default on) serves the **root** `index.html` for *any* path whose last segment has
      no dot. So `/en/shop/` served the locale bootstrap, which redirected to `/en/shop/`,
      which served the bootstrap:

      ```
      D Capacitor: Handling local request: https://localhost/en/shop/
      D Capacitor: Handling local request: https://localhost/en/shop/
      …dozens per second, on a screen that never painted.
      ```

      Fixed by making every destination the bootstrap emits end in `/index.html` — a path
      with a dot in its last segment, which the server serves as a real file. The
      `/index.html` is stripped again by an inline script in the locale layout before Next
      hydrates, so the router and `usePathname` only ever see clean paths. Full reasoning
      is in `scripts/build-native.mjs`.

- [x] **Off-bundle links — a whole class, not one bug.** The app ships `/shop/**` and the
      auth routes; anything linking outside that is a client-side navigation to a file the
      export never wrote, and there is no server to 404 it. Found and fixed:
      the marketing `<Footer/>` under every shop page (seven dead links), the shop header
      logo and its "Home" nav item, both auth shells' "back to home", the floating FAQ
      button on the auth screens, and the Account menu's Help & FAQ row — which now opens
      the real site in the in-app browser. `homePath()` in `shop.routes.ts` is the one
      place that decides where "home" is.

- [x] **Status bar overlap.** `overlaysWebView: true` with no `safe-area-inset-top`
      anywhere in the stylesheet. Added `.shop-header` and `.auth-frame` rules; inert on
      the web, where `env()` resolves to zero.

- [x] **Logout went to a 404.** `/shop` is not a path the export writes — the app prefixes
      every locale. It now goes through `/`, the bootstrap, which also re-resolves the
      language.

- [x] **Post-auth redirects.** `localePath()` returns `/en/shop` with no trailing slash;
      the bootstrap now catches any extension-less path and maps it to the file that backs
      it, so these resolve with one extra hop rather than failing.

- [x] **The app hung on its own splash screen, forever.** Found on a real device in
      session 2. Three things in a row, only the last of which is a bug:

      1. the phone could not reach the API (Wi-Fi off, Tailscale not routing);
      2. `src/lib/api/client.ts` had **no timeout anywhere** — no `AbortController`, no
         `signal`. `fetch` rejects promptly when a host *refuses* a connection, but a
         network that silently drops packets never settles at all;
      3. `NativeShell` holds the splash until auth status leaves `"loading"`, and
         `AuthProvider` only leaves it when `GET /auth/me` answers.

      So an unreachable API produced a logo on a dark screen with no error, no retry and
      no way out. **This is not a lab condition** — a dead zone, a captive portal or a
      carrier blackhole reproduces it exactly, on the connections this product targets.

      Fixed with a 20s deadline in `send()`, the one chokepoint every request passes
      through (including the token refresh). `isNetworkError` had to learn about it too:
      `AbortSignal.timeout` rejects with a `TimeoutError` **DOMException**, not the
      `TypeError` that check keys on, so without that half the shopper would be told "an
      unexpected error occurred" instead of "check your connection".

- [x] **There was no way to sign out of the app.** `shop/layout.tsx` renders `ShopHeader`,
      `ShopBottomNav` and (web only) the `Footer`; sign-out lived solely in the marketing
      navbar's `UserMenuDropdown`, which the app bundle does not contain. Same off-bundle
      class as the dead links above — the control existed, just not on any screen the app
      ships. Added as a row on `/shop/account`.

- [ ] **RSC prefetches 404 on every navigation.** Not fatal, but constant. Next 16's
      segment prefetch requests `__next.$d$locale.shop.cart.txt` — **dot**-separated —
      while the export writes `__next.$d$locale/shop/cart.txt` — **slash**-separated. No
      file matches, so every prefetch fails and tab navigation falls back to a full load,
      which is the path the html5mode gotcha lives on. There is no config switch:
      `clientSegmentCache` no longer exists in 16.1.6 (only `cacheComponents` remains).
      Unresolved, and worth understanding before release.

### Session 3 — five defects between "it builds" and "it works"

Every one of these passed a green build. None was findable without a device.

- [x] **`Preferences.then()` is not implemented on android.** The single worst one.
      `storage.ts` resolved a promise **with the Capacitor plugin object**:
      `import(...).then((m) => m.Preferences)`. Resolving a promise with an object makes
      JavaScript probe it for `.then` to see whether it is a thenable — and a Capacitor
      plugin is a Proxy that answers *every* property access with a callable that
      forwards to native. So the probe found `then`, JavaScript called it, and Android
      was asked to run a plugin method named `then`.

      Consequence: **every** stored read and write rejected, on every device. No session
      could persist, no push token could be saved, and `hydrate()` rejecting is what took
      the splash down with it. Fixed by boxing the plugin (`{ plugin }`) so the thenable
      check never sees it. Do not "simplify" it back, and do not return it from an `async`
      function either — that is assimilated the same way.

- [x] **The splash had no failsafe.** It hid only when the session left `"loading"`, so
      the bug above pinned it forever. The shop underneath was fully rendered the whole
      time — header, tab bar, working error state — and a person could not see any of it.
      Two fixes: `AuthProvider.restore()` now catches and falls back to signed-out, and
      `NativeShell` hides the splash on a 25s deadline regardless of state. A failsafe
      that depends on the thing it protects against is not one.

- [x] **Mixed content, twice.** The page is `https://localhost` and the dev API is
      `http://` — Chromium blocks that outright, so `fetch` failed with a bare
      "Failed to fetch" and no request ever left the device. `allowMixedContent` bought
      back `fetch`, and then **images still vanished**: Chrome AUTO-UPGRADES mixed image
      requests to https, which the dev API does not serve. `fetch` returning 200 while
      `<img>` failed on the same URL is what makes this one confusing.

      Fixed by matching schemes: a build pointed at a cleartext API uses
      `androidScheme: "http"`. `http://localhost` is still a secure context by spec, so
      geolocation and clipboard are unaffected. Production is untouched and stays https.
      Needs `http://localhost` in the API's `ALLOWED_ORIGINS` (added).

- [x] **`window.history.length` is not a position.** The back handler asked
      `history.length > 1`, but that is the number of entries and it never decreases —
      after shop -> product -> back it still reads 2. So the first branch always won,
      `history.back()` no-opped against an already-rewound history, and **the app could
      not be closed with the back button at all**. Replaced with a depth counter the app
      maintains itself: forward navigations add, `popstate` takes away.

- [x] **`trailingSlash: true` broke every path comparison.** The app build must use it
      (Capacitor serves a directory URL to its `index.html`), so `usePathname()` answers
      `"/shop/"` while every constant is written `"/shop"`. Nothing warns; the
      comparisons just stop being true. Two visible symptoms: the back button never
      recognised the shop root, and **no bottom-tab item ever showed as active** — true
      on a device, false on the web, from the same code. Fixed with `normalizePath()` in
      `shop.routes.ts`, used by `NativeShell`, `ShopBottomNav` and `ShopHeader`.

**Found but NOT fixed — out of scope, needs a decision:**

- [ ] **The login screen renders its header twice.** `(auth)/layout.tsx` wraps everything
      in `AuthShell`, and `login/page.tsx` renders `AuthSplitShell` inside it; both draw a
      logo, language picker and theme toggle. **This affects the web too** — it is not an
      app regression.
- [ ] **The app shows the four-role web login.** A customer-only shop asks whether you are
      a vendor, an agency or an agent, with "I want to shop" fourth. Correct for the
      website, wrong for this app.
- [ ] **RSC prefetch 404s** — see below; unchanged, still noisy, still non-fatal.

**Guard against the class:** every literal `href` under `src/app/[locale]/{shop,(auth)}`
and `src/components/{shop,auth}` now resolves to a route present in `out/`. Re-run that
cross-check after adding any link:

```bash
(cd out/en && find . -name index.html | sed 's|^\.||; s|/index.html$||; s|^$|/|' | sort)
grep -rhno 'href="/[^"]*"' src/app/\[locale\]/shop src/app/\[locale\]/\(auth\) \
  src/components/shop src/components/auth | sed 's/^[0-9]*://' | sort -u
```

### Session 4 — signed-in walkthrough, three more device-only defects

- [x] **"Use my current location" could never work on Android.** Two faults stacked, and
      the first is a trap this codebase set for itself. `location.ts` asked for
      `permissions: ["location"]` — the FINE permission — and then checked
      `permission.location`. The manifest deliberately declares COARSE only, so Android
      always answers `{ coarseLocation: "granted", location: "denied" }`, even the
      instant the shopper taps Allow. The check read a permanent denial every time.

      Fixed, and then it still failed: `getCurrentPosition` threw *"Could not obtain
      location in time"* against a 10s timeout. `enableHighAccuracy: false` asks for the
      NETWORK provider, which routinely needs 15s+ on cellular — asking for the slow
      provider and giving it a fast deadline. Raised to 30s; `maximumAge` keeps the
      repeat case instant. Now fills address, city and region from the reverse geocode.

      **The lesson generalises:** the coarse-location rule is enforced in the manifest
      but was contradicted in the code, and nothing failed the build.

- [x] **Close-account copy contradicted itself.** The overflow sheet said "Permanently
      delete your account and its data" one tap above a screen explaining that past
      orders are kept. ADR-A02 D-2 forbids the first sentence. Corrected to match.

- [x] **Offline add-to-cart said nothing useful — and the first fix was on the wrong
      step.** Session 4 put an `isNetworkError` branch in the `catch` around the add.
      That catch never sees an add failure: `addItem` **returns** its failures rather
      than throwing them, so the only thing it ever caught was `resolveQuickAdd`, the
      catalogue read that runs first. Session 4 could not provoke it because that read
      is usually served from the HTTP cache — so the branch stayed green and untested
      while the real add failure fell through to `errorMessage`, which returned
      `error.message` verbatim.

      **What a signed-in shopper with no signal was actually shown:** the WebView's own
      `Failed to fetch`, or `signal timed out` from the 20s deadline in
      `lib/api/client.ts`. Worse than the generic line it replaced, in English, on all
      five locales.

      Three more found in the same place, all of them latent until an outcome was added:
      the product page's `switch` had no `default`, so a new outcome makes the main
      **Add to cart** button do nothing at all; `/shop/saved` and the store page both end
      their `if/else` with `router.push(productPage)`, so an unhandled outcome answers a
      connectivity failure by navigating to a page that cannot load either.

      Fixed by moving the whole ladder to **`src/lib/shop/cart-errors.ts`** as a pure
      function — the version inside a `useCallback` in a `"use client"` component could
      be typechecked and nothing more, which is precisely how it stayed unverified.
      `{ kind: "offline" }` is now an outcome, so every caller's exhaustive switch has to
      answer for it, and `ProductDetail` has a `satisfies never` default so the next one
      cannot fail silently. `CART_OFFLINE_MESSAGE` is the single copy of the sentence;
      there were two, drifting.

      **Ordering matters and was got wrong once on the way:** backend codes are read
      first and connectivity only after, because `isNetworkError` consults a platform
      probe that answers for the moment it is *asked*, not the moment the request was
      made. Asking it first turned real 409s into "check your network" on a flapping
      signal. `instanceof AuthError` settles it — those are built only in
      `throwResponseError`, so their presence proves a response arrived.

      **Verified**: 19 assertions against the compiled module, covering each engine's
      fetch rejection, our `TimeoutError` and `OfflineError`, every backend code, and the
      probe-says-offline-but-a-409-is-in-hand case. Still unseen on a device — but it is
      now provokable, which it was not: sign in, airplane mode, add to cart.

**Also learned:** the catalogue survives airplane mode from HTTP cache. ⚠ **The other
half of that note was wrong and is what hid the bug above:** an offline add succeeds
locally and syncs later **only signed out**, where the cart is a localStorage write.
Signed in, the server is the source of truth and every add is a live call that fails
offline — so the "optimistic" behaviour that made the failure unprovokable does not exist
on the path that matters.

### Session 5 — paying for an order that was already placed

Not a device session. This closed the hole session 4 walked into: `checkout` creates the
orders **before** it charges anything, so a declined prompt leaves a real order behind —
which is the right design, and was only half-built. The order sat there unpayable, and the
success screen's own "Pay for this order" button led to a detail page with no way to pay.

- [x] **`PayGroupSheet` on the order detail.** A sheet on the group card, shown only when
      the group is actually payable. `components/shop/account/PayGroupSheet.tsx`.
- [x] **It pays by `cartId`, not `orderId`.** The backend takes either, and the note in
      `api-doc/customer/BACKEND-REQUIREMENTS-order-detail.md` led with `orderId` — but a
      group is charged **once**, which is what the screen already tells the shopper, and
      `initiatePaymentForCart` filters to the orders that are still payable by itself. So
      one cancelled order inside a group does not need a per-order call to avoid being
      re-charged. Recorded because "the backend supports `orderId`" reads like an
      instruction to use it.
- [x] **The retry needs no retry logic**, and that is the point. `initiate` is idempotent
      on `(cartId, user, total)`: `SUCCEEDED` comes back as-is, `INITIATED`/`PENDING` comes
      back **with its original instructions** — so tapping pay again re-shows the USSD code
      for the prompt already on the handset instead of sending a second one — and only
      `FAILED`/`CANCELLED` mints a new transaction. There is deliberately no "has a payment
      started?" check in the client; the server answers it better.
- [x] **A failed payment does not make an order unpayable — verified in the backend.**
      Nothing on the gateway path writes `failed` to the *order*; only `cancelOrder` does
      (`order.service.ts:201`). So a declined prompt leaves the order at `AWAITING_PAYMENT`,
      which is what makes retrying possible at all — and a **cancelled** order drops out of
      the payable filter for free, without the storefront reasoning about fulfilment state.
      `canPayGroup`/`payableOrders` in `order-status.ts` mirror the server's own filter, the
      same discipline as `canCancel`.
- [x] **The button shows what will actually be charged.** `payableTotal`, not the group's
      `totalAmount` — the server charges `payable.reduce(...)`, so on a group with one
      cancelled order the two differ and `totalAmount` would promise one figure and take
      another.
- [x] **Card is deliberately absent from this sheet.** `initiatePayment` returns a Stripe
      `clientSecret` the storefront has never consumed on any platform (Track B), so a card
      tap would create a transaction nothing can complete and leave the order looking
      mid-payment. Checkout still offers it, unchanged — that is the open product decision,
      and this was not the place to spread it. One array entry (`CARD`) on the day it works.
- [x] **The payment picker is now shared.** `components/shop/PaymentMethodPicker.tsx`,
      lifted out of the checkout page. Two copies of the gateway↔operator mapping is the
      kind of duplication that drifts into an option that works on one screen and 400s on
      the other. The *option list* stays the caller's choice, which is what lets the two
      screens differ on purpose.
- [x] **Four error codes had no copy in any of the five locales** — `PAYMENT_ORDER_IS_COD`,
      `PAYMENT_CART_NOT_FOUND`, `PAYMENT_CART_NO_PAYABLE_ORDERS`,
      `PAYMENT_CART_MIXED_CURRENCY`. They were in the `BackendErrorCode` union, so nothing
      typechecked wrong; `translateCode` would have fallen through to the backend's own
      English. All are reachable from this exact screen. Added.
- [x] **`GroupPaymentStatus` was missing half its members.** The server's
      `aggregatePaymentStatus` can answer `refunded`, `failed`, `disputed` and `unknown`;
      the frontend type had four of eight, so `groupPaymentChip` fell to its `?? UNKNOWN`
      fallback and **a fully refunded order told the customer "Unknown"** — the worst
      available answer to "what happened to my money", from a map that was in a position to
      answer it exactly. Type and chip map both completed.
- [x] **A refused `initiate` no longer pretends to be pending.** The gateway is called
      synchronously, so a refusal arrives on the `initiate` response — but the success
      screen treated every fresh transaction as pending and polled `verify` fifteen times.
      A shopper whose payment was already declined watched "Waiting for your payment" for a
      minute before being told. `isSettledFailure` + a `failed=1` param, symmetric with the
      existing `cod=1`. **This applied to checkout too and was fixed there as well** — same
      code path, same lie.

### Session 5b — how payment actually works, and the operator trap

Read out of the backend rather than assumed. **The gateway and the operator are two
different questions**, and conflating them is what the storefront was doing wrong.

- [x] **The gateway is ours and is never shown.** `initiate` requires a `gateway` and
      there is **no server default** — `getPaymentGateway()` throws
      `400 PAYMENT_GATEWAY_NOT_SUPPORTED` for anything outside its three. So the client
      must send one, and it always sends **NOTCHPAY**. A shopper has no way to know what
      NotchPay or My-CoolPay are; choosing between them is choosing between two of our own
      merchant contracts. It lives on the option constant and on no screen.
- [x] **My-CoolPay is not a drop-in swap.** Its Orange Money flow answers `REQUIRE_OTP`,
      which needs a code screen plus `POST /payments/:id/authorize`. NotchPay implements no
      `authorizePayment` at all, so `gatewaySupportsOtp('NOTCHPAY')` is false and the
      orchestrator refuses the step cleanly. Switching gateways is a feature, not a config
      change.
- [x] **THE TRAP: a declared operator always beats the phone number.**
      `resolveCameroonOperator` starts `if (stated === 'MTN' || stated === 'ORANGE') return
      stated;` — so tapping "MTN" and typing an Orange number sent `cm.mtn` for an Orange
      number and the charge was declined at the gateway with nothing on screen explaining
      why. The backend's own comment names that as the outcome to avoid; it simply cannot
      avoid it, because by then the wrong answer has already been declared.

      Fixed by deriving the network where the number is typed:
      `src/lib/shop/cm-operator.ts` mirrors the backend's `PREFIX_RANGES` and selects the
      tile as the shopper types. Overriding still works, because Cameroon has number
      portability. **The two tables are a mirror and must not drift** — they were verified
      identical when written (MTN 650-654/670-679/680-684, Orange 655-659/685-689/690-699).
- [x] **660-669 (Nexttel) and 62x (Camtel) cannot be charged by either gateway.** They
      answer `422 PAYMENT_OPERATOR_UNDETERMINED`, which a shopper reads as "payment
      declined". Now warned inline under the field, before the pay button, in the one place
      where the fix — use an MTN or Orange number — is still actionable.
- [x] **`instructions.message` was being discarded.** NotchPay writes it per `action`, and
      a `cm.mtn` charge answers `action: "confirm"` with **no ussd at all** — the operator
      pushes the prompt to the handset and there is nothing to dial. The success screen
      rendered a USSD box or nothing, so the commonest mobile-money path showed the shopper
      no instruction from the gateway whatsoever. Now carried through as `note` and shown
      under "What to do now" when there is no code to dial.
- [x] **Two more error codes had no type entry and no copy in any locale** —
      `PAYMENT_OPERATOR_UNDETERMINED` and `PAYMENT_CURRENCY_NOT_SUPPORTED`. Both are
      reachable from checkout. Added to the union and to all five locales.
- [x] **Brand artwork**, supplied by the user in `payment-methods-images/` and cut down to
      `public/payment/` (~14 KB for all four). The supplied art is a full lockup on a white
      surround; at 40px the wordmark is unreadable and the row label already says the name,
      so the tiles are cropped to the **glyph** on the brand colour. Visa is a dark-navy
      wordmark on transparency and would be **invisible in dark mode**, so the card marks
      sit on a white plate — which is how a card reads anyway. Checked in both themes.

⚠ **Currency:** NotchPay refuses any currency with a minor unit
(`422 PAYMENT_CURRENCY_NOT_SUPPORTED`). XAF is zero-decimal so FCFA passes unchanged — but
this is another reason the ₦/Naira copy elsewhere is not merely cosmetic.

**Not built, on purpose:** `POST /payments/:transactionId/authorize` and
`instructions.requiresOtp` exist in the backend (My-CoolPay's Orange Money flow) and the
storefront handles neither. It is unreachable today — the storefront routes Orange through
NotchPay — so building it now would be capability ahead of a feature, which is exactly what
the Phase 3 audit removed. Noted so it is found on the day MyCoolPay is switched on.

**Unverified:** every line above typechecks, lints and survives both builds. None of it has
been seen to move money — the gateway leg is the open backend question from session 4.

### 4.3 — Walk every flow, on a physical phone and not just the emulator

Emulators lie about safe areas, keyboards and network transitions.

**Ready to test.** The boot loop is fixed and both builds are green, but everything below
is still unobserved — the emulator run got far enough to prove the app was broken, not far
enough to prove it works. Treat every box here as genuinely unknown.

Setup: put your LAN IP in `.env.local` (`NATIVE_API_URL`) and in
`android/app/src/debug/res/xml/network_security_config.xml`, add `http://<ip>:3000` to the
backend's `ALLOWED_ORIGINS`, then `npm run native:android`.

The first thing to confirm, before anything else, is simply **that the shop paints** — and
that `adb logcat -s Capacitor:*` shows each path requested once rather than repeatedly.

- [x] **The shop paints**, with live data — real category counts, real products, FCFA.
- [x] Product page from a card. The query alias resolves:
      `/en/shop/p/?store=…&slug=…`. Quick-add on a variant product correctly opens the
      page to choose rather than guessing a variant.
- [x] Add to cart — badge went to 1, and **survived a full app restart**, which is the
      Preferences fix working end to end.
- [ ] Filters change the URL, back steps through them
- [ ] Store page from a product; change quantity, remove a line
- [x] Sign in with a bot **code** — done by the user; the session then SURVIVED a kill
      and relaunch, which also ticks that Phase 5 line.
- [x] Cart merges on sign-in; the badge carried the anonymous line across.
- [x] **Use my current location** — works, after two fixes (see session 3 below). Fills
      label, address line, city and region from the reverse geocode and attaches
      coordinates. The DENIED path shows an accurate, actionable message; the
      permission dialog appears at the point of use and asks for **approximate**
      location only.
- [x] Quantity stepper and line removal, both round-tripped through the API.
- [x] Share a store — the real Android share sheet opens, and dismissing it produces
      **no toast**, which is Rule 6 holding.
- [x] Contact seller — opens WhatsApp Business itself, not WhatsApp Web in the shell.
- [x] Sign out — lands on the shop root, and clears the access token, the refresh token
      AND the push token.
- [ ] Buy a digital product and download it — **blocked**: no payment can complete.
- [ ] Checkout end to end — see the payment note below.
- [ ] **Pay an order left at `AWAITING_PAYMENT`** from its detail screen (session 5).
      Built and unobserved: it needs a gateway that answers, so it is blocked on the same
      thing checkout is.
- [~] Checkout with mobile money — **the app half works, the gateway does not.** The order
      was created (`ORD-2026-000046`, 100 FCFA), the app routed to the order detail via
      its query alias, and it reported "Awaiting payment" rather than claiming success.
      **No prompt ever reached the handset**, so the verify poll, the backgrounding and
      `useAppResume` are all still unobserved. Raised with the backend — see
      `api-doc/customer/BACKEND-REQUIREMENTS-order-detail.md`.

      Gap found while testing: an order sitting at `AWAITING_PAYMENT` offered the shopper
      **no way to pay**. **Built — see Session 5 below.** Not yet exercised on a device,
      because provoking it needs a gateway that answers.
- [ ] Buy a digital product and download it; confirm it lands in the OS download manager
      and the app is still where you left it
- [ ] Share a store; contact a seller on WhatsApp
- [ ] Sign out, and land somewhere real

### 4.4 — The shell itself

- [x] Hardware back within history, and at the shop root (exits to the launcher —
      verified). Deep-link-with-no-history still untested.
- [ ] Keyboard: the tab bar must not ride up over the field being typed into.
      `resize: "body"` against a `100dvh` shell with `overflow: hidden` is the risky
      combination.
- [ ] Tab bar clear of the home indicator; toast above the tab bar
- [x] Splash is a **200ms Android timer** and no longer waits for anything. Twice now,
      gating it on state hid a working app behind a logo — and the second time the
      failsafe was hidden behind the same state. See session 6.
- [x] Status bar not overlapped — the header sits correctly below it on a real notchless
      device. Theme-toggle readability in both directions still untested.
- [ ] Airplane mode mid-request: the message says "check your connection", not
      "unexpected error"
- [ ] Rotate the device; check nothing in the shell is pinned to a viewport height
- [~] Arabic (RTL) — **not applicable to the app any more**: `APP_LOCALES=en,fr` ships no
      RTL locale, so there is no way to reach RTL layout on a device. Still live on the
      website, and still worth walking there. Reinstate this line the day `ar` is added
      back to an app build.

**Exit criteria:** a person can install the APK, browse, sign in with a code, and buy
something, without touching a browser.

---

### Session 6 — the splash could never have been fixed in JavaScript

Phase 7's language decision is in Phase 7. This is what testing it turned up.

- [x] **The splash's only exit lived in the bundle it was protecting against.**
      Session 3 hid it when the session resolved and added a 25s "failsafe" beside
      it — but that failsafe was a `setTimeout` in `NativeShell`, so both required
      React to have mounted. A bundle that never runs had no way out at all.

      Not theoretical. On the API-29 emulator the app sat on its logo for **over
      three minutes** with no error, and `logcat` showed the WebView had never
      requested a single path. Exactly the session-3 symptom, from a cause
      session 3's fix could not reach.

      Fixed structurally, in three layers, only the first of which is ours:
      `launchAutoHide: true` with `launchShowDuration: 200` hands the dismissal to
      **Android**, which a broken WebView cannot take down; the JS hide in
      `NativeShell` is now only a fast path; and the progress line that replaces it
      has a **CSS** exit as well as a JS one.

      **The rule: nothing that unblocks the UI may depend on the bundle running.**

- [x] **The splash no longer doubles as the loading indicator.** It is 200ms, and
      `components/native/AppLoading` — a 3px brand-green line at the top of the
      screen — covers the one gap after it: resolving the session. Not the
      catalogue; that has the shop's own skeletons, which are a better loading
      state than a shell can draw.

      A full-bleed green overlay was built first and was wrong: the exported HTML
      already paints the header, tab bar and skeletons, so the overlay hid a
      working storefront to avoid a much smaller flash — the avatar and cart badge
      settling. The line has a 150ms entrance delay, so a fast restore shows
      nothing at all.

      Verified with **every `.js` returning 404**: the line appears, retires at
      ~12.4s from the CSS engine alone, and leaves the shopper on the real shop
      shell. That is recoverable; a logo is not.

- [x] **`AppTheme.NoActionBar` now paints the brand green.** Only became visible
      once the splash stopped waiting: the inherited DayNight default is white, so
      a slow cold start flashed white between two green screens.

- [ ] **The API-29 AVD cannot run this app's JavaScript, and never could.**
      `Uncaught SyntaxError: Unexpected token ?` / `Unexpected token .` on **every
      chunk** — optional chaining and `??`, which Chromium 74 (the WebView that AVD
      ships, from 2019) does not parse. Next 16 targets modern browsers and there
      is no browserslist here.

      So the emulator is only good for the native layer — install, signing, R8,
      plugin resolution, splash timing. **Anything above the static HTML needs
      API 33+ or a real handset.** Also add `-gpu host`: with the default
      `swiftshader_indirect` the WebView never gets a GL surface
      ("eglChooseConfig failed") and does not paint at all.

      ⚠ **The open question this raises is not about the emulator.**
      `minSdkVersion` is 24 and there is no transpilation target, so any handset
      whose WebView predates Chromium 80 gets a blank shell. WebView updates
      through Play independently of the OS, so most devices are fine — but "most"
      is doing work in a market with sideloaded and Play-less devices, and nobody
      has measured it. Either set a browserslist floor or raise `minSdkVersion`
      knowingly.

---

## Track B — Decisions that gate release (start now, in parallel)

These are not engineering, they take calendar time, and one of them can change what the
app is allowed to sell. Raise them today, not at submission.

- [ ] **Apple's IAP rule.** The shop sells e-books and courses and has a downloads library.
      Apple may require in-app purchase (30%) for digital goods bought inside the app.
      Resolve **before** building the iOS target — the answer can change scope.
- [x] **Account deletion — done, and it is called "closure".** The backend endpoint
      already existed and the plan was wrong to list it as missing: **`POST /api/me/close`**,
      `requireAuth`, customer-only, body `{ "confirm": "CLOSE MY ACCOUNT" }`, returning
      `{ closedAt }`. 422 for a non-customer role or orders still in flight; 409 on a
      double submit.

      ⚠ **It anonymises and retains — it does not delete.** ADR-A02 D-1 strips the name,
      contact details and addresses; D-2 explicitly forbids describing that as a deletion
      or as satisfying a legal right to erasure. The screen at `/shop/account/close`
      therefore says "close", and discloses what survives in the endpoint's own words:
      past orders are kept as business records, without the shopper's name or contact
      details. Both stores accept disclosed retention; neither accepts a false promise, so
      the wording is the deliverable as much as the button is.
- [ ] **Privacy policy URL + Play data-safety form.** Declare location (coarse, optional)
      and whatever push collects.

      ⚠ **And now a third thing, which is not ours to skip.** Since 2026-08-23 the order
      screen shows the **delivery agent's given name and photograph** to the recipient
      while that agent is carrying their parcel — backend
      `docs/ADR-A06-AGENT-IDENTITY-DISCLOSURE.md`. That is a worker's name and face
      disclosed to a member of the public, and the ADR hands both documents back to us
      explicitly: **no backend change can close either.** The privacy policy must say that
      the disclosure happens, that it is scoped to an active delivery, and that it is
      revoked at `delivered`/`returned`; the data-safety form must reflect it. The app
      does not cache the block, which is the claim the policy has to stay true to.

      There is also **no privacy policy page in this repo yet** — not stale, absent. Play
      needs a live URL, so the page is part of this item, not a follow-up to it.
- [ ] **Stripe cards.** `initiatePayment` returns a `clientSecret` the frontend has never
      consumed — on web either. Either build the flow (in-app browser + deep-link return)
      or drop the card option in the app. It is a product decision, not a port.
- [ ] **Bot number / Telegram bot name** set in the app build's env, or sign-in has no
      entry point.

---

## Phase 5 — Sign-in, all the way

Code entry works with nothing further. The magic **link** needs domain verification, and
until it has that it silently opens the browser instead of the app.

- [x] Release keystore: `C:/Users/Fante/keystores/wi-mall/wi-mall-release.keystore`
      (alias `wimall-shop`, RSA 2048, valid to 2054), password in `credentials.env`
      beside it. **Outside the repo, and irreplaceable** — losing it means never being
      able to update the app on Play again. Back it up somewhere that survives this
      machine. Regenerating is free *only* until the first Play upload.

      **Regenerated once already**, and the reason is a standing warning: the first
      password reached a Gradle *error message*, and from there a build log. Anything
      interpolated into a Gradle failure is printed. The directory now carries an
      owner-only ACL (`FANTE-DEV\Fante:(F)`, inheritance stripped) and the generator
      never echoes the password to a terminal.
- [x] SHA-256: `EE:8F:FC:58:F2:17:23:4A:C9:62:82:7D:C2:0A:E0:2E:32:7B:71:66:56:77:E5:FF:17:6B:82:AB:50:D6:53:F1`
      — verified to be what actually signs the APK (`apksigner verify --print-certs`).
- [x] `public/.well-known/assetlinks.json` written with that fingerprint, so it deploys
      with the site. **Not yet live** — it only counts once `https://wi-mall.com` serves it.

      ⚠ **Play App Signing will change the answer.** If you let Google manage the signing
      key (the default for new apps), Play re-signs the upload with a *different* key, and
      the fingerprint above stops being the one that matters. Add Play's app-signing
      certificate fingerprint to the array — keep both — or every magic link opens the
      browser instead of the app for anyone who installed from the store.
- [x] Manifest claims verified: `wi-mall.com` and `www.wi-mall.com`, path prefixes
      `/shop` and `/login/magic`, `autoVerify="true"`. The backend builds magic links as
      `${STOREFRONT_URL}/login/magic?t=…` with **no locale prefix**, so the filter matches.
      (Share links to `/fr/shop/…` would not — noted, not yet a problem.)
- [ ] Verify: `adb shell pm get-app-links com.wimall.shop`
- [ ] Tap a real magic link from WhatsApp on a device with the app installed
- [ ] Confirm the token is redeemed once — a link opened twice must fail the second time
- [ ] Kill and relaunch the app: the session survives (`hydrate()` → `GET /auth/me`)
- [ ] Leave it a day and relaunch: `GET /api/auth/mobile/auth-me/customer` re-issues the
      pair at full lifetime, which is what restarts the 30-day window
- [ ] Force a 401 mid-session and confirm exactly one rotation happens, not four

---

## Phase 6 — Push notifications

The unread badge deliberately does not poll, to protect the rate limit. Push is the
correct fix, and order-status updates are the app's reason to earn a home-screen slot.

**The plan was wrong that this is "mostly backend work" — the backend was already
finished.** It predates the app and serves the vendor dashboard too.

- [x] Backend: `POST`/`DELETE /api/customer/devices` already existed
      (`notifications/controllers/device-token.controller.ts`). Tokens are keyed by
      **user**, not customer, and `upsertToken` makes registration idempotent.
- [x] Backend: the sender is already wired — `customer-notification-event-consumer.ts`
      subscribes to `order.created`, `order.cancelled` and `shipment.status_changed`.
      `FcmPushService` degrades to a **no-op** unless `FCM_ENABLED` plus
      `FCM_PROJECT_ID`/`FCM_CLIENT_EMAIL`/`FCM_PRIVATE_KEY` are all set, which is why the
      client can register against a backend with no Firebase behind it and nothing breaks.
- [x] Client: `@capacitor/push-notifications` installed; `src/lib/native/push.ts` holds
      the plugin access, `src/lib/shop/push-routing.ts` the URL mapping, and
      `components/shop/PushBridge.tsx` binds them.
- [x] Permission requested **after an order**, in `checkout/success`, on `paid` or `cod`
      and never on `pending`/`failed`. Not at launch: Android 13+ shows that dialog
      exactly once, so a reflexive "no" from a stranger is permanent.
- [x] Deep links mapped. **The trap:** the backend's payload names an `orderId`
      (`path: "orders/<id>"`) but the shop's detail screen is keyed by `cartId` — a
      checkout writes one order per vendor, all sharing a cart. So an order deep-link
      costs one `getOrder()` lookup to read its `cartId`; a failed lookup lands on the
      order list rather than an error. Bookings have no screen in the bundle and go to the
      notification inbox.
- [x] Unread badge refreshed on receipt and on tap, via `NotificationsProvider.refresh`.
      `PushBridge` lives inside `ShopProviders` for exactly this reason — `NativeShell`
      sits outside them and cannot reach the badge.
- [x] Token withdrawn on sign-out (`useAuth.logout`), which also covers account closure.
      Without it the next person to hold the phone gets this shopper's order updates.
- [x] **A notification icon that is not a white blob.** A status-bar icon is composited
      from its ALPHA ALONE, so the launcher icon Android falls back to flattens into a
      solid rounded square. `drawable-*/ic_stat_wi_mall` is the mark as a stencil — body
      white, face punched through to transparent — named in the manifest as
      `com.google.firebase.messaging.default_notification_icon`, with
      `default_notification_color` beside it for the tint. Both are read by Firebase's own
      builder, which draws the notification on **both** paths: the SDK when the app is
      backgrounded, and `PushNotificationsPlugin.fireNotification` when it is foregrounded.
      Neither goes through code of ours, so the manifest is the only place to say this.
- [ ] **The `jovi_default` channel is never created.** The backend addresses
      `android.notification.channelId: 'jovi_default'` (`fcm-push.service.ts`), and no
      client creates it. Firebase does not drop the message — `getOrCreateChannel` falls
      through to `fcm_fallback_notification_channel` — so it arrives, filed under a channel
      the shopper sees as "Miscellaneous". Fix is one `PushNotifications.createChannel`
      call in `startPushListeners`, but it wants a translated name and an importance
      decision, so it is its own change.
- [ ] **Firebase project + `google-services.json`** (git-ignored) for Android. Only you
      can create this. Until it exists, registration fails at runtime and is swallowed —
      the app is unaffected, and push simply never arrives.
- [ ] Backend `FCM_*` env vars from the same project's service account.
- [ ] APNs key for iOS.
- [ ] **Nothing here has been seen to deliver a notification.** It compiles, it builds,
      the permission is in the merged manifest and the icon resources resolve; that is all
      that is known. The icon has never been seen in a real status bar.

Cost of the plugin: the debug APK went from 26.6 MB to 28.5 MB (firebase-messaging).
`POST_NOTIFICATIONS` is now in the merged manifest, and location is still
`ACCESS_COARSE_LOCATION` only — checked, because that rule is easy to lose to a merger.

---

## Phase 7 — Bundle size

**Settled. The app ships English and French, and the release APK is 10.34 MB** —
down from 20.3 MB, with no change to the website.

### What it actually costs, measured in the APK and not in `out/`

The earlier note here framed the decision as "62 MB of `out/` versus roughly 14 MB",
which is the right ratio attached to the wrong number: nobody downloads `out/`.
Android stores those assets deflated, and HTML and RSC payloads compress about 3.5×.
Read out of the release APK's own zip directory:

| | raw | in the APK |
|---|---|---|
| `assets/public/en` | 10.3 MB | **3.16 MB** |
| `assets/public/fr` | 11.4 MB | **3.44 MB** |
| `assets/public/es` | 10.9 MB | 3.31 MB |
| `assets/public/ar` | 11.9 MB | 3.34 MB |
| `assets/public/pt` | 9.7 MB | 3.06 MB |
| `assets/public/*` shared (`_next`, images) | 4.1 MB | 2.29 MB |
| dex, native libs, resources | — | 1.42 MB |

So a locale is **~3.2 MB of download**, not ~11 MB. That is what made the decision
answerable rather than dramatic: five languages were 16.3 MB of a 20 MB app.

- [x] **Decided: `en,fr`** — Cameroon's two official languages. `out/` 62 MB → 28 MB,
      release APK 20.3 MB → **10.34 MB**. A Portuguese, Spanish or Arabic speaker gets
      the app in English; all five stay on the website, untouched.
- [x] **It is a build-time switch, not a fork.** `APP_LOCALES` in `.env.mobile`, read by
      `build-native.mjs` and forwarded as `NEXT_PUBLIC_APP_LOCALES` so the compiler
      inlines it. Unset — every web build and `npm run dev` — it is all five and nothing
      downstream can tell the difference. Changing the answer later is one line and a
      rebuild.
- [x] **Everything that must agree with the trees on disk derives from one constant.**
      `SHIPPED_LOCALES` in `src/i18n/routing.ts` feeds `generateStaticParams` (which
      trees get written), `defineRouting` (what next-intl will route), `LOCALES` in
      `lib/i18n-provider` (every language picker — the shop's sheet, the auth control,
      the marketing navbar), and the locale bootstrap in `build-native.mjs` (what a cold
      start may resolve to).

      **A locale offered anywhere but absent from the export is a dead tap**, because
      Capacitor has no server to 404 it — the same class as the off-bundle links in 4.2.
      Verified: the picker renders exactly `English` and `Français`; a device reporting
      `pt-PT` cold-starts to `/en/shop/` rather than to a `/pt/` tree that was never
      written; no `href="/pt|es|ar/…"` survives anywhere in `out/`.
- [x] **The bootstrap's locale list is a MIRROR of `parseShippedLocales()`** and must not
      drift. One runs in a plain Node process before the build, the other is compiled into
      the bundle, so they cannot be shared. Same parsing rules on both sides: unknown codes
      dropped, canonical order kept, empty falls back to all five.
- [x] **`no_product_image.png`: 878 KB → 94 KB**, the "easy 800 KB" the old note left on
      the table. Palette-quantised at the same 1254², RMSE 1.23 — indistinguishable side by
      side, and it is a flat illustration, not a photograph. `public/` is now 193 KB total.
- [x] **The language choice now survives a relaunch.** Found while wiring the bootstrap:
      it reads `localStorage["wi-mall-locale"]` and **nothing had ever written that key**,
      so the branch was dead and every cold start fell through to `navigator.language`.
      A shopper who chose French got English again on the next launch. `setLocale()` now
      writes it, native build only.

      It must be `localStorage` and not `platform/storage`: on a device that would be
      Capacitor Preferences, which is `SharedPreferences` and **is not visible to the
      bootstrap** — a bare HTML page that runs before any plugin is loaded. The comment
      in `build-native.mjs` claiming Capacitor mirrors the two was simply wrong, and has
      been corrected.

### The RSC segment payloads — measured, and mostly NOT dead

Worth writing down because the obvious conclusion is wrong. `.txt` files are **38.9 MB
across 1082 files**, 63% of the old `out/`, and 4.2 records that segment prefetches 404 at
runtime. That reads like 39 MB of free savings. It is not.

Served `out/` through a local server that mimics `WebViewLocalServer` exactly and drove the
shop in Chromium, recording every request:

| | files | size | observed |
|---|---|---|---|
| `index.txt` | 116 | 12.95 MB | **200 — used** by client navigation |
| `__next.$d$locale.txt` | 115 | 11.87 MB | **200 — used** |
| `__next._full.txt` | 116 | 12.95 MB | never requested in the walk |
| `__next._head/_index/_tree.txt` | 348 | 0.64 MB | **200 — used** |
| nested `__next.$d$locale/**` | 385 | **0.5 MB** | **404 — genuinely dead** |

The 404s are real and constant, but they are the *nested* files: the export writes
`__next.$d$locale/shop/account/notifications.txt` (slash-separated) while Next requests
`__next.$d$locale.shop.account.notifications.txt` (dot-flattened). That mismatch is only
0.5 MB. Pruning it is not worth a post-build step.

- [x] **And it cannot be switched off.** Confirmed in the installed Next 16.1.6 rather than
      assumed: `clientSegmentCache` is gone from the config schema (only `cacheComponents`
      and `ppr` remain), and `collectSegmentData` is called unconditionally from
      `app-render.js` wherever static flight data is generated. Locales were the only lever,
      which is what makes the decision above the whole of this phase.

### The minified release build has now been run ✅

The standing ⚠ here was that R8 breaking Capacitor is silent — a stripped plugin does not
fail the build, it no-ops at runtime. Checked two ways:

- [x] **Statically, in the release DEX.** All twelve plugins survive R8 —
      `AppPlugin`, `BrowserPlugin`, `ClipboardPlugin`, `GeolocationPlugin`,
      `HapticsPlugin`, `KeyboardPlugin`, `NetworkPlugin`, `PreferencesPlugin`,
      `PushNotificationsPlugin`, `SharePlugin`, `SplashScreenPlugin`, `StatusBarPlugin` —
      along with `Bridge`, `BridgeActivity`, `Plugin`, `PluginHandle`, `PluginMethod` and
      `JSInjector`. The keep rules in `proguard-rules.pro` work.
- [x] **On a device.** Installs, is signed by the expected key
      (`ee8ffc58…50d653f1`, matching `assetlinks.json`), starts `BridgeActivity`, and shows
      the branded splash with no `ClassNotFoundException` and no crash.

⚠ **Still unproven: a release APK talking to a real API.** Cleartext is debug-scoped by
design, so a release build cannot reach a plain-HTTP dev server — correct behaviour, and it
means the API leg of a release build only gets exercised against `https://api.wi-mall.com`
once that host exists.

## Phase 8 — iOS

**Blocked: needs macOS.** `npx cap add ios` cannot run on this machine, so nothing in
this section was attempted in session 2. All app code stays platform-agnostic — the push
module branches on `isAndroid()` for its platform string and nothing else.

- [ ] `npx cap add ios` on a Mac or in CI
- [ ] `Info.plist`: `NSLocationWhenInUseUsageDescription` in the same plain language the
      Android permission uses
- [ ] Associated Domains entitlement + `apple-app-site-association` for the magic link
- [ ] Safe areas on a notched device — iOS is where `viewport-fit=cover` earns its keep
- [ ] Swipe-back gesture against the client router
- [ ] Confirm the origin is `capacitor://localhost` and it is in `ALLOWED_ORIGINS`

---

## Phase 9 — Release engineering

- [x] **One version source: `package.json`.** `build.gradle` reads it and derives
      `versionCode` as `major*10000 + minor*100 + patch`, because Play needs one
      always-increasing integer and semver is three. Verified in the release build's
      `output-metadata.json`: `0.1.0` → versionCode `100`. `CFBundleVersion` should read
      the same file when iOS is added.
- [x] **Signing from the environment** (`WI_MALL_KEYSTORE`, `_KEYSTORE_PASSWORD`,
      `_KEY_ALIAS`, `_KEY_PASSWORD`). When any is absent the release build is left
      **unsigned** rather than falling back to the debug key — a debug-signed "release"
      installs and runs, which is exactly what makes that fallback dangerous.
- [x] CI written: `.github/workflows/ci.yml` — typecheck, lint, web build, static export,
      `assembleRelease`, APK artifact. **Never run; expect to fix it on first push.** The
      backend's suites stay in its own repo rather than being copied here.
      Note `npm run build` is not hermetic: `/pricing` needs a reachable API, so CI wants
      a staging `NEXT_PUBLIC_API_URL`.
- [x] **The app wears its own mark.** It shipped with Capacitor's scaffolding artwork —
      a blue X on the launcher, and again on the splash the app holds up for as long as
      the session takes to restore. `scripts/gen-app-icons.mjs` now emits the Android
      rasters from `AppLogos/` alongside the web ones, so there is a single source and no
      hand-placed binaries: legacy + round launcher icons, the adaptive foreground, a
      `monochrome` layer for Android 13 themed icons, the notification stencil, and the
      splash mark.
- [x] **The splash is a layer-list, not eleven PNGs.** `drawable/splash.xml` is a colour
      layer plus a centre-gravity bitmap. That drawable is used two ways — the launch
      window's `android:background`, where it must be opaque and full-bleed, and an
      ImageView whose default scale type is FIT_XY — and a device-shaped PNG distorts the
      mark on any handset cut to a different aspect ratio. FIT_XY sets the drawable's
      *bounds* rather than a draw matrix, so the green stretches (invisibly, it is flat)
      while `android:gravity="center"` holds the mark at its intrinsic size. The
      per-density `splash_logo` is what fixes its physical size.
- [ ] Store listings, screenshots, descriptions
- [ ] Internal testing track before anything public

---

## Phase 10 — Ionic (later, and only then)

The seams are already in place: native access behind `src/lib/native/*`, UI behind the
sixteen primitives in `src/components/shop/ds/*` that every shop page imports through a
barrel. Swapping `Button`, `Tabs`, `BottomSheet` and `Select` for Ionic equivalents is a
change inside that folder.

Do not start this until the app has shipped and we know what actually feels wrong.
**Not started, deliberately** — session 2 left it alone for exactly this reason.

---

## Environment files

Modelled on the vendor dashboard, with one difference that had to be built rather than
configured: **Next has no `--mode`**. Vite picks `.env.mobile` from `--mode mobile`;
Next picks its file from `NODE_ENV` alone, and `next build` is always `production`. So
an app build would otherwise be indistinguishable from the website built from the same
source, with the same values.

`scripts/build-native.mjs` therefore reads `.env.mobile` itself and passes it to the
child build, where it outranks every `.env` Next loads on its own. Later wins:

| Command | Files, in order |
|---|---|
| `npm run dev` | `.env` -> `.env.development` -> `.env.local` |
| `npm run build` | `.env` -> `.env.production` -> `.env.local` |
| `npm run build:native` | `.env` -> `.env.production` -> `.env.local` -> **`.env.mobile`** |

Only `.env.example` is committed (`.gitignore`: `.env*` with `!.env.example`), and it is
the reference for every variable. The other three are per-machine.

**Why the app needs its own file at all.** `NEXT_PUBLIC_SITE_URL` has to be the REAL
site even in a development app build: the bundle is `/shop` plus the auth routes, and
everything else — Help & FAQ and the rest of the marketing site — opens through
`openExternal()` on a handset that cannot resolve `localhost`. `NATIVE_API_URL` is the
mirror image: an address the *phone* can reach, which the desktop browser cannot, which
is why it is not simply `NEXT_PUBLIC_API_URL`.

`APP_LOCALES` is the third of the same kind, and the one with the largest effect on what
gets shipped: it names the languages the app build writes trees for (`en,fr` today, which
is what makes the APK 10.34 MB instead of 20.3 MB). Unset, it is all five — so it can only
ever shrink an app build and can never touch the website. Phase 7 has the reasoning and the
numbers; `.env.example` has the usage.

Both `NATIVE_API_URL` and `APP_LOCALES` take `process.env` over the file, which is what lets a
one-off build differ without editing a per-machine config:

    NATIVE_API_URL=http://10.0.2.2:8022 npm run native:apk    # emulator, not the tailnet
    APP_LOCALES=en npm run build:native                        # what one locale costs

⚠ **`.env.production` names hosts that do not exist yet.** Neither `api.wi-mall.com` nor
`wi-mall.com` resolves as of 2026-08-22, and `npm run build` is not hermetic — `/pricing`
refuses to publish without real prices and the build fails outright. `.env.local`
therefore carries localhost overrides so the web build keeps working on this machine.
Delete them once the real hosts are live.

## Commands

```bash
npm run dev            # web dev server
npm run build          # web build — must stay green (needs the API up; /pricing
                       # refuses to publish without real prices)

npm run native:apk     # ⭐ export + cap sync + assembleDebug, prints the APK path
npm run dev:native     # dev server with the native flag set (browser, localhost:3000)
npm run build:native   # static export into out/, no APK
npm run native:sync    # build:native + cap sync
npm run native:android # sync + open Android Studio
npm run native:restore # if a build was killed and a route went missing
```

### A signed release build

```bash
set -a; . C:/Users/Fante/keystores/wi-mall/credentials.env; set +a
export WI_MALL_KEYSTORE=C:/Users/Fante/keystores/wi-mall/wi-mall-release.keystore
npm run native:sync
cd android && ./gradlew assembleRelease      # → app/build/outputs/apk/release/app-release.apk
```

Verify it is signed with the right key — an unsigned release still builds:

```bash
"$LOCALAPPDATA/Android/Sdk/build-tools/36.0.0/apksigner.bat" verify --print-certs <apk>
```

The digest it prints must match the fingerprint in `public/.well-known/assetlinks.json`.

### Getting the app onto a phone

```bash
npm run native:apk
```

The APK lands at `android/app/build/outputs/apk/debug/app-debug.apk` (~27 MB). Install it
either way:

- **Plugged in**, with USB debugging on:
  `adb install -r android/app/build/outputs/apk/debug/app-debug.apk`
- **Or** copy the file to the phone and open it (allow "install from unknown sources").

It is a **debug** build — installable but not store-signed. A release build needs the
keystore from Phase 5.

**The phone reaches the API over Tailscale.** This PC is `100.124.149.1`, which is set in
two places that must stay in step:

| Where | What it does |
|---|---|
| `.env.local` → `NATIVE_API_URL` | the URL the app calls |
| `android/app/src/debug/res/xml/network_security_config.xml` | permits the plain-HTTP call to it |

Both are already set. The API binds all interfaces, and the app's origin
(`https://localhost`) is already in the backend's `ALLOWED_ORIGINS`, so **nothing else
needs changing** — just make sure the backend is running and both devices are on the
tailnet.

> `NATIVE_API_URL` is deliberately not `NEXT_PUBLIC_API_URL`: a device address does not
> resolve from a desktop browser, so sharing the variable would break `npm run dev`.

**On the emulator, use `10.0.2.2` and not the tailnet.** `10.0.2.2` is the emulator's
alias for this machine's loopback, so the call never leaves the PC; the Tailscale address
routes out and back for no reason. `process.env` wins over `.env.mobile` in
`build-native.mjs`, so this needs no edit to a file set up for a physical phone:

```bash
NATIVE_API_URL=http://10.0.2.2:8022 npm run native:apk
```

Both addresses are already permitted in the debug network security config. Note the
release build has **no** cleartext permission by design, so a release APK cannot talk to
either — that is correct, and it means release testing needs the real https API.

If a build fails with `Can't resolve '@vercel/turbopack-next/internal/font/google/font'`,
that is `next/font` failing to fetch Google Fonts — flaky on this machine, which is what
the `turbopackUseSystemTlsCerts` experiment is for. **Retry before investigating.**

Backend, from `backend/jovi-mall`:

```bash
npm run test:messaging-login    # includes the bearer-twin invariants
npm run test:mobile-auth
npm run verify:messaging-login  # needs Mongo + Redis
```

---

## Gotchas already paid for

Each of these cost real time. Read before changing the build.

- **Capacitor cannot serve an extension-less path to its own file.**
  `WebViewLocalServer` sends every path whose last segment has no dot to the **root**
  `index.html` when `html5mode` is on (the default) — that is the single-entry-SPA
  assumption, and a Next static export is many HTML files, not one. Turning `html5mode`
  off is worse: those paths then match no branch and `return null`. So every full page
  load must target a path containing a dot, which is why the bootstrap emits
  `/index.html` and the layout strips it back off. **Anything that assigns
  `window.location.href` in the app is subject to this.**
- **Nothing may link outside `/shop/**` and the auth routes.** There is no server to 404
  a bad path, so an off-bundle `<Link>` is a dead tap. Use `homePath()` for "home" and
  `openExternal()` for anything on the marketing site. The cross-check in Phase 4.2 finds
  regressions.
- **`output: "export"` rejects a dynamic route that yields zero paths.** The check is
  `prerenderedRoutes.length > 0`, so declaring `generateStaticParams` and returning `[]`
  does *not* satisfy it — whatever the "is missing generateStaticParams()" message says.
  That is why the shop's dynamic segments are excluded from the app bundle and it uses
  query-string aliases instead.
- **`build-native.mjs` renames route *files*, not the folder.** A directory rename EPERMs
  on Windows whenever a dev server holds a watcher on it, which is always.
- **The native build needs `tsconfig.native.json`** (which drops the dev server's
  `.next/dev/types` include) **but must not set `distDir`** — that moves the export output
  out of `out/` and leaves `webDir` pointing at nothing.
- **Middleware under `output: "export"` is a warning, not an error.** `src/middleware.ts`
  stays in place for the web build; its two jobs are done client-side in the app.
- **The API prefers `Authorization: Bearer` over the cookie**, deliberately, so sending
  both is safe and a stale cookie cannot beat a fresh token.
- **A request with no deadline is a screen with no error.** The client had none, and the
  splash — which waits on the session — hung forever behind an unreachable API. Anything
  that gates UI on a request must assume the request may never settle. The 20s deadline in
  `send()` is the backstop; do not remove it to "fix" a slow endpoint.
- **`AbortSignal.timeout` throws `TimeoutError`, not `TypeError`.** `isNetworkError`
  keys on the rejection type, so a timeout has to be named explicitly or it degrades to
  "an unexpected error occurred". `AbortError` is deliberately *not* treated as an
  outage — that is a cancellation somebody asked for.
- **Groovy: a local variable shadows the DSL setter of the same name.** `def keyPassword`
  plus `keyPassword keyPassword` inside `signingConfigs` fails with
  `No signature of method: java.lang.String.call()`, because Groovy resolves the argument
  as a call on the variable. Prefix the locals (`keystoreKeyPassword`) — and note the
  error names the *line*, not the collision.
- **`… | tail` hides a Gradle failure.** The pipeline's exit code is `tail`'s, so a failed
  build reports success. Use `set -o pipefail` or check `${PIPESTATUS[0]}`; a "successful"
  build that produced no APK was this, twice.
- **Nothing that unblocks the UI may depend on the JavaScript bundle running.** The
  splash was pinned twice by this, the second time by a "failsafe" that was itself a
  `setTimeout` in the bundle. Anything that covers the screen needs an exit the bundle
  cannot take down — Android's own timer, or a CSS animation. See session 6.
- **The API-29 AVD cannot parse this app's JavaScript.** Its WebView is Chromium 74
  (2019) and every chunk dies on `?.` / `??`. It is still useful for the native layer,
  and useless above it. Launch it with `-gpu host` too, or the WebView never gets a GL
  surface and paints nothing.
- **Capacitor Preferences is not the WebView's storage.** It is `SharedPreferences`, and
  a plain page — the locale bootstrap in `out/index.html` — cannot see it. Anything the
  bootstrap must read has to be in `localStorage`.
- **Some source files are CRLF** (`useAuth.tsx`, `checkout/success/page.tsx`) and most are
  LF. Any scripted edit has to match the file's own line endings or its anchor silently
  finds nothing.
