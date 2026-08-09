"use client";
import { useEffect } from "react";
import ErrorScreen from "@/components/errors/ErrorScreen";

/**
 * Login, register, add-role, auth-me and verify-email.
 *
 * Failures *inside* a submit are already handled in the forms themselves
 * (`mapApiErrors`), which is the better place for them — the visitor keeps what
 * they typed. This boundary is for the rest: a render that throws before the
 * form is even on screen.
 */
export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <ErrorScreen variant="auth" reset={reset} digest={error.digest} error={error} />;
}
