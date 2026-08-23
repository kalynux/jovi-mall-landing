"use client";

import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import AuthCard from "@/components/auth/AuthCard";
import { resetPassword } from "@/lib/auth/auth.api";
import { ResetPasswordSchema, type ResetPasswordFormValues } from "@/lib/auth/auth.schemas";
import { ApiError } from "@/lib/auth/auth.types";
import { translateCode } from "@/lib/auth/error-translator";

/**
 * Set a new password from a reset link.
 *
 * The token is single-use and short-lived, and `AUTH_RESET_TOKEN_INVALID` covers
 * unknown, spent and expired alike — so the only useful response to it is "get a
 * fresh link", which is what the error state offers rather than leaving the user
 * retyping a password against a token that can never work.
 *
 * The strength rule here is the **strong** one (8 + upper + lower + digit +
 * symbol), matching the backend's `PasswordStrengthSchema`. Registration still
 * accepts 6 characters with no complexity rule, so a password that was fine at
 * sign-up may be refused here — that mismatch is real and server-side, and
 * loosening this form would only move the rejection to the network round trip.
 */
function ResetPasswordContent() {
  const t = useTranslations("resetPassword");
  const tErrors = useTranslations("errors");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [done, setDone] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { password: "", confirm: "" },
  });

  const onSubmit = handleSubmit(async ({ password }) => {
    if (!token) return;
    setFailure(null);
    try {
      await resetPassword(token, password);
      setDone(true);
    } catch (err: unknown) {
      setFailure(
        err instanceof ApiError
          ? translateCode(tErrors, err.code, err.message)
          : t("failed")
      );
    }
  });

  // A link opened without its token cannot be recovered from here.
  if (!token) {
    return (
      <AuthCard title={t("title")}>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
            <AlertCircle className="h-7 w-7 text-red-500" aria-hidden="true" />
          </div>
          <p className="text-sm text-[var(--text-secondary)]">{t("missingToken")}</p>
          <Link
            href="/forgot-password"
            className="mt-2 text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
          >
            {t("requestNew")}
          </Link>
        </div>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title={t("successTitle")}>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10">
            <CheckCircle2 className="h-7 w-7 text-green-500" aria-hidden="true" />
          </div>
          {/* Changing the password stamps `password_changed_at`, and the
              password-epoch check refuses every token issued before it — so every
              other session really is gone. Saying so is the difference between a
              security feature and a mysterious sign-out. */}
          <p className="text-sm text-[var(--text-secondary)]" aria-live="polite">
            {t("successBody")}
          </p>
          <Link
            href="/login"
            className="btn-primary mt-2 inline-flex items-center justify-center"
          >
            {t("signIn")}
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-xs font-semibold text-[var(--text-secondary)]">
            {t("passwordLabel")}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className="field"
            aria-invalid={Boolean(errors.password)}
            aria-describedby="password-rules"
            {...register("password")}
          />
          <p id="password-rules" className="text-xs text-[var(--text-muted)]">
            {t("rules")}
          </p>
          {errors.password && (
            <p className="text-xs text-red-500" role="alert">
              {errors.password.message}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm" className="text-xs font-semibold text-[var(--text-secondary)]">
            {t("confirmLabel")}
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            className="field"
            aria-invalid={Boolean(errors.confirm)}
            {...register("confirm")}
          />
          {errors.confirm && (
            <p className="text-xs text-red-500" role="alert">
              {t("mismatch")}
            </p>
          )}
        </div>

        {failure && (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-red-500" role="alert">
              {failure}
            </p>
            <Link
              href="/forgot-password"
              className="text-xs font-semibold text-primary-600 transition-colors hover:text-primary-700"
            >
              {t("requestNew")}
            </Link>
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isSubmitting ? t("submitting") : t("submit")}
        </button>
      </form>
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  // `useSearchParams` needs a Suspense boundary to keep the route statically
  // renderable — same shape as /verify-email.
  return (
    <Suspense fallback={null}>
      <ResetPasswordContent />
    </Suspense>
  );
}
