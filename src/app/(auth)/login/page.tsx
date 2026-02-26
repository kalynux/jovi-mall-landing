"use client";
import { useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { LoginSchema, type LoginFormValues } from "@/lib/auth/auth.schemas";
import { loginAndRedirect } from "@/lib/auth/auth.service";
import { AuthError } from "@/lib/auth/auth.types";
import type { UiRole } from "@/lib/auth/auth.types";
import AuthCard from "@/components/auth/AuthCard";
import AuthFormField from "@/components/auth/AuthFormField";
import RolePicker from "@/components/auth/RolePicker";
import CustomerWhatsAppCta from "@/components/auth/CustomerWhatsAppCta";

type Step = "role" | "customer-wa" | "form";

function LoginFormContent() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const returnParam = searchParams.get("return");

  const [selectedRole, setSelectedRole] = useState<UiRole | null>(null);
  const [step, setStep] = useState<Step>("role");
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(LoginSchema),
  });

  const handleRoleSelect = (role: UiRole) => {
    if (role === "customer") {
      setSelectedRole("customer");
      setStep("customer-wa");
      return;
    }
    setSelectedRole(role);
    setStep("form");
  };

  const handleSkip = () => {
    setStep("form");
  };

  const onSubmit = async (data: LoginFormValues) => {
    setServerError(null);
    try {
      await loginAndRedirect(
        { ...data, role: selectedRole ?? undefined },
        returnParam
      );
    } catch (err) {
      if (err instanceof AuthError) {
        setServerError(err.message);
      } else {
        setServerError(t("genericError"));
      }
    }
  };

  // ── Title / subtitle per step ──────────────────────────────────────────────
  const cardTitle =
    step === "role"
      ? t("loginTitle")
      : step === "customer-wa"
      ? t("customerWaTitle")
      : selectedRole
      ? `${t("signIn")} — ${selectedRole}`
      : t("signIn");

  const cardSubtitle =
    step === "role"
      ? t("loginSubtitle")
      : step === "customer-wa"
      ? t("customerWaSubtitle")
      : t("loginSubtitleForm");

  return (
    <AuthCard title={cardTitle} subtitle={cardSubtitle}>
      {/* ── Step: role picker ─────────────────────────────────────────── */}
      {step === "role" && (
        <RolePicker
          selected={selectedRole}
          onSelect={handleRoleSelect}
          skipMessage={t("skipStep")}
          onSkip={handleSkip}
        />
      )}

      {/* ── Step: customer → WhatsApp only ────────────────────────────── */}
      {step === "customer-wa" && (
        <CustomerWhatsAppCta
          onBack={() => {
            setSelectedRole(null);
            setStep("role");
          }}
        />
      )}

      {/* ── Step: login form ──────────────────────────────────────────── */}
      {step === "form" && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="flex flex-col gap-4"
        >
          {/* Role pill */}
          {selectedRole && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">
                {t("signingInAs")}
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedRole(null);
                  setStep("role");
                }}
                className="text-xs font-display font-semibold px-2.5 py-1 rounded-full bg-[var(--accent-light)] text-primary-600 hover:bg-primary-100 transition-colors capitalize"
              >
                {selectedRole} ↩
              </button>
            </div>
          )}

          <AuthFormField
            label={t("phoneLabelLogin")}
            type="text"
            autoComplete="username"
            placeholder={t("phonePlaceholder")}
            required
            {...register("identifier")}
            error={errors.identifier?.message}
          />

          <div className="flex flex-col gap-1">
            <AuthFormField
              label={t("passwordLabel")}
              type="password"
              autoComplete="current-password"
              placeholder={t("passwordPlaceholder")}
              required
              {...register("password")}
              error={errors.password?.message}
            />
            {/* Forgot password — intentional UX scaffold, non-functional */}
            <button
              type="button"
              onClick={(e) => e.preventDefault()}
              className="self-start text-xs text-[var(--text-muted)] hover:text-primary-600 transition-colors mt-0.5"
              aria-label={t("forgotPasswordAria")}
            >
              {t("forgotPassword")}
            </button>
          </div>

          {/* Server error */}
          {serverError && (
            <div
              role="alert"
              className="rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/20 text-sm text-red-600 font-medium"
            >
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary w-full mt-1 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
            {isSubmitting ? t("signingIn") : t("signIn")}
          </button>

          {!selectedRole && (
            <button
              type="button"
              onClick={() => setStep("role")}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] text-center transition-colors"
            >
              ← {t("chooseDifferentRole")}
            </button>
          )}
        </form>
      )}

      {/* Footer */}
      <div className="mt-6 pt-4 border-t border-[var(--border)] text-center text-sm text-[var(--text-muted)]">
        {t("noAccount")}{" "}
        <Link href="/register" className="text-primary-600 hover:underline font-medium">
          {t("createOne")}
        </Link>
      </div>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" /></div>}>
      <LoginFormContent />
    </Suspense>
  );
}
