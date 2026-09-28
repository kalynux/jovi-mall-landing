/**
 * The roles Wi-Mall hires for, and whether it is hiring for them right now.
 *
 * `HIRING_OPEN` is the whole switch. It follows the same idiom as
 * `BLOG_IS_PLACEHOLDER` in `lib/blog/blog.seo.ts`: one constant, one comment,
 * one flip — so the page is built once and turned on later rather than written
 * twice.
 *
 * While it is `false`:
 *   - the openings render shaded, labelled as not yet open, and are not links
 *   - the page says so plainly instead of implying a live process
 *   - **no `JobPosting` structured data is emitted**
 *
 * That last one is the point. A JobPosting tells Google a real application leads
 * somewhere; publishing four for roles nobody can be hired into is invented
 * structured data, the same class of problem `lib/seo/jsonld.ts` already refuses
 * for review counts. The page stays indexable either way — it is honest prose
 * about a company that is not hiring yet, which is a fine thing to have indexed.
 *
 * To open hiring: set `HIRING_OPEN = true`, give each opening a real
 * `datePosted`, and set the five `NEXT_PUBLIC_CAREERS_FORM_URL_<LOCALE>`
 * variables (see `lib/marketing/forms.ts`) to real application forms so
 * applications stop landing in the contact form's response sheet.
 *
 * ⚠ The form is embedded while this is `false` too, under "Get on the list".
 *   It is how people join the list, so an unset or private careers form is a
 *   live problem today, not something that waits for hiring to open.
 */

export const HIRING_OPEN = false;

export type OpeningTeam = "support";
export type OpeningCommitment = "fullTime" | "contract" | "internship";

export type Opening = {
  /** Copy lives at `pages.careers.roles.<id>.{title,body}`. */
  id: string;
  team: OpeningTeam;
  commitment: OpeningCommitment;
  /**
   * ISO date the role was published. Only read when `HIRING_OPEN` is true, and
   * deliberately a literal rather than a build-time `new Date()` — a clock here
   * would restamp every posting on every deploy and fake a freshness signal.
   * Set real dates when the roles actually open.
   */
  datePosted: string;
};

/**
 * Support first (owner decision, 2026-09-28): the first people Wi-Mall hires
 * are support assistants, not developers — one role for each kind of person who
 * works with Wi-Mall directly or indirectly and needs help doing it. The ids
 * follow the four account types so the copy can be specific about what each
 * one gets stuck on.
 */
export const OPENINGS: Opening[] = [
  { id: "customerSupport", team: "support", commitment: "fullTime", datePosted: "2026-01-01" },
  { id: "vendorSupport", team: "support", commitment: "fullTime", datePosted: "2026-01-01" },
  { id: "agencySupport", team: "support", commitment: "fullTime", datePosted: "2026-01-01" },
  { id: "agentSupport", team: "support", commitment: "fullTime", datePosted: "2026-01-01" },
];

/** schema.org `employmentType` for a commitment. Only used when hiring is open. */
export const EMPLOYMENT_TYPE: Record<OpeningCommitment, string> = {
  fullTime: "FULL_TIME",
  contract: "CONTRACTOR",
  internship: "INTERN",
};
