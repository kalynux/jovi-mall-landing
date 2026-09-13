#!/usr/bin/env node
/**
 * Merge one message catalogue across several branches — structurally, never
 * textually.
 *
 *     node scripts/merge-i18n.mjs messages/fr.json main phase-2 phase-3 phase-4
 *
 * The first ref is the BASE (normally `main`); every ref after it is a branch
 * whose changes are folded in. The merged catalogue is printed to stdout, so
 * redirect it or pipe it:
 *
 *     node scripts/merge-i18n.mjs messages/fr.json main phase-2 phase-3 > messages/fr.json
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * Phases 2–9 of the localisation project run in parallel, each in its own
 * worktree. Their SOURCE files are disjoint, so those merge on their own. Their
 * MESSAGE files are not: all eight write the same five `messages/*.json`.
 *
 * Scaffolding every namespace in Phase 1 was the first half of the fix — a
 * phase that only fills `"cart": {}` does not have to invent the line that
 * declares it, and so does not collide with a phase inventing `"orders": {}`
 * three lines away. But it is only half. Git merges these files as TEXT, and
 * two namespaces on ADJACENT LINES still land in the same hunk: filling
 * `"saved": {}` on line 40 and `"pay": {}` on line 41 is a textual conflict
 * even though the two edits have nothing to do with each other.
 *
 * So do not merge these files as text at all. Parse each side, merge the
 * OBJECTS, re-serialise. Because the ownership table in LOCALISATION.md gives
 * every key to exactly one phase, a deep merge of two correct branches is
 * always unambiguous — there is no case where the tool has to guess.
 *
 * ── The one thing it will not do ─────────────────────────────────────────────
 *
 * If two branches set the SAME leaf key to DIFFERENT values, that is a planning
 * error: two phases wrote into one namespace, which the ownership table exists
 * to prevent. The script names the key and exits non-zero rather than picking a
 * winner. Silently resolving it would ship one phase's copy and bin the other's
 * with nothing on screen to say so.
 *
 * ── Output format ───────────────────────────────────────────────────────────
 *
 * CRLF line endings, 4-space indent, trailing newline — byte-identical in shape
 * to what is already on disk. Getting this wrong reformats all ~1700 lines and
 * buries the real change. See LOCALISATION.md.
 */

import { execFileSync } from "node:child_process";

const [, , filePath, ...refs] = process.argv;

if (!filePath || refs.length < 2) {
  console.error("usage: node scripts/merge-i18n.mjs <path> <base-ref> <ref> [ref…]");
  console.error("");
  console.error("  e.g. node scripts/merge-i18n.mjs messages/fr.json main phase-2 phase-3");
  console.error("");
  console.error("  The first ref is the base; the rest are folded into it.");
  process.exit(2);
}

const [baseRef, ...branchRefs] = refs;

/* ── Reading ───────────────────────────────────────────────────────────────── */

/** The file as it stands on one ref. `git show` is the only reader — nothing is taken from the working tree. */
function readAtRef(ref) {
  let raw;
  try {
    raw = execFileSync("git", ["show", `${ref}:${filePath}`], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    console.error(`✗ cannot read ${filePath} at ref '${ref}'.`);
    console.error("  Check the ref exists and the file is tracked on it.");
    process.exit(2);
  }
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error(`✗ ${filePath} at ref '${ref}' is not valid JSON: ${err.message}`);
    process.exit(2);
  }
}

const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/* ── Diffing ───────────────────────────────────────────────────────────────── */

/**
 * Every leaf a branch CHANGED relative to the base, as `dotted.path → value`.
 *
 * Only changes are collected, not the whole file. A branch that merely inherits
 * `shop.common.cancel` from the base must not be treated as having an opinion
 * about it — otherwise two branches that both inherited the same key would look
 * like a conflict, and the tool would refuse every merge it was built for.
 *
 * Deletions are not tracked. A phase removing someone else's key is not a
 * workflow this supports, and quietly replaying such a removal into a merge is
 * exactly the silent data loss the conflict check exists to prevent.
 */
function collectChanges(base, branch, prefix = "", out = new Map()) {
  for (const [key, value] of Object.entries(branch)) {
    const path = prefix ? `${prefix}.${key}` : key;
    const baseValue = isPlainObject(base) ? base[key] : undefined;

    if (isPlainObject(value)) {
      // Recurse into objects on both sides. An object the base does not have at
      // all still recurses, against `undefined` — every leaf under it is new.
      collectChanges(isPlainObject(baseValue) ? baseValue : {}, value, path, out);

      // An empty object is a scaffolded namespace. Record it so a branch that
      // scaffolds one the base lacks still creates it, but as a container
      // rather than a leaf — it can never conflict with anything.
      if (Object.keys(value).length === 0 && !isPlainObject(baseValue)) {
        out.set(path, { value: {}, container: true });
      }
      continue;
    }

    // A leaf. Identical to the base means "inherited", not "changed".
    if (baseValue !== value) out.set(path, { value, container: false });
  }
  return out;
}

/* ── Merging ───────────────────────────────────────────────────────────────── */

function setDeep(target, dottedPath, value) {
  const parts = dottedPath.split(".");
  let node = target;
  for (const part of parts.slice(0, -1)) {
    if (!isPlainObject(node[part])) node[part] = {};
    node = node[part];
  }
  const last = parts[parts.length - 1];
  // Never let a scaffolded `{}` stamp over a namespace another branch filled.
  if (isPlainObject(value) && Object.keys(value).length === 0 && isPlainObject(node[last])) return;
  node[last] = value;
}

const base = readAtRef(baseRef);
const merged = structuredClone(base);

/** `dotted.path → { ref, value }` for every leaf a branch has already claimed. */
const claimed = new Map();
const conflicts = [];
const perRefCounts = [];

for (const ref of branchRefs) {
  const changes = collectChanges(base, readAtRef(ref));
  let applied = 0;

  for (const [path, { value, container }] of changes) {
    if (!container) {
      const prior = claimed.get(path);
      if (prior && prior.value !== value) {
        conflicts.push({ path, a: prior, b: { ref, value } });
        continue; // leave the first writer's value in place until a human decides
      }
      claimed.set(path, { ref, value });
    }
    setDeep(merged, path, value);
    applied += 1;
  }

  perRefCounts.push({ ref, applied });
}

/* ── Reporting ─────────────────────────────────────────────────────────────── */

if (conflicts.length > 0) {
  console.error(`✗ ${conflicts.length} conflicting key(s) in ${filePath}.`);
  console.error("");
  console.error("  Two branches set the same key to different values. Per the ownership");
  console.error("  table in LOCALISATION.md that cannot happen by design, so this is a");
  console.error("  planning error: two phases wrote into one namespace. Decide which is");
  console.error("  right, fix it on the branch, and re-run — nothing has been merged.");
  console.error("");
  for (const { path, a, b } of conflicts) {
    console.error(`  ${path}`);
    console.error(`      ${a.ref}: ${JSON.stringify(a.value)}`);
    console.error(`      ${b.ref}: ${JSON.stringify(b.value)}`);
  }
  process.exit(1);
}

for (const { ref, applied } of perRefCounts) {
  console.error(`  ${ref}: ${applied} key(s) folded in`);
}
console.error(`✓ ${filePath} merged from ${refs.length} refs, no conflicts.`);

// CRLF, 4-space, trailing newline — byte-for-byte the existing house style.
process.stdout.write(JSON.stringify(merged, null, 4).replace(/\n/g, "\r\n") + "\r\n");
