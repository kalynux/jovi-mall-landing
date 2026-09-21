import type { Locale } from "@/i18n/routing";

/**
 * The hosted forms the marketing pages embed: one Google Form per page per
 * language, ten in all.
 *
 * ── Why ten forms and not two ────────────────────────────────────────────────
 * A Google Form has no translations. Its questions, options and confirmation
 * text are whatever the owner typed, in one language, so the only way to ask a
 * French visitor in French is a form written in French. Each locale of each page
 * gets its own form and its own variable. Replacing one is a deploy variable,
 * not a code change, like `EXTERNAL_LINKS` in `lib/constants.ts`.
 *
 * ── Why every variable is spelled out ────────────────────────────────────────
 * Next inlines a `NEXT_PUBLIC_*` value only where the source reads
 * `process.env.NEXT_PUBLIC_X` literally. A computed key such as
 * `process.env["NEXT_PUBLIC_CONTACT_FORM_URL_" + code]` compiles and
 * type-checks, but it is not replaced at build time. It becomes a lookup in whatever
 * environment the running process has, which is not the env file the value was
 * written in. Hence the two tables below, keyed by `Locale` so a sixth language
 * does not compile until it has a row.
 *
 * ── Which form a visitor gets ────────────────────────────────────────────────
 *   1. the form for the page's locale        NEXT_PUBLIC_CONTACT_FORM_URL_FR
 *   2. the English form for the same page    NEXT_PUBLIC_CONTACT_FORM_URL_EN
 *   3. the single pre-per-locale variable    NEXT_PUBLIC_CONTACT_FORM_URL
 *   4. careers only: that locale's CONTACT form, resolved by steps 1–3
 *   5. PLACEHOLDER_FORM
 *
 * ⚠ STEPS 2, 3 AND 5 PUT THE VISITOR IN FRONT OF A FORM IN ANOTHER LANGUAGE. A reader
 *   on /fr/contact whose French form is unset gets English questions under
 *   French buttons (`hl` below still follows the page). That beats an empty
 *   frame, but it is a fallback, not a finished state, so set all five
 *   variables of a form together.
 *
 * ⚠ THE PLACEHOLDER IS PRIVATE. It answers 401 and shows Google's "Sign in"
 *   wall to anyone who is not signed in to Google. That is its sharing
 *   settings, not this embed. So step 5 is a broken form, not a working
 *   default. That is why careers takes step 4 first: if the contact forms go
 *   live before the careers ones, an applicant gets a working form in their own
 *   language rather than Google's sign-in wall. `careersFormIsShared` then
 *   comes out true, and the careers page keeps its "say which role you mean"
 *   note, which is what makes an application readable in the contact sheet.
 *
 * Blank values (`NEXT_PUBLIC_X=` in an env file) arrive as "" rather than
 * undefined, and `??` would stop at them and embed an empty frame. So each step
 * is trimmed and must parse as an http(s) URL, and anything else is skipped like
 * an unset variable. The code skips it rather than throwing: a throw here fails
 * the prerender, and one typo in ten variables should cost one locale its own
 * form, not take the page down.
 *
 * ── What is done to the URL ──────────────────────────────────────────────────
 * - `embedded=true` is forced on, so the owner can paste either the responder
 *   link (…/viewform?usp=…) or the `src` from Google's embed snippet. Without
 *   it Google renders its full page chrome inside the frame.
 * - `hl=<locale>` is forced on, and replaces any `hl` the owner pasted. It sets
 *   the language of the words GOOGLE writes, not the owner's: "Submit", "Clear
 *   form", "* Indicates required question", and the page direction (`rtl` for
 *   ar). Checked on 2026-09-21 by fetching a public form with each of en, fr,
 *   pt, es and ar: each one changed `<html lang>` and the button text
 *   ("Submit", "Envoyer", "Enviar", "Enviar", and the Arabic). Without `hl`
 *   Google guesses. With an English `Accept-Language` from this workstation it
 *   served French, so leaving `hl` off would give /contact a French button for
 *   English readers.
 *
 * Paste the long …/viewform link. A forms.gle short link is a redirect, and
 * nothing here guarantees that the parameters added above survive it. Never
 * paste the …/edit link, which is the editor and needs the owner's sign-in.
 */
const PLACEHOLDER_FORM =
  "https://docs.google.com/forms/d/e/1FAIpQLSfi9hh9PNJBKVnz5m9zj4iRTKrCaB3hUMDWbqZHb3NOioAFTw/viewform?embedded=true";

const CONTACT_FORM_BY_LOCALE: Record<Locale, string | undefined> = {
  en: process.env.NEXT_PUBLIC_CONTACT_FORM_URL_EN,
  fr: process.env.NEXT_PUBLIC_CONTACT_FORM_URL_FR,
  pt: process.env.NEXT_PUBLIC_CONTACT_FORM_URL_PT,
  es: process.env.NEXT_PUBLIC_CONTACT_FORM_URL_ES,
  ar: process.env.NEXT_PUBLIC_CONTACT_FORM_URL_AR,
};

const CAREERS_FORM_BY_LOCALE: Record<Locale, string | undefined> = {
  en: process.env.NEXT_PUBLIC_CAREERS_FORM_URL_EN,
  fr: process.env.NEXT_PUBLIC_CAREERS_FORM_URL_FR,
  pt: process.env.NEXT_PUBLIC_CAREERS_FORM_URL_PT,
  es: process.env.NEXT_PUBLIC_CAREERS_FORM_URL_ES,
  ar: process.env.NEXT_PUBLIC_CAREERS_FORM_URL_AR,
};

/** Step 3: the one-variable-per-page setup that predates the per-locale forms. */
const CONTACT_FORM_UNSUFFIXED = process.env.NEXT_PUBLIC_CONTACT_FORM_URL;
const CAREERS_FORM_UNSUFFIXED = process.env.NEXT_PUBLIC_CAREERS_FORM_URL;

/** A usable form URL, or null for blank, malformed or non-http(s) values. */
function parseFormUrl(raw: string | undefined): URL | null {
  const value = raw?.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url : null;
  } catch {
    return null;
  }
}

function resolveFormUrl(
  locale: Locale,
  byLocale: Record<Locale, string | undefined>,
  unsuffixed: string | undefined,
  fallback: string = PLACEHOLDER_FORM
): string {
  const url =
    parseFormUrl(byLocale[locale]) ??
    parseFormUrl(byLocale.en) ??
    parseFormUrl(unsuffixed) ??
    new URL(fallback);
  url.searchParams.set("embedded", "true");
  url.searchParams.set("hl", locale);
  return url.toString();
}

/** The contact form to embed on `/contact` for this locale. */
export function contactFormUrl(locale: Locale): string {
  return resolveFormUrl(locale, CONTACT_FORM_BY_LOCALE, CONTACT_FORM_UNSUFFIXED);
}

/** The application form to embed on `/careers` for this locale. */
export function careersFormUrl(locale: Locale): string {
  return resolveFormUrl(
    locale,
    CAREERS_FORM_BY_LOCALE,
    CAREERS_FORM_UNSUFFIXED,
    contactFormUrl(locale)
  );
}

/**
 * Whether /careers and /contact embed the same form in this locale, in which
 * case an application and a contact message land in one response sheet.
 *
 * True today, because both fall through to the placeholder. It compares the
 * final URLs rather than asking which variables are set, so it is also true
 * when the owner points both pages' variables at one form, which amounts to
 * the same thing for whoever reads the sheet.
 */
export function careersFormIsShared(locale: Locale): boolean {
  return careersFormUrl(locale) === contactFormUrl(locale);
}
