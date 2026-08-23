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
 * somewhere; publishing five for roles nobody can be hired into is invented
 * structured data, the same class of problem `lib/seo/jsonld.ts` already refuses
 * for review counts. The page stays indexable either way — it is honest prose
 * about a company that is not hiring yet, which is a fine thing to have indexed.
 *
 * To open hiring: set `HIRING_OPEN = true`, give each opening a real
 * `datePosted`, and point `NEXT_PUBLIC_CAREERS_FORM_URL` at a real application
 * form so applications stop landing in the contact form's response sheet.
 */

export const HIRING_OPEN = false;

export type OpeningTeam = "engineering" | "product" | "operations" | "growth";
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
 * Grounded in what the codebase actually needs rather than in a generic startup
 * org chart: a Next.js marketing/shop surface in five languages, a modular
 * TypeScript monolith on Mongo, the WhatsApp assistant and its vectoriser, the
 * agent mobile app, and the agency network that does the delivering.
 */
export const OPENINGS: Opening[] = [
  { id: "frontend", team: "engineering", commitment: "fullTime", datePosted: "2026-01-01" },
  { id: "backend", team: "engineering", commitment: "fullTime", datePosted: "2026-01-01" },
  { id: "assistant", team: "engineering", commitment: "fullTime", datePosted: "2026-01-01" },
  { id: "mobile", team: "engineering", commitment: "contract", datePosted: "2026-01-01" },
  { id: "agencyOps", team: "operations", commitment: "fullTime", datePosted: "2026-01-01" },
  { id: "content", team: "growth", commitment: "contract", datePosted: "2026-01-01" },
];

/** schema.org `employmentType` for a commitment. Only used when hiring is open. */
export const EMPLOYMENT_TYPE: Record<OpeningCommitment, string> = {
  fullTime: "FULL_TIME",
  contract: "CONTRACTOR",
  internship: "INTERN",
};
