#!/usr/bin/env node
/**
 * Builds the static bundle Capacitor wraps.
 *
 * Three jobs, in order:
 *
 *   1. Take the routes that do not ship in the app out of the routing tree.
 *   2. Run `next build` with NEXT_PUBLIC_APP_TARGET=native, which turns on
 *      `output: "export"` in next.config.ts.
 *   3. Write `out/index.html` — the bootstrap the WebView actually loads.
 *
 * Step 1 is the awkward one and it is worth saying why it is done by moving
 * files. `output: "export"` refuses to build a dynamic route that has no
 * `generateStaticParams()`, and the marketing tree has several: `[...rest]`,
 * `blog/[slug]`, `blog/category/[category]`, `cameroon/[city]`. Those routes
 * are not in the app's scope anyway — the bundle is `/shop/**` plus the auth
 * routes — so the fix and the requirement are the same thing. Next has no
 * config for excluding a subtree, but the App Router already ignores any folder
 * whose name starts with `_`, so a rename is all it takes.
 *
 * ── If this script is interrupted ────────────────────────────────────────────
 *
 * Everything it moves is restored in a `finally`, and `npm run native:restore`
 * puts things back if the process is killed outright. The moved names are
 * listed in MOVES below — nothing is guessed at restore time.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const APP_ROOT = join(ROOT, "src", "app");
const APP = join(APP_ROOT, "[locale]");

/**
 * Subtrees the app does not route to.
 *
 * ── `(marketing)` ────────────────────────────────────────────────────────────
 * Four dynamic routes with no `generateStaticParams` — `[...rest]`,
 * `blog/[slug]`, `blog/category/[category]`, `cameroon/[city]` — any one of
 * which fails an export build. It also holds the blog, which fetches its
 * articles from the CMS at build time and is written to throw rather than
 * publish an empty index: shipping it would make the app's build depend on a
 * content API being up.
 *
 * ── The shop's dynamic segments ──────────────────────────────────────────────
 * `output: "export"` writes one file per known path, and it treats a route that
 * yields *zero* paths as an error — the check is
 * `prerenderedRoutes.length > 0`, so declaring `generateStaticParams` and
 * returning `[]` does not satisfy it, whatever the message says:
 *
 *     Page "/[locale]/shop/stores/[storeSlug]" is missing
 *     "generateStaticParams()" so it cannot be used with "output: export"
 *
 * And the honest number of product paths to prerender is zero. The catalogue is
 * paginated, unbounded and changes without a rebuild, so baking it into an APK
 * ships a storefront that is stale from the moment it is signed.
 *
 * So the app does not use these routes at all. It addresses a product, a store
 * and an order group by query string — `/shop/p?id=…`, `/shop/store?s=…`,
 * `/shop/account/order?id=…` — which are ordinary static files that resolve
 * against the live API on open. `shop.routes.ts` picks the shape per target, so
 * no link, sitemap entry or JSON-LD block on the web changed.
 *
 * ── Bookings and support threads ─────────────────────────────────────────────
 * The same export error, and the reason the app build failed outright from the
 * day support tickets landed until these two lines were added:
 * `bookings/[bookingId]` — with `/pay`, `/balance` and `/reschedule` under it —
 * and `support/[ticketId]` are five dynamic routes that nobody listed here when
 * they were written.
 *
 * Dropping them from the app the way `(marketing)` is dropped was never an
 * option: a booking is a service somebody bought and has to pay for, and a
 * ticket is a problem they raised and are waiting on an answer to. Both are
 * things the app must be able to open. So they have query-string twins of their
 * own — `/shop/account/booking?id=…` and `/shop/account/ticket?id=…`, wired up
 * in `components/shop/account/QueryScreens.tsx` — and it is only the nested
 * spellings that are left out here.
 */
