import { notFound } from "next/navigation";

/**
 * Every URL that matches no real route — a typo, a dead inbound link, a path
 * that used to exist.
 *
 * Without it those requests match nothing at all, and Next answers with its own
 * bare "404 · This page could not be found": no navbar, no footer, no
 * translation, no way onward. A `not-found.tsx` cannot fix that on its own,
 * because Next only reaches for one when a *matched* route calls `notFound()`.
 * So this route matches everything left over and calls it, which hands the
 * request to `(marketing)/not-found.tsx` inside the marketing chrome.
 *
 * Placed last in specificity by definition: Next resolves static segments
 * before dynamic ones and dynamic before catch-alls, so /pricing, /blog/[slug]
 * and every other real route are picked first and none of them can be shadowed
 * by this file.
 *
 * `notFound()` sets the 404 status, so crawlers still read this as gone rather
 * than as a soft 404 with a friendly face.
 */
export default function CatchAllNotFound(): never {
  notFound();
}
