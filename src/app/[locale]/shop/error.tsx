"use client";
import { useEffect } from "react";
import ErrorScreen from "@/components/errors/ErrorScreen";

/**
 * Inside `shop/layout.tsx`, so the header, bottom nav and cart badge survive
 * the failure — a shopper keeps their way out of a broken page.
 */
export default function ShopError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorScreen variant="shop" reset={reset} digest={error.digest} error={error} />;
}
