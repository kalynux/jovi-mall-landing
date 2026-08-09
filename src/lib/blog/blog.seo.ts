import type { Metadata } from "next";

/**
 * Whether the blog is open to search engines.
 *
 * **What this gated originally, and what it gates now, are different things.**
 * It was written when `blog.fixtures.ts` was the content: five unreviewed
 * generated articles that must not be published on a new domain. That risk is
 * gone — the pages read the CMS, and nothing reaches it except through an
 * editor. Nothing was imported from the fixtures.
 *
 * What it means today is simply: *the blog has not been launched yet.* While it
 * is `true`, every blog page carries `noindex, follow` and no blog URL reaches
 * the sitemap.
 *
 * **The footgun that comes with the change of meaning:** an editor can now
 * publish a perfectly good article and it will be invisible to Google, with
 * nothing on the page to say so. Leaving this `true` after real articles exist
 * is no longer a safety measure, it is a silent bug. Flip it the day the first
 * reviewed article is published.
 *
 * `follow` is deliberate either way: the internal links from an article to
 * /pricing still pass their signal, so the blog is not a dead end while it
 * waits.
 */
export const BLOG_IS_PLACEHOLDER = true;

export function blogRobots(): Metadata["robots"] {
  return BLOG_IS_PLACEHOLDER ? { index: false, follow: true } : undefined;
}
