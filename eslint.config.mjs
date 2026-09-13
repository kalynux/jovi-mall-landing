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
]);

export default eslintConfig;
