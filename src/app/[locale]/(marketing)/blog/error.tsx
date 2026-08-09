"use client";
import { useEffect } from "react";
import ErrorScreen from "@/components/errors/ErrorScreen";

/**
 * Covers /blog, /blog/[slug] and /blog/category/[category] — all three read the
 * articles API and all three throw `BlogApiError` when it cannot be reached.
 */
export default function BlogError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorScreen variant="blog" reset={reset} digest={error.digest} error={error} />;
}
