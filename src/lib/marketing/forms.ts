/**
 * The hosted forms the marketing pages embed.
 *
 * Both point at the same Google Form today — a deliberate placeholder while the
 * real forms are built. Each is env-overridable so replacing one is a deploy
 * variable rather than a code change, following the same convention as
 * `EXTERNAL_LINKS` in `lib/constants.ts`.
 *
 * KNOWN CONSEQUENCE, and the reason they are two constants rather than one:
 * until `NEXT_PUBLIC_CAREERS_FORM_URL` is set, a job application and a contact
 * message land in the same response sheet. Splitting them later means setting
 * one variable, not editing two pages.
 *
 * `?embedded=true` is what makes Google render the bare form without its own
 * page chrome; keep it on any URL that replaces these.
 */
const PLACEHOLDER_FORM =
  "https://docs.google.com/forms/d/e/1FAIpQLSfi9hh9PNJBKVnz5m9zj4iRTKrCaB3hUMDWbqZHb3NOioAFTw/viewform?embedded=true";

export const CONTACT_FORM_URL =
  process.env.NEXT_PUBLIC_CONTACT_FORM_URL ?? PLACEHOLDER_FORM;

export const CAREERS_FORM_URL =
  process.env.NEXT_PUBLIC_CAREERS_FORM_URL ?? PLACEHOLDER_FORM;
