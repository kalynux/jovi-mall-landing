"use client";
import { useEffect } from "react";
import ErrorScreen from "@/components/errors/ErrorScreen";

/**
 * The catch-all boundary for everything under a locale.
 *
 * Sits inside `[locale]/layout.tsx`, so the theme and the message bundle are
 * already in place and the screen can be rendered in the visitor's own
 * language. Routes with a more specific story to tell (pricing, blog, shop,
 * auth) declare their own boundary nearer the failure; this catches the rest.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // The boundary swallows the throw, so without this the only record of a
    // production failure is the digest in the server log.
    console.error(error);
  }, [error]);

  return <ErrorScreen variant="generic" reset={reset} digest={error.digest} error={error} />;
}
