#!/usr/bin/env node
/**
 * The localisation gate for the `/shop`, `(auth)` and `/pay` trees.
 *
 *     node scripts/check-i18n.mjs            # the gate
 *     node scripts/check-i18n.mjs --verbose  # with the offending strings
 *     npm run check:i18n                     # the same thing, for CI
 *
 * Two independent questions, answered in one run:
 *
 *   1. **Are the five catalogues in step?** Every key in `messages/en.json` must
 *      exist in fr, es, pt and ar — and no locale may carry a key `en.json` does
 *      not. A key present in one language and missing in another is a
 *      `MISSING_MESSAGE` crash in next-intl, not a cosmetic gap.
 *
 *   2. **Is there hardcoded English left in the shop, auth or pay trees?** A
 *      per-file count, a total, and a percentage against the Phase 1 baseline.
 *
 * Exit code: non-zero if EITHER question answers badly.
 *
 * ── What changed in Phase 10 ─────────────────────────────────────────────────
 *
 * Through phases 1–9 the hardcoded-string half was a progress report that never
 * failed the run: the tree was still being converted, and a build that broke
 * because a regex miscounted a `<` would have been worse than useless. Phase 10
 * finished the conversion, so it is now a gate — together with the `errors.*`
 * exemption, which is gone because pt and ar are backfilled.
 *
 * The scanner is still a regex pass rather than a parser, so the ALLOWLIST below
 * is what keeps it honest: the handful of English strings that are deliberately
 * English are named there one by one, with the reason. See LOCALISATION.md §11.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

/** en is the source of truth; the rest are checked against it. */
const SOURCE_LOCALE = "en";
const LOCALES = ["en", "fr", "es", "pt", "ar"];

/**
 * Namespaces whose gaps are known, tracked elsewhere and not this gate's
 * business. Reported, never fatal.
 *
 * **Empty, and it must stay empty.** It held `errors.` from Phase 1 to Phase 9,
 * because the backend error-code catalogue had never been translated into pt or
 * ar and the project had bigger problems first. Phase 10 translated all 161/163
 * of them. Putting a prefix back here is how a language silently stops being
 * shipped — if a namespace is genuinely not ready, that is a reason to not merge
 * it, not a reason to stop checking it.
 */
const KNOWN_GAP_PREFIXES = [];

/**
 * The Phase 1 measurement, frozen so later phases can see movement.
 *
 * 625 hardcoded strings across 94 files, counted by the scanner below over the
 * SHOP tree — `SCAN_DIRS.shop`, the only tree phases 1–9 were measuring. Phase
 * 10 added the auth and pay trees to the scan, so the percentage is still
 * reported against the shop tree alone and means what it always meant.
 *
 * Do not "refresh" these numbers.
 */
const BASELINE_STRINGS = 625;
const BASELINE_FILES = 94;

/**
 * Every tree that must be fully localised, grouped so the report can say which
 * one regressed. Phases 1–10 do not touch the marketing site.
 */
const SCAN_DIRS = {
  shop: [
    join("src", "app", "[locale]", "shop"),
    join("src", "components", "shop"),
    join("src", "lib", "shop"),
  ],
  auth: [
    join("src", "app", "[locale]", "(auth)"),
    join("src", "components", "auth"),
    join("src", "lib", "auth"),
  ],
  pay: [
    join("src", "app", "[locale]", "pay"),
    join("src", "components", "pay"),
  ],
};

/**
 * ── The allowlist ───────────────────────────────────────────────────────────
 *
 * English that is deliberately English. Each entry names the file, the reason,
 * and **the exact strings** — not the file. A blanket file skip would mean the
 * next person to add real copy to `catalog.api.ts` gets a green run; listing the
 * strings means only these strings are forgiven and anything new still fails.
 *
 * Adding an entry is a decision that belongs in LOCALISATION.md §11 as well as
 * here. The bar is: no shopper can ever see this string, or it is a proper noun
 * that is identical in all five languages.
 */
