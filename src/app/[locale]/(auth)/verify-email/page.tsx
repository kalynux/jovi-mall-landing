"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { verifyEmail } from "@/lib/auth/auth.api";
import { ApiError } from "@/lib/auth/auth.types";
import { translateCode } from "@/lib/auth/error-translator";
import AuthCard from "@/components/auth/AuthCard";

type Status = "verifying" | "success" | "error";

function VerifyEmailContent() {
  const t = useTranslations("verifyEmail");
  const tErrors = useTranslations("errors");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [status, setStatus] = useState<Status>("verifying");
  const [message, setMessage] = useState<string | null>(null);

  // Guard against React 18 StrictMode double-invoke firing the request twice.
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    if (!token) {
      setStatus("error");
      setMessage(t("missingToken"));
      return;
    }

    let cancelled = false;
    verifyEmail(token)
      .then(() => {
        if (!cancelled) setStatus("success");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // Prefer the localised error code; fall back to the backend message.
        const msg =
          err instanceof ApiError
            ? translateCode(tErrors, err.code, err.message)
            : t("errorBody");
        setMessage(msg);
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
    // token is read once on mount; translators are stable enough for this flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Verifying ──────────────────────────────────────────────────────────────
  if (status === "verifying") {
    return (
      <AuthCard title={t("title")}>
        <div className="flex flex-col items-center gap-4 py-8 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" aria-hidden="true" />
          <p className="text-sm text-[var(--text-secondary)]" aria-live="polite">
            {t("verifying")}
          </p>
        </div>
      </AuthCard>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────────
  if (status === "success") {
    return (
      <AuthCard title={t("title")}>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-green-500" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <p className="font-display font-semibold text-[var(--text-primary)]">
              {t("successTitle")}
            </p>
            <p className="text-sm text-[var(--text-secondary)]">{t("successBody")}</p>
          </div>
          <Link href="/login" className="btn-primary w-full text-center">
            {t("goToLogin")}
          </Link>
        </div>
      </AuthCard>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  return (
    <AuthCard title={t("title")}>
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <AlertCircle className="w-7 h-7 text-red-500" aria-hidden="true" />
        </div>
        <div className="space-y-1">
          <p className="font-display font-semibold text-[var(--text-primary)]">
            {t("errorTitle")}
          </p>
          <p className="text-sm text-[var(--text-secondary)]">
            {message ?? t("errorBody")}
          </p>
        </div>
        <Link href="/login" className="btn-secondary w-full text-center">
          {t("backToLogin")}
        </Link>
      </div>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-8">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