const EXCLUDED_TREES = [
  join(APP, "(marketing)"),
  join(APP, "shop", "stores"),
  join(APP, "shop", "p", "[productId]"),
  join(APP, "shop", "account", "orders", "[cartId]"),
  join(APP, "shop", "account", "bookings", "[bookingId]"),
  join(APP, "shop", "account", "support", "[ticketId]"),
];

/**
 * Individually excluded files.
 *
 * The three metadata routes are the SEO surface, and they are addressed to
 * crawlers that will never see a phone. `sitemap.ts` also walks the entire
 * catalogue at build time, so it would make the app build depend on the shop
 * API — and it refuses to run under `output: "export"` at all without a
 * `dynamic`/`revalidate` export, which is the error that found them:
 *
 *     export const dynamic = "force-static" not configured on route
 *     "/sitemap.xml" with "output: export"
 *
 * Adding that export to satisfy the app build would change how the *web* build
 * generates its sitemap. Leaving them out of the app instead changes nothing
 * for anybody.
 *
 * `manifest.ts` is the install manifest for the PWA. The app is installed from
 * a store and has `capacitor.config.ts` instead.
 */
const EXCLUDED_FILES = [
  join(APP, "page.tsx"),
  join(APP_ROOT, "sitemap.ts"),
  join(APP_ROOT, "robots.ts"),
  join(APP_ROOT, "manifest.ts"),
];

/**
 * The file names the App Router treats as routing instructions. Prefixing one
 * with `_` leaves the file in place and makes it an ordinary module the router
 * ignores — which is the whole exclusion mechanism.
 */
const ROUTE_FILES = new Set([
  "page.tsx", "page.ts", "page.jsx", "page.js",
  "layout.tsx", "layout.ts", "layout.jsx", "layout.js",
  "route.ts", "route.tsx", "route.js",
  "template.tsx", "loading.tsx", "error.tsx", "global-error.tsx",
  "not-found.tsx", "default.tsx", "forbidden.tsx", "unauthorized.tsx",
]);

/**
 * ── Why files, and not the folder ────────────────────────────────────────────
 *
 * Renaming `(marketing)` to `_marketing` would be one operation instead of
 * thirty, and the App Router would ignore the whole subtree. It also fails with
 * EPERM on Windows whenever a `next dev` server is running: its file watcher
 * holds a handle on the directory, and Windows will not rename a directory that
 * is open. A developer running the app build while their dev server is up is
 * the normal case, not the exception, so the build works around it rather than
 * demanding they stop.
 *
 * Individual files have no such handle held on them, so this is renaming every
 * route file under the tree instead.
 */
function collectRouteFiles(root) {
  if (!existsSync(root)) return [];

  const found = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) found.push(...collectRouteFiles(full));
    else if (ROUTE_FILES.has(entry.name)) found.push(full);
  }
  return found;
}

/** Every `[from, to]` pair this build will apply, resolved fresh each run. */
function plannedMoves() {
  const files = [...EXCLUDED_TREES.flatMap(collectRouteFiles), ...EXCLUDED_FILES];

  return files
    .filter((file) => existsSync(file))
    .map((file) => [file, join(dirname(file), `_${basename(file)}`)]);
}

/** Every `_`-prefixed route file left behind, so a restore needs no bookkeeping. */
function collectExcludedFiles(root) {
  if (!existsSync(root)) return [];

  const found = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const full = join(root, entry.name);
    if (entry.isDirectory()) found.push(...collectExcludedFiles(full));
    else if (entry.name.startsWith("_") && ROUTE_FILES.has(entry.name.slice(1))) found.push(full);
  }
  return found;
}

/** The five locales, mirrored from src/i18n/routing.ts. */
const LOCALES = ["en", "fr", "pt", "es", "ar"];
const DEFAULT_LOCALE = "en";