const ALLOWLIST = [
  {
    file: "src/lib/shop/catalog.api.ts",
    reason:
      "CatalogApiError's message is a BUILD-TIME diagnostic: it is thrown when the " +
      "catalogue API is unreachable during `next build`, and it is read by a developer " +
      "in a build log. No shopper is ever rendered it. Phase 1 left it in English " +
      "deliberately — LOCALISATION.md §11.",
    strings: ["network error"],
  },
  {
    file: "src/components/shop/ShopHeader.tsx",
    reason:
      "The Wi-Mall wordmark. A brand name is not copy — it is the same five letters in " +
      "every language, and the hyphen is load-bearing (wi-mall.com). The scanner sees " +
      "the `Mall` half because the name is split to colour it.",
    strings: ["Mall"],
  },
];

/**
 * Two further strings are deliberately English and are recorded in
 * LOCALISATION.md §11 rather than here, because this scanner does not flag them
 * and an allowlist entry that never matches is dead weight that rots:
 *
 *   - `lib/errors/is-network-error.ts` — `OfflineError`'s default constructor
 *     message, a developer diagnostic that never reaches a screen.
 *   - `lib/auth/error-translator.ts` — the last rung of the fallback ladder,
 *     reached only when `t("UNKNOWN_ERROR")` itself throws, i.e. when the
 *     catalogue failed to load. There is no locale to translate into then.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Part 1 — catalogue parity
 * ──────────────────────────────────────────────────────────────────────────── */

/** Every leaf, as a dotted path. `{a:{b:"x"}}` → `["a.b"]`. */
function flattenKeys(value, prefix = "", out = []) {
  for (const [key, child] of Object.entries(value)) {
    const path = prefix ? `${prefix}.${key}` : key;
    // An empty object is a scaffolded namespace waiting for its phase. It has no
    // leaves, so it contributes no keys — which is exactly right: a namespace
    // fr has and ar does not is not drift until something is written into it.
    if (child !== null && typeof child === "object" && !Array.isArray(child)) {
      flattenKeys(child, path, out);
    } else {
      out.push(path);
    }
  }
  return out;
}

