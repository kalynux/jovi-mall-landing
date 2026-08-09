"use client";
import { useEffect } from "react";
import ErrorScreen from "@/components/errors/ErrorScreen";

/**
 * /pricing renders live prices off `GET /api/public/plans` and has no fallback
 * copy by design (see `lib/marketing/plans.api.ts`), so an unreachable catalog
 * takes the whole page down. This turns that into a sentence about the prices
 * rather than a stack trace.
 */
export default function PricingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorScreen variant="pricing" reset={reset} digest={error.digest} error={error} />;
}