/**
 * The subset of those five that THIS app build writes a tree for.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * A static export writes a complete HTML + RSC tree per locale, and all of them
 * go into the APK. Measured: ~11 MB each in `out/`, ~3.2 MB each compressed in
 * the APK, so five languages were ~16 MB of a 20 MB download for a shopper who
 * reads one of them. `APP_LOCALES` in `.env.mobile` names the ones to ship.
 *
 * ── This is a MIRROR of `parseShippedLocales()` in src/i18n/routing.ts ────────
 *
 * The two cannot be shared: this runs in a plain Node process before the build,
 * that one is compiled into the bundle. They must not drift, because the failure
 * is silent and only visible on a device — the bootstrap below would redirect a
 * cold start to a locale the export never wrote, and Capacitor has no server to
 * 404 it, so the app would open on a blank screen. Same parsing rules on both
 * sides: unknown codes dropped, canonical order kept, empty falls back to all.
 */
function shippedLocales() {
  const raw = (
    process.env.APP_LOCALES ??
    readEnvFile(".env.mobile").APP_LOCALES ??
    readEnvFile(".env.local").APP_LOCALES
  )?.trim();
  if (!raw) return LOCALES;

  const named = new Set(raw.split(",").map((code) => code.trim().toLowerCase()));
  const shipped = LOCALES.filter((code) => named.has(code));
  return shipped.length > 0 ? shipped : LOCALES;
}

/**
 * `APP_LOCALES` forwarded under the name the bundle reads.
 *
 * Its own reader rather than a line in `mobileEnv()`, for the same reason
 * `NATIVE_API_URL` has one: the variable is named for what it configures, and
 * the `NEXT_PUBLIC_` name it arrives under is an implementation detail of how
 * Next inlines it. Only forwarded when it actually narrows the set, so an
 * ordinary build passes nothing and `routing.ts` keeps its own default.
 */
function appLocales() {
  const shipped = shippedLocales();
  if (shipped.length === LOCALES.length) return {};

  console.log(`[build-native] languages in this build: ${shipped.join(", ")} (of ${LOCALES.length})`);
  return { NEXT_PUBLIC_APP_LOCALES: shipped.join(",") };
}

/**
 * What the WebView loads first — and the app's fallback router.
 *
 * ── The rule that shapes this entire file ────────────────────────────────────
 *
 * Capacitor's local server (`WebViewLocalServer.handleLocalRequest`) resolves a
 * request like this:
 *
 *     if (path.equals("/") || (!lastPathSegment.contains(".") && html5mode))
 *         → serve basePath + "/index.html"      ← the ROOT index.html, always
 *     ...
 *     if (path.lastIndexOf(".") >= 0)
 *         → serve the file at that path
 *     return null;                              ← nothing at all
 *
 * `html5mode` defaults to true, and it exists for single-entry SPAs where every
 * URL should load the one HTML file and a client router sorts it out. A Next
 * static export is not that: it is many HTML files, one per route.
 *
 * The consequence is exact and was verified on a device — **an extension-less
 * path NEVER reaches its own file.** `/en/shop/` has a last segment of `shop`
 * with no dot, so it serves the root `index.html`, which is this bootstrap.
 * Redirecting from here to `/en/shop/` therefore served this bootstrap again,
 * forever:
 *
 *     D Capacitor: Handling local request: https://localhost/en/shop/
 *     D Capacitor: Handling local request: https://localhost/en/shop/
 *     …dozens per second, and a screen that never painted.
 *
 * Turning `html5mode` off does not help: extension-less paths then fall past
 * every branch and `return null`, which is a hard failure instead of a loop.
 *
 * ── So every destination this emits ends in `/index.html` ────────────────────
 *
 * That is a path whose last segment contains a dot, so the server serves the
 * real file and this bootstrap is not re-entered. `trailingSlash: true` in
 * next.config.ts is what guarantees the file is there to serve.
 *
 * Keeping `html5mode` on then turns this file into a graceful fallback rather
 * than a trap: any extension-less URL the app ends up at — a reload after a
 * client-side navigation, a cold-start deep link, a stale saved URL — lands
 * here and is mapped to the file that serves it. The app is put back where the
 * URL said, instead of failing.
 *
 * `src/app/[locale]/layout.tsx` strips the `/index.html` again with
 * `history.replaceState` before Next hydrates, so the router and `usePathname`
 * only ever see clean paths.
 *
 * ── Picking the language ─────────────────────────────────────────────────────
 *
 * Only on a bare `/`, and only from the locales this build actually shipped —
 * `SUPPORTED` below is `shippedLocales()`, not all five. A device set to
 * Portuguese on an en+fr build must fall through to the default rather than be
 * sent to `/pt/shop/index.html`, which the export never wrote and which
 * Capacitor has no server to 404: the app would simply open on nothing.
 *
 * The stored key is written by `setLocale()` in `src/lib/i18n-provider.tsx`,
 * deliberately into `localStorage` and not Capacitor Preferences — Preferences
 * is `SharedPreferences` on Android and is NOT visible to a plain page like this
 * one, which runs before any plugin is loaded. On a first launch nothing is
 * stored, so the chain falls through to what the OS reports.
 *
 * `location.replace` rather than `href` throughout: the bootstrap must not
 * become a back destination, or the hardware back button would land here and
 * bounce straight forward again.
 */
