import { getCountries, getCountryCallingCode, getExampleNumber } from "libphonenumber-js";
import examplesModule from "libphonenumber-js/examples.mobile.json";
import { writeFileSync } from "node:fs";

// The package ships this as a CJS shim (examples.mobile.json.js), so the ESM
// default may be the module object rather than the data itself.
const examples = examplesModule.default ?? examplesModule;

const names = new Intl.DisplayNames(["en"], { type: "region" });

const rows = getCountries()
  .map((iso2) => {
    let name;
    try {
      name = names.of(iso2) ?? iso2;
    } catch {
      name = iso2;
    }
    let example = "";
    try {
      const ex = getExampleNumber(iso2, examples);
      // formatNational() yields e.g. "6 71 23 45 67" — used verbatim as the
      // input placeholder so users see the shape their own number should take.
      example = ex ? ex.formatNational() : "";
    } catch {
      example = "";
    }
    return { iso2, name, callingCode: getCountryCallingCode(iso2), example };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "en"));

const body = rows
  .map(
    (r) =>
      `  { iso2: "${r.iso2}", name: ${JSON.stringify(r.name)}, callingCode: "${r.callingCode}", example: ${JSON.stringify(r.example)} },`
  )
  .join("\n");

const out = `// ─────────────────────────────────────────────────────────────────────────────
// GENERATED FILE — do not edit by hand.
//
// Derived from libphonenumber-js metadata (calling codes + example mobile
// numbers) and ICU region names. Baked at author time rather than computed at
// runtime for three reasons:
//   1. \`Intl.DisplayNames\` can disagree between the Node build that renders
//      the server pass and the browser that hydrates it, which would surface
//      as a hydration mismatch on a field that is server-rendered.
//   2. \`libphonenumber-js/examples.mobile.json\` is ~10 KB of payload that is
//      only ever used to produce these short placeholder strings.
//   3. The list has to be searchable offline, before any locale data loads.
//
// Regenerate by re-running the generator described in src/lib/phone/README.md
// after a libphonenumber-js upgrade.
// ─────────────────────────────────────────────────────────────────────────────
import type { CountryCode } from "libphonenumber-js";

export interface CountryMeta {
  /** ISO 3166-1 alpha-2 code — the same shape the backend stores in \`country\`. */
  iso2: CountryCode;
  /** English display name. Localised at runtime where the browser can. */
  name: string;
  /** Calling code without the leading "+". */
  callingCode: string;
  /** Example mobile number in national format, used as the input placeholder. */
  example: string;
}

export const COUNTRIES: readonly CountryMeta[] = [
${body}
];
`;

writeFileSync(process.argv[2], out, "utf8");
console.log(`wrote ${rows.length} countries`);