function isKnownGap(key) {
  return KNOWN_GAP_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function loadCatalogue(locale) {
  const path = join(ROOT, "messages", `${locale}.json`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    console.error(`✗ messages/${locale}.json could not be read: ${err.message}`);
    process.exit(2);
  }
}

function checkCatalogues() {
  const catalogues = Object.fromEntries(LOCALES.map((l) => [l, loadCatalogue(l)]));
  const sourceKeys = flattenKeys(catalogues[SOURCE_LOCALE]);
  const sourceSet = new Set(sourceKeys);

  console.log("── Catalogue parity ──────────────────────────────────────────");
  console.log(`   ${SOURCE_LOCALE}.json: ${sourceKeys.length} keys (the reference)\n`);

  let drift = false;

  for (const locale of LOCALES.filter((l) => l !== SOURCE_LOCALE)) {
    const keys = flattenKeys(catalogues[locale]);
    const set = new Set(keys);

    // Missing: in en, absent here. This is the crash-causing direction.
    const missing = sourceKeys.filter((k) => !set.has(k));
    // Extra: here, absent in en. Not a crash, but it means en is behind, and a
    // string no other language can be checked against is a string nobody owns.
    const extra = keys.filter((k) => !sourceSet.has(k));

    const missingReal = missing.filter((k) => !isKnownGap(k));
    const missingKnown = missing.filter(isKnownGap);
    const extraReal = extra.filter((k) => !isKnownGap(k));

    if (missingReal.length === 0 && extraReal.length === 0) {
      const note = missingKnown.length ? `  (+${missingKnown.length} known gap)` : "";
      console.log(`   ✓ ${locale}.json  ${keys.length} keys — at parity${note}`);
      continue;
    }

    drift = true;
    console.log(`   ✗ ${locale}.json  ${keys.length} keys`);
    if (missingReal.length) {
      console.log(`       ${missingReal.length} key(s) in ${SOURCE_LOCALE}.json missing here:`);
      for (const key of missingReal) console.log(`         − ${key}`);
    }
    if (extraReal.length) {
      console.log(`       ${extraReal.length} key(s) here but not in ${SOURCE_LOCALE}.json:`);
      for (const key of extraReal) console.log(`         + ${key}`);
    }
    if (missingKnown.length) {
      console.log(`       (${missingKnown.length} further keys — known gap, not counted)`);
    }
  }

  // The known gap gets its own line so nobody mistakes silence for parity.
  const gapSummary = LOCALES.filter((l) => l !== SOURCE_LOCALE)
    .map((locale) => {
      const set = new Set(flattenKeys(catalogues[locale]));
      const n = sourceKeys.filter((k) => isKnownGap(k) && !set.has(k)).length;
      return n ? `${locale} −${n}` : null;
    })
    .filter(Boolean);

  console.log("");
  if (gapSummary.length) {
    console.log(`   ℹ Known gap: ${gapSummary.join(", ")}. This does not fail the run.`);
  } else {
    console.log("   ℹ No exempt namespaces — every key is held to strict parity.");
  }

  return drift;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Part 2 — hardcoded string scan
 *
 * A regex pass, not a parser. It is deliberately conservative: it would rather
 * miss a string than invent one, because a false positive here now fails a
 * build. The ALLOWLIST above carries the known-good exceptions.
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Props that carry copy a shopper reads. Anything not on this list is treated as
 * machine data — `href`, `name`, `id`, `className`, `icon`, `value`, `type`.
 */
const COPY_PROPS = [
  "label",
  "title",
  "placeholder",
  "aria-label",
  "description",
  "confirmLabel",
  "cancelLabel",
  "actionLabel",
  "emptyText",
  "message",
  "hint",
  "headline",
  "errorFallback",
];

/**
 * Blank out everything that is not code a user can read, replacing it with
 * same-length whitespace so line numbers survive.
 *
 * Comments go first and go completely: this repository comments heavily, in
 * full English prose, and a scanner that counted comment text would report
 * hundreds of strings that no shopper will ever see.
 */
function stripNonCode(source) {
  const blank = (m) => m.replace(/[^\n]/g, " ");
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blank) // block comments, incl. JSDoc
    .replace(/(^|[^:\\])\/\/[^\n]*/g, (m, lead) => lead + blank(m.slice(lead.length))) // line comments
    .replace(/className\s*=\s*(?:"[^"]*"|'[^']*'|\{`[^`]*`\})/g, blank) // Tailwind soup
    .replace(/\bimport\s[^;]*?from\s*["'][^"']*["']/g, blank) // import specifiers
    .replace(/\bfrom\s*["'][^"']*["']/g, blank)
    // `console.*("…")` is a developer diagnostic by construction — it goes to a
    // devtools console, never to a screen. Counting it would push every file
    // that logs a warning into the report.
    .replace(/\bconsole\.\w+\s*\([^)]*\)/g, blank);
}

/**
 * Is this string something a person reads, rather than a key, slug or URL?
 *
 * The rules, in the order they matter:
 *   - must contain a letter, and at least one lowercase one (`ALLCAPS` values
 *     are enum members and typed-confirmation constants, not copy);
 *   - must not be a URL, a path, a dotted i18n key or a kebab/snake slug;
 *   - must be more than one character.
 */
function isUserVisible(text) {
  const s = text.trim();
  if (s.length < 2) return false;
  if (!/[A-Za-z]/.test(s)) return false; // numbers, punctuation, entities
  if (!/[a-z]/.test(s)) return false; // ALLCAPS enum / constant
  if (/^(https?:|mailto:|tel:|\/|\.\/|#|@)/.test(s)) return false; // URLs and paths
  if (/^[a-z0-9]+([-_.][a-z0-9]+)+$/i.test(s)) return false; // slug, snake, dotted key
  if (/^[a-z][A-Za-z0-9]*$/.test(s) && !/\s/.test(s)) return false; // lone camelCase identifier
  return true;
}

/**
 * JSX text nodes — the `Hello` in `<span>Hello</span>`.
 *
 * Anchored on a CLOSING tag (`</`) rather than any `<`, which is what keeps a
 * comparison like `a > b < c` out of the count: that has no closing tag after
 * it. The cost is missing `>text<Icon/>`, which is rare and worth losing.
 *
 * `{…}` expressions inside the node are cut out and the surrounding text is
 * still counted, because `<p>You have {n} items</p>` is two hardcoded fragments
 * and — per LOCALISATION.md §4 — the wrong fix for it. Word order moves between
 * languages, so it has to become one `t("key", { n })`, not two translated
 * halves glued around a number. A scanner that skipped it would report the
 * hardest strings in the tree as already done.
 */
function findJsxText(code) {
  const hits = [];
  // Allow one level of `{…}` inside the node so interpolated copy is reached.
  for (const m of code.matchAll(/>((?:[^<>{}]|\{[^{}]*\})+?)<\//g)) {
    // Each expression becomes a separator: the text on either side of it is a
    // node of its own, and each is counted separately.
    for (const fragment of m[1].split(/\{[^{}]*\}/)) {
      const text = fragment.trim();
      if (isUserVisible(text)) hits.push(text.replace(/\s+/g, " "));
    }
  }
  return hits;
}

/**
 * Copy-bearing props, in the four shapes this codebase writes them:
 *
 *     title="No order to show"          JSX attribute
 *     title={"No order to show"}        JSX attribute, braced
 *     label: "Pending",                 object literal (the lib label maps)
 *     ownedRolesLabel = "Owned"         default parameter value
 *
 * The object-literal form is included on purpose. It is how `order-status.ts`
 * and friends carried English before Phase 1 converted them to `labelKey`, so
 * counting it is what makes that conversion visible in this number.
 */
function findCopyProps(code) {
  const hits = [];
  const names = COPY_PROPS.map((p) => p.replace(/[-]/g, "\\-")).join("|");

  // JSX attribute: prop="…" or prop={"…"} — and the `prop = "…"` default too.
  const attr = new RegExp(`\\b(?:${names})\\s*=\\s*\\{?\\s*(["'])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`, "gi");
  for (const m of code.matchAll(attr)) {
    if (isUserVisible(m[2])) hits.push(m[2]);
  }

  // Object literal: prop: "…"
  const obj = new RegExp(`\\b(?:${names})\\s*:\\s*(["'])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`, "gi");
  for (const m of code.matchAll(obj)) {
    if (isUserVisible(m[2])) hits.push(m[2]);
  }

  return hits;
}

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // a directory that does not exist in this checkout
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full);
  }
  return out;
}

/** The allowlist, indexed by the repo-relative path the report prints. */
const ALLOWED = new Map(ALLOWLIST.map((e) => [e.file, e]));

/**
 * Every `file::string` pair that actually matched something this run.
 *
 * An allowlist is a list of exceptions, and exceptions rot: the file gets
 * rewritten, the string changes, and the entry sits there forgiving nothing
 * while reading as though it still means something. So a pair that never
 * matched is reported — not fatal, because a dead entry is untidy rather than
 * unsafe, but loud enough that it gets deleted.
 */
const ALLOWLIST_USED = new Set();

function scanTree(dirs) {
  const results = [];
  let total = 0;
  let forgiven = 0;

  for (const dir of dirs) {
    for (const file of walk(join(ROOT, dir))) {
      const rel = relative(ROOT, file).split(sep).join("/");
      const code = stripNonCode(readFileSync(file, "utf8"));
      const allow = ALLOWED.get(rel);

      const hits = [];
      for (const hit of [...findJsxText(code), ...findCopyProps(code)]) {
        // Exact-string forgiveness, not file-level. A new string in an
        // allowlisted file still fails the run.
        if (allow?.strings.includes(hit)) {
          ALLOWLIST_USED.add(`${rel}::${hit}`);
          forgiven++;
          continue;
        }
        hits.push(hit);
      }

      if (hits.length === 0) continue;
      results.push({ file: rel, count: hits.length, hits });
      total += hits.length;
    }
  }

  results.sort((a, b) => b.count - a.count || a.file.localeCompare(b.file));
  return { results, total, forgiven };
}

function scanTrees() {
  const verbose = process.argv.includes("--verbose");
  console.log("\n── Hardcoded strings ─────────────────────────────────────────\n");

  let grandTotal = 0;
  let grandForgiven = 0;
  let shopTotal = 0;
  let shopFiles = 0;

  for (const [tree, dirs] of Object.entries(SCAN_DIRS)) {
    const { results, total, forgiven } = scanTree(dirs);
    grandTotal += total;
    grandForgiven += forgiven;
    if (tree === "shop") {
      shopTotal = total;
      shopFiles = results.length;
    }

    const allowNote = forgiven ? `, ${forgiven} allowlisted` : "";
    if (results.length === 0) {
      console.log(`   ✓ ${tree.padEnd(5)} clean (${countFiles(dirs)} files${allowNote})`);
      continue;
    }

    console.log(`   ✗ ${tree.padEnd(5)} ${total} string(s) in ${results.length} file(s)${allowNote}`);
    for (const { file, count, hits } of results) {
      console.log(`        ${String(count).padStart(4)}  ${file}`);
      for (const s of verbose ? hits : hits.slice(0, 3)) {
        console.log(`              · ${s.slice(0, 78)}`);
      }
      if (!verbose && hits.length > 3) {
        console.log(`              … ${hits.length - 3} more (--verbose to see all)`);
      }
    }
  }

  // Progress is measured against the frozen Phase 1 baseline, which was taken
  // over the shop tree alone — so it keeps meaning what it meant in Phase 9.
  const done = Math.max(0, BASELINE_STRINGS - shopTotal);
  const pct = ((done / BASELINE_STRINGS) * 100).toFixed(1);

  console.log("");
  console.log(`   shop tree vs Phase 1 baseline : ${shopTotal} / ${BASELINE_STRINGS} strings, ${shopFiles} / ${BASELINE_FILES} files`);
  console.log(`   localised                     : ${pct}%`);
  console.log(`   hardcoded, all three trees    : ${grandTotal}`);
  console.log(`   allowlisted (see ALLOWLIST)   : ${grandForgiven}`);

  const stale = [];
  for (const { file, strings } of ALLOWLIST) {
    for (const s of strings) {
      if (!ALLOWLIST_USED.has(`${file}::${s}`)) stale.push(`${file} — "${s}"`);
    }
  }
  if (stale.length) {
    console.log("\n   ⚠ Allowlist entries that matched nothing — delete them:");
    for (const entry of stale) console.log(`       ${entry}`);
  }

  if (!verbose && grandTotal) {
    console.log("\n   Run with --verbose to see every string.");
  }

  return grandTotal;
}

function countFiles(dirs) {
  return dirs.reduce((n, dir) => n + walk(join(ROOT, dir)).length, 0);
}

/** Print the allowlist so an exemption is visible in every CI log, not buried. */
function printAllowlist() {
  if (!process.argv.includes("--allowlist")) return;
  console.log("\n── Deliberately English ──────────────────────────────────────\n");
  for (const { file, reason, strings } of ALLOWLIST) {
    console.log(`   ${file}`);
    for (const s of strings) console.log(`     · "${s}"`);
    console.log(`     ${reason.replace(/\s+/g, " ")}\n`);
  }
}

/* ──────────────────────────────────────────────────────────────────────────── */

const drift = checkCatalogues();
const hardcoded = scanTrees();
printAllowlist();

console.log("");
if (drift || hardcoded) {
  if (drift) console.log("✗ FAIL — the catalogues have drifted. Fix the keys listed above.");
  if (hardcoded) {
    console.log(`✗ FAIL — ${hardcoded} hardcoded string(s) in the shop/auth/pay trees.`);
    console.log("         Move each into messages/*.json, or — if it is genuinely not");
    console.log("         copy — add it to ALLOWLIST in this file with the reason.");
  }
  process.exit(1);
}
console.log("✓ PASS — five catalogues at parity, no hardcoded copy.");
process.exit(0);
