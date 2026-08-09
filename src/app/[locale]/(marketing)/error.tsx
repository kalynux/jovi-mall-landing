"use client";
import { useEffect } from "react";
import ErrorScreen from "@/components/errors/ErrorScreen";

/**
 * The standalone marketing pages — /vendors, /agencies, /agents, /faq,
 * /cameroon and its city pages.
 *
 * Declared at the route-group level so the failure renders *inside*
 * `MarketingLayout`: the navbar and footer stay put, which is the difference
 * between a page that failed and a site that failed.
 */
export default function MarketingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorScreen variant="generic" reset={reset} digest={error.digest} error={error} />;
}