function bootstrapHtml() {
  const shipped = shippedLocales();
  const locales = JSON.stringify(shipped);
  // next-intl's default has to be one this build routes; same rule as
  // BUILD_DEFAULT_LOCALE in routing.ts, and the same answer whenever en ships.
  const fallback = shipped.includes(DEFAULT_LOCALE) ? DEFAULT_LOCALE : shipped[0];
  return `<!doctype html>
<html lang="${fallback}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Wi-Mall</title>
<style>html,body{margin:0;height:100%;background:#068554}</style>
</head>
<body>
<script>
(function () {
  var SUPPORTED = ${locales};
  var path = location.pathname || "/";
  var tail = location.search + location.hash;

  // Already a file. Only reachable if something linked here by mistake — going
  // on to append another "/index.html" is the one way to build a loop.
  if (/\\.[^/]+$/.test(path)) return;

  if (path === "/") {
    var stored = null;
    try { stored = localStorage.getItem("wi-mall-locale"); } catch (e) {}
    var device = (navigator.language || "").slice(0, 2).toLowerCase();
    var locale = SUPPORTED.indexOf(stored) > -1 ? stored
               : SUPPORTED.indexOf(device) > -1 ? device
               : "${fallback}";
    location.replace("/" + locale + "/shop/index.html" + tail);
    return;
  }

  // Any other extension-less path: serve the file that backs it.
  location.replace(path + (path.charAt(path.length - 1) === "/" ? "" : "/") + "index.html" + tail);
})();
</script>
</body>
</html>
`;
}

/**
 * The API origin the *app* talks to, when it differs from the web's.
 *
 * They almost always differ in development, and the reason is not a preference:
 * `NEXT_PUBLIC_API_URL` defaults to `http://localhost:8022`, and on a handset
 * `localhost` is the handset. A device needs the workstation's LAN address and
 * the standard emulator needs `10.0.2.2`, neither of which resolves from a
 * desktop browser — so putting either in `.env.local` would point `npm run dev`
 * at an address it cannot reach, and the web dev server would break every time
 * somebody set up the app.
 *
 * So the app build reads `NATIVE_API_URL` instead and passes it through as
 * `NEXT_PUBLIC_API_URL` for this build only. Unset, nothing changes and both
 * targets use the same origin — which is what production wants.
 */
function nativeApiUrl() {
  const url = (
    process.env.NATIVE_API_URL ??
    readEnvFile(".env.mobile").NATIVE_API_URL ??
    readEnvFile(".env.local").NATIVE_API_URL
  )?.trim();
  if (!url) return {};

  console.log(`[build-native] API origin for this build: ${url}`);
  return { NEXT_PUBLIC_API_URL: url };
}

