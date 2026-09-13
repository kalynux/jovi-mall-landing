#!/usr/bin/env node
/**
 * The localisation gate for the `/shop` tree.
 *
 *     node scripts/check-i18n.mjs
 *
 * Two independent questions, answered in one run:
 *
 *   1. **Are the five catalogues in step?** Every key in `messages/en.json` must
 *      exist in fr, es, pt and ar. This is the half that FAILS the run — a key
 *      present in one language and missing in another is a `MISSING_MESSAGE`
 *      crash in next-intl, not a cosmetic gap, so it must never reach a branch.
 *
 *   2. **How much English is still hardcoded in the shop tree?** A count, per
 *      file and in total, with a percentage against the Phase 1 baseline. This
 *      half is a PROGRESS REPORT and never fails the run: it is a regex over
 *      source text, it will always be approximate, and a build that breaks
 *      because a heuristic miscounted a `<` would be worse than useless.
 *
 * Exit code: non-zero only on catalogue key drift (question 1). That is what
 * makes this safe to wire into CI while phases 2–10 are still landing.
 *
 * ── The `errors.*` exception ─────────────────────────────────────────────────
 *
 * `errors.*` is a pre-existing gap that predates this project: pt and ar were
 * never filled in for the backend error-code catalogue. It is reported
 * separately and deliberately does NOT fail the run — Phase 10 backfills it.
 * Every other namespace is held to parity from Phase 1 onwards.
 *
 * See LOCALISATION.md for the contract this script enforces.
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
 * business. Reported, never fatal. Phase 10 empties this list.
 */
const KNOWN_GAP_PREFIXES = ["errors."];

/**
 * The Phase 1 measurement, frozen so later phases can see movement.
 *
 * 625 hardcoded strings across 94 files, counted by the scanner below over the
 * three directories in `SCAN_DIRS`. Do not "refresh" these numbers — the whole
 * point is that they are the fixed denominator every phase divides into.
 */
const BASELINE_STRINGS = 625;
const BASELINE_FILES = 94;

/** The shop tree, and nothing else. Phases 1–10 do not touch the marketing site. */
const SCAN_DIRS = [
  join("src", "app", "[locale]", "shop"),
  join("src", "components", "shop"),
  join("src", "lib", "shop"),
];

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
      const note = missingKnown.length ? `  (+${missingKnown.length} known errors.* gap)` : "";
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
      console.log(`       (${missingKnown.length} further errors.* keys — known gap, not counted)`);
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
    console.log(`   ℹ Known pre-existing gap in errors.*: ${gapSummary.join(", ")}.`);
    console.log("     Tracked for Phase 10. This does not fail the run.");
  } else {
    console.log("   ℹ errors.* is complete in every language.");
  }

  return drift;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Part 2 — hardcoded string scan
 *
 * A regex pass, not a parser. It is deliberately conservative: it would rather
 * miss a string than invent one, because the number it prints is read as
 * progress and a noisy count is worse than a slightly low one.
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
    .replace(/\bfrom\s*["'][^"']*["']/g, blank);
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
 * and — per LOCALISATION.md — the wrong fix for it. Word order moves between
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
 * Copy-bearing props, in the three shapes this codebase writes them:
 *
 *     title="No order to show"          JSX attribute
 *     title={"No order to show"}        JSX attribute, braced
 *     label: "Pending",                 object literal (the lib label maps)
 *
 * The object-literal form is included on purpose. It is how `order-status.ts`
 * and friends carried English before Phase 1 converted them to `labelKey`, so
 * counting it is what makes that conversion visible in this number.
 */
function findCopyProps(code) {
  const hits = [];
  const names = COPY_PROPS.map((p) => p.replace(/[-]/g, "\\-")).join("|");

  // JSX attribute: prop="…" or prop={"…"}
  const attr = new RegExp(`\\b(?:${names})\\s*=\\s*\\{?\\s*(["'])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`, "g");
  for (const m of code.matchAll(attr)) {
    if (isUserVisible(m[2])) hits.push(m[2]);
  }

  // Object literal: prop: "…"
  const obj = new RegExp(`\\b(?:${names})\\s*:\\s*(["'])((?:\\\\.|(?!\\1)[^\\\\])*)\\1`, "g");
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
    return out; // a directory a future phase has not created yet
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(full);
  }
  return out;
}

function scanShopTree() {
  const results = [];
  let total = 0;

  for (const dir of SCAN_DIRS) {
    for (const file of walk(join(ROOT, dir))) {
      const code = stripNonCode(readFileSync(file, "utf8"));
      const hits = [...findJsxText(code), ...findCopyProps(code)];
      if (hits.length === 0) continue;
      results.push({
        file: relative(ROOT, file).split(sep).join("/"),
        count: hits.length,
        samples: hits.slice(0, 3),
      });
      total += hits.length;
    }
  }

  results.sort((a, b) => b.count - a.count || a.file.localeCompare(b.file));

  console.log("\n── Hardcoded strings in the shop tree ────────────────────────\n");
  if (results.length === 0) {
    console.log("   ✓ Nothing left to translate.\n");
  } else {
    for (const { file, count, samples } of results) {
      console.log(`   ${String(count).padStart(4)}  ${file}`);
      if (process.argv.includes("--verbose")) {
        for (const s of samples) console.log(`          · ${s.slice(0, 72)}`);
      }
    }
    console.log("");
  }

  // Progress is measured against the frozen Phase 1 baseline, so the number
  // means the same thing in Phase 9 as it did here.
  const done = Math.max(0, BASELINE_STRINGS - total);
  const pct = ((done / BASELINE_STRINGS) * 100).toFixed(1);

  console.log(`   files with hardcoded copy : ${results.length} / ${BASELINE_FILES} baseline`);
  console.log(`   strings remaining         : ${total} / ${BASELINE_STRINGS} baseline`);
  console.log(`   localised                 : ${pct}%`);
  console.log("\n   (This section is a progress report and never fails the run.)");
  console.log("   Run with --verbose to see sample strings per file.");

  return { total, files: results.length, pct };
}

/* ──────────────────────────────────────────────────────────────────────────── */

const drift = checkCatalogues();
scanShopTree();

console.log("");
if (drift) {
  console.log("✗ FAIL — the catalogues have drifted. Fix the keys listed above.");
  process.exit(1);
}
console.log("✓ PASS — five catalogues at parity.");
process.exit(0);
