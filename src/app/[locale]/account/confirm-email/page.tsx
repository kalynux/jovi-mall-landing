"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { confirmEmailChange } from "@/lib/me/contact.api";
import { ApiError } from "@/lib/auth/auth.types";
import AuthCard from "@/components/auth/AuthCard";

type Status = "confirming" | "success" | "error";

/**
 * The landing page for the "confirm your new email address" link.
 *
 * ── Why this route is here and not under `/shop/account` ─────────────────────
 *
 * The backend builds the link as `{STOREFRONT_URL}/account/confirm-email?token=`
 * (`contact-change.service.ts:86`), and `STOREFRONT_URL` is the site root. With
 * `localePrefix: "as-needed"` on the web build, the unprefixed path *is* the
 * English route, so this file serves that link exactly as sent.
 *
 * ── 🔴 It POSTs the token; it must never GET it ──────────────────────────────
 *
 * `POST /api/auth/email-change/confirm` is deliberately **unauthenticated** and
 * deliberately a POST. Unauthenticated because the link is opened in a mail
 * client, which is routinely not the browser that started the change and often
 * not the same device — requiring a session would break the flow for exactly the
 * people it is for, and the token is itself the credential.
 *
 * A POST because a `GET` that mutates is spent by whatever prefetches the mail:
 * link scanners, corporate relays, the mail client's own preview. So the page
 * loads, reads `?token=`, and makes the call itself.
 *
 * The two failure codes are kept apart on purpose — "start again" and "check the
 * link you clicked" are different instructions, and collapsing them into one
 * message is the thing the contract asks us not to do.
 */
function ConfirmEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<Status>("confirming");
  const [message, setMessage] = useState<string | null>(null);

  // The token is single-use, so a StrictMode double-invoke would spend it and
  // then report the second call's "invalid" as the outcome.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!token) {
      setStatus("error");
      setMessage("That link is missing its token. Open the most recent email and try again.");
      return;
    }

    let cancelled = false;
    confirmEmailChange(token)
      .then(() => {
        if (!cancelled) setStatus("success");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const code = err instanceof ApiError ? err.code : undefined;
        setMessage(
          code === "CONTACT_CHANGE_EXPIRED"
            ? "That link has expired. Request the change again from your account settings."
            : code === "CONTACT_CHANGE_TOKEN_INVALID"
              ? "That link is not valid. Check you opened the most recent email."
              : code === "CONTACT_CHANGE_NOT_PENDING"
                ? "There is no email change waiting to be confirmed. It may already be done."
                : "We could not confirm that change. Please try again.",
        );
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (status === "confirming") {
    return (
      <AuthCard title="Confirming your email">
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" aria-hidden="true" />
          <p className="text-sm text-[var(--text-secondary)]" aria-live="polite">
            One moment…
          </p>
        </div>
      </AuthCard>
    );
  }

  if (status === "success") {
    return (
      <AuthCard title="Email updated">
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <CheckCircle2 className="w-8 h-8 text-green-500" aria-hidden="true" />
          <p className="text-sm text-[var(--text-secondary)]">
            This is the address you sign in with now.
          </p>
          {/* A contact change deliberately does not sign anyone out — it changes
              no credential — so there is a session to go back to. */}
          <Link href="/shop/account" className="text-sm font-semibold text-primary-500">
            Back to my account
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Could not confirm">
      <div className="flex flex-col items-center gap-4 py-8 text-center">
        <AlertCircle className="w-8 h-8 text-red-500" aria-hidden="true" />
        <p className="text-sm text-[var(--text-secondary)]">{message}</p>
        <Link href="/shop/account/security" className="text-sm font-semibold text-primary-500">
          Account settings
        </Link>
      </div>
    </AuthCard>
  );
}

export default function ConfirmEmailPage() {
  return (
    <Suspense fallback={null}>
      <ConfirmEmailContent />
    </Suspense>
  );
}
