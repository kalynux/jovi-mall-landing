"use client";
import ErrorScreen from "@/components/errors/ErrorScreen";

/**
 * The same 404, but rendered inside `MarketingLayout` so a reader who followed
 * a dead blog link keeps the navbar and footer to move on with. Without this,
 * `notFound()` from /blog/[slug] would bubble past the marketing chrome to the
 * bare locale-level page.
 */
export default function MarketingNotFound() {
  return <ErrorScreen variant="notFound" />;
}
