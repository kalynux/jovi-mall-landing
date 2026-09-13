import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // ⚠ THE NATIVE PROJECTS, AND THIS IS NOT TIDINESS — IT WAS 76 OF 135 ERRORS
    //   AND 15,256 OF 15,261 WARNINGS. Measured 2026-09-13.
    //
    //   `cap sync` copies the MINIFIED web build into three places under
    //   android/: app/src/main/assets/public/, and again into
    //   app/build/intermediates/assets/{debug,release}/. eslint was reading all
    //   of it as source. Minified code trips the same rules over and over —
    //   14,018 no-unused-expressions (comma operators), 1,237 no-unused-vars
    //   (mangled names), 76 no-this-alias — so the report was dominated by
    //   machine output and the 59 real findings were invisible inside it.
    //
    //   ⚠ `build/**` ABOVE DOES NOT COVER THIS. In flat config that pattern is
    //     anchored at the project root, so it matches ./build/ and not
    //     android/app/build/. That one detail is why this went unnoticed.
    "android/**",
    "ios/**",
  ]),

  /**
   * ── Localisation: no bare copy in the shop, auth or pay trees ──────────────
   *
   * `node scripts/check-i18n.mjs` (`npm run check:i18n`) is THE gate — it fails
   * CI, and it is the one that must keep working. This rule is a second opinion
   * that fires in the editor while the string is being typed, which the script
   * cannot do.
   *
   * A **warning**, deliberately. `npm run lint` is not a reliable gate in this
   * repository (see LOCALISATION.md §9), so promoting it to "error" would buy
   * no enforcement and would break the editor on a half-typed component.
   *
   * `ignoreProps: true` because props are the scanner's job: it knows which
   * props carry copy (`label`, `title`, `placeholder`…) and which are machine
   * data (`href`, `name`, `className`), and this rule does not. What it catches
   * that the scanner sometimes misses is the plain case — `<p>Hello</p>`.
   *
   * ⚠ `[locale]` is a CHARACTER CLASS in a glob. Unescaped, `src/app/[locale]/`
   *   matches `src/app/l/`, `src/app/o/`, `src/app/c/` … and never the real
   *   directory. The backslashes below are what make it a literal bracket.
   */
  {
    files: [
      "src/app/\\[locale\\]/shop/**/*.{ts,tsx}",
      "src/app/\\[locale\\]/(auth)/**/*.{ts,tsx}",
      "src/app/\\[locale\\]/pay/**/*.{ts,tsx}",
      "src/components/shop/**/*.{ts,tsx}",
      "src/components/auth/**/*.{ts,tsx}",
      "src/components/pay/**/*.{ts,tsx}",
    ],
    rules: {
      /**
       * `allowedStrings` is separators, operators and unit symbols — the
       * characters a layout is built from, not words. `·` between two facts,
       * `×` before a quantity, `≤` in a filter, `/` in a ratio and `↩` on a
       * key hint read identically in all five languages, and wrapping each of
       * them in `t()` would add 16 catalogue keys that every translator has to
       * copy verbatim.
       *
       * They are here rather than disabled per line because they recur — `·`
       * alone appears eight times — and a rule that has to be switched off at
       * eight call sites is one people learn to switch off everywhere.
       *
       * ⚠ Nothing that is a WORD belongs on this list. `KB` is the one
       *   borderline entry and it is deliberate: it is a unit symbol, and the
       *   scanner in check-i18n.mjs classes ALLCAPS as machine data for the
       *   same reason. If a French "Ko" is ever wanted, that is a real string
       *   and it comes off this list.
       */
      "react/jsx-no-literals": [
        "warn",
        {
          ignoreProps: true,
          allowedStrings: [
            "·", "×", "÷", "±", "≥", "≤", "≈", "→", "←", "↑", "↓", "↩",
            "•", "–", "—", "-", "/", "\\", "|", "#", "%", "*", "+", "=",
            "(", ")", "[", "]", ":", ";", ",", ".", "…", "@", "&",
            "KB", "MB", "GB",
          ],
        },
      ],
    },
  },
]);

export default eslintConfig;
