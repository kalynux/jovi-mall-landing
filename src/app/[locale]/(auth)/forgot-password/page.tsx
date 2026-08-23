"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import AuthCard from "@/components/auth/AuthCard";
import { forgotPassword } from "@/lib/auth/auth.api";
import { ForgotPasswordSchema, type ForgotPasswordFormValues } from "@/lib/auth/auth.schemas";

/**
 * Request a password reset link.
 *
 * ⚠️ **This screen must look identical whether or not the account exists.** The
 * endpoint always answers 200 precisely so that it cannot be used to discover
 * which phone numbers and emails are registered, and a UI that said "no account
 * found" would hand that back — the enumeration oracle would be here rather than
 * in the API, which is no better.
 *
 * So: one success screen, always, and the copy says "if an account exists".
 * Errors that are *not* about the identifier (network, rate limit) still surface,
 * because those are about the request, not about who holds an account.
 *
 * A note on what this buys today: password reset is correct and complete, but
 * `POST /api/auth/login` currently discards the result of its `bcrypt.compare`,
 * so any password authenticates any account. Until that one line is restored,
 * this flow is a usability fix, not a security one — see the warning at the top
 * of `api-doc/auth/README.md`.
 */
export default function ForgotPasswordPage() {
  const t = useTranslations("forgotPassword");
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: { identifier: "" },
  });

  const onSubmit = handleSubmit(async ({ identifier }) => {
    setFailure(null);
    try {
      await forgotPassword(identifier);
      setSent(true);
    } catch {
      // Deliberately generic, and deliberately NOT "no such account" — the
      // endpoint does not distinguish, and neither may this.
      setFailure(t("failed"));
    }
  });

  if (sent) {
    return (
      <AuthCard title={t("sentTitle")}>
        <div className="flex flex-col items-center gap-4 py-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10">
            <CheckCircle2 className="h-7 w-7 text-green-500" aria-hidden="true" />
          </div>
          <p className="text-sm text-[var(--text-secondary)]" aria-live="polite">
            {t("sentBody")}
          </p>
          <p className="text-xs text-[var(--text-muted)]">{t("sentHint")}</p>
          <Link
            href="/login"
            className="mt-2 text-sm font-semibold text-primary-600 transition-colors hover:text-primary-700"
          >
            {t("backToLogin")}
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="identifier"
            className="text-xs font-semibold text-[var(--text-secondary)]"
          >
            {t("identifierLabel")}
          </label>
          <input
            id="identifier"
            type="text"
            autoComplete="username"
            className="field"
            placeholder={t("identifierPlaceholder")}
            aria-invalid={Boolean(errors.identifier)}
            {...register("identifier")}
          />
          {errors.identifier && (
            <p className="text-xs text-red-500" role="alert">
              {t("required")}
            </p>
          )}
        </div>

        {failure && (
          <p className="text-xs text-red-500" role="alert">
            {failure}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {isSubmitting ? t("submitting") : t("submit")}
        </button>

        <Link
          href="/login"
          className="self-center text-xs text-[var(--text-muted)] transition-colors hover:text-primary-600"
        >
          {t("backToLogin")}
        </Link>
      </form>
    </AuthCard>
  );
}