/**
 * The app build's own environment file — the "mode" Next does not have.
 *
 * The Vite dashboards get this for free: `vite build --mode mobile` loads
 * `.env.mobile`. Next has no equivalent — it picks its file from `NODE_ENV`
 * alone, and `next build` is always `production` — so a build meant for a
 * handset would otherwise be indistinguishable from the one that builds the
 * website: same source, same values.
 *
 * They are not the same. `NEXT_PUBLIC_SITE_URL` has to be the real site even in
 * a development app build, because `openExternal()` opens it on a device that
 * cannot resolve `localhost`. So this file is read here and passed to the child
 * process, where it outranks every `.env` Next loads on its own.
 *
 * Only `NEXT_PUBLIC_*` keys are forwarded. `NATIVE_API_URL` is deliberately not
 * among them — `nativeApiUrl()` reads it separately and forwards it under the
 * name the client actually reads.
 */
function mobileEnv() {
  const entries = Object.entries(readEnvFile(".env.mobile")).filter(([key]) =>
    key.startsWith("NEXT_PUBLIC_")
  );
  if (entries.length === 0) return {};

  console.log(`[build-native] .env.mobile: ${entries.map(([k]) => k).join(", ")}`);
  return Object.fromEntries(entries);
}

/**
 * Parse a `.env` file into a plain object. Missing file → `{}`.
 *
 * Node does not load `.env` files on its own, and Next's own loader runs inside
 * the child process — too late to decide what that process should see, and only
 * useful for `NEXT_PUBLIC_*` anyway, which `NATIVE_API_URL` deliberately is not.
 * So this script does its own reading.
 *
 * Not a general dotenv implementation, and it should not become one: no `export`
 * prefixes, no multi-line values, no interpolation. These files configure one
 * build, and every feature added here is another way for a `.env` to change a
 * build in a way nobody reading it expected.
 */
function readEnvFile(name) {
  let contents;
  try {
    contents = readFileSync(join(ROOT, name), "utf8");
  } catch {
    return {};
  }

  const out = {};
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue; // comments and blanks

    let value = match[2].trim();

    // A quoted value keeps any "#" inside it — stripping a trailing comment
    // there would corrupt URLs with fragments and keys that contain one.
    const q = value[0];
    const quoted = value.length >= 2 && (q === '"' || q === "'") && value.endsWith(q);
    value = quoted ? value.slice(1, -1) : value.replace(/\s+#.*$/, "").trim();

    out[match[1]] = value;
  }
  return out;
}

function applyMoves(pairs) {
  for (const [from, to] of pairs) {
    if (!existsSync(from)) continue;
    try {
      renameSync(from, to);
    } catch (err) {
      // Undo whatever already moved, so a failure never leaves the routing tree
      // half-excluded, then say what to do about it.
      restore();
      throw new Error(
        `Could not set ${from} aside for the app build (${err.code ?? err.message}).\n` +
          `Something is holding the file open — usually an editor mid-save. ` +
          `Nothing was left moved; try again, and run "npm run native:restore" ` +
          `if a route ever goes missing.`
      );
    }
  }
  return pairs.length;
}

/**
 * Put every excluded route file back.
 *
 * Scans for the `_`-prefixed names rather than replaying a list, so it works
 * after a process was killed outright and has nothing in memory to replay.
 */
function restore() {
  const excluded = [
    ...EXCLUDED_TREES.flatMap(collectExcludedFiles),
    ...EXCLUDED_FILES.map((file) => join(dirname(file), `_${basename(file)}`)),
  ];

  let restored = 0;
  for (const file of excluded) {
    const original = join(dirname(file), basename(file).slice(1));
    if (existsSync(file) && !existsSync(original)) {
      renameSync(file, original);
      restored += 1;
    }
  }
  return restored;
}

if (process.argv.includes("--restore")) {
  console.log(`[build-native] restored ${restore()} route file(s)`);
  process.exit(0);
}

