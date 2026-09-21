/**
 * Lets `node --test` load the app's TypeScript as it is written.
 *
 * Node 22.18+ strips types on its own, so there is no compiler and no test
 * framework to install. What it cannot do is resolve the two import spellings
 * the bundler accepts: `@/…` (tsconfig `paths`, → `src/…`) and a relative
 * import with no extension. This hook maps both onto the `.ts` file on disk and
 * hands everything else to Node unchanged.
 *
 * Loaded with `--import` by `npm test`. It is test-only: nothing in the app
 * imports it, and it only makes sense for modules with no JSX — which is what
 * the pure routing modules under `src/lib` are.
 */
import { registerHooks } from "node:module";
import { existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";

const SRC = new URL("../src/", import.meta.url);
const SUFFIXES = [".ts", "/index.ts"];

function isFile(url) {
  const path = fileURLToPath(url);
  return existsSync(path) && statSync(path).isFile();
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    let base = null;

    if (specifier.startsWith("@/")) {
      base = new URL(specifier.slice(2), SRC);
    } else if (
      /^\.\.?\//.test(specifier) &&
      context.parentURL?.startsWith("file:") &&
      !/\.[cm]?[jt]sx?$/.test(specifier)
    ) {
      base = new URL(specifier, context.parentURL);
    }

    if (base) {
      for (const suffix of SUFFIXES) {
        const candidate = new URL(`${base.href}${suffix}`);
        if (isFile(candidate)) return nextResolve(candidate.href, context);
      }
    }
    return nextResolve(specifier, context);
  },
});