/**
 * `--apk` — everything from a source tree to a file you can sideload.
 *
 * Exists because the three steps have to happen in order and skipping the
 * middle one is silent: `cap sync` is what copies `out/` into the Android
 * project, so building the APK without it ships whatever web assets were there
 * last time. That failure looks like "my change did nothing", which is a bad
 * hour to spend.
 *
 * Debug, not release — unsigned-for-store but installable, which is what
 * testing on your own phone needs. A release build needs the keystore from
 * Phase 5 of MOBILE-APP-PLAN.md.
 */
if (process.argv.includes("--apk")) {
  const run = (cmd, args, cwd) =>
    execFileSync(cmd, args, { cwd, stdio: "inherit", shell: process.platform === "win32" });

  buildExport();

  console.log("\n[build-native] syncing web assets into the Android project…");
  run("npx", ["cap", "sync", "android"], ROOT);

  console.log("\n[build-native] assembling the debug APK…");
  const android = join(ROOT, "android");
  /**
   * The wrapper is a shell script on Unix and a `.bat` on Windows, and neither
   * name works on the other platform.
   *
   * It must be an explicitly-relative path on both. `cmd.exe` does not resolve
   * a bare `gradlew.bat` from the working directory the way it resolves one
   * from PATH, so the unprefixed name fails with "is not recognized as an
   * internal or external command" — which, piped, looks like nothing happening
   * at all.
   */
  run(process.platform === "win32" ? ".\\gradlew.bat" : "./gradlew", ["assembleDebug"], android);

  const apk = join(android, "app", "build", "outputs", "apk", "debug", "app-debug.apk");

  // Prove the build actually produced something, rather than trusting an exit
  // code. This step is run through a shell, and a piped invocation reports the
  // LAST command's status — so a gradle failure can be masked by whatever the
  // output was piped into. A stale APK looks exactly like a fresh one.
  if (!existsSync(apk)) {
    throw new Error(`gradle reported success but ${apk} does not exist.`);
  }
  console.log(`\n[build-native] APK ready:\n  ${apk}\n`);
  console.log("Install it with either:");
  console.log("  adb install -r <path>            (phone plugged in, USB debugging on)");
  console.log("  …or copy the file to the phone and open it\n");
  process.exit(0);
}

/**
 * `--dev` runs the ordinary dev server with the native flag set, so the app's
 * auth path, route shape and locale prefixing can be exercised in a desktop
 * browser at localhost:3000.
 *
 * It deliberately does **not** move any files. A dev server runs for hours and
 * is killed abruptly; a crash mid-session would leave the routing tree renamed.
 * The cost is that the marketing routes are still reachable in `dev:native`
 * even though they are absent from the built app — a difference worth knowing
 * about, and much cheaper than a repository in a half-moved state.
 */
if (process.argv.includes("--dev")) {
  execFileSync("npx", ["next", "dev"], {
    cwd: ROOT,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, NEXT_PUBLIC_APP_TARGET: "native" },
  });
  process.exit(0);
}

/**
 * The static export, with the excluded routes set aside for the duration.
 *
 * A function rather than the bottom of the file because `--apk` needs it too,
 * and the `finally` is the whole point: a build that throws must still put the
 * routing tree back before anything else runs.
 */
function buildExport() {
  try {
    const excluded = applyMoves(plannedMoves());
    console.log(`[build-native] excluded ${excluded} route file(s) from the app bundle`);

    execFileSync("npx", ["next", "build"], {
      cwd: ROOT,
      stdio: "inherit",
      shell: process.platform === "win32",
      env: {
        ...process.env,
        NEXT_PUBLIC_APP_TARGET: "native",
        // `.env.mobile` last: it is the app build's own configuration and has to
        // outrank the `.env.production` Next loads inside this child.
        ...mobileEnv(),
        ...nativeApiUrl(),
        ...appLocales(),
      },
    });

    const out = join(ROOT, "out");
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, "index.html"), bootstrapHtml(), "utf8");
    console.log("[build-native] wrote out/index.html (locale bootstrap)");
  } finally {
    console.log(`[build-native] restored ${restore()} route file(s)`);
  }
}

buildExport();
