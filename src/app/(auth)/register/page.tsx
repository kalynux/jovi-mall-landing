"use client";
import { useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { RegisterSchema, type RegisterFormValues } from "@/lib/auth/auth.schemas";
import { registerAndRedirect } from "@/lib/auth/auth.service";
import { AuthError } from "@/lib/auth/auth.types";
import type { UiRole } from "@/lib/auth/auth.types";
import AuthCard from "@/components/auth/AuthCard";
import AuthFormField from "@/components/auth/AuthFormField";
import RolePicker from "@/components/auth/RolePicker";
import CustomerWhatsAppCta from "@/components/auth/CustomerWhatsAppCta";

type Step = "role" | "customer-wa" | "form";

function RegisterFormContent() {
  const t = useTranslations("auth");
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");

  const isValidRole = (r: string | null): r is UiRole =>
    r !== null && ["vendor", "agency", "agent", "customer"].includes(r);

  const initialRole: UiRole = isValidRole(roleParam) ? roleParam : "vendor";
  const initialStep: Step = isValidRole(roleParam)
    ? roleParam === "customer"
      ? "customer-wa"
      : "form"
    : "role";

  const [selectedRole, setSelectedRole] = useState<UiRole>(initialRole);
  const [step, setStep] = useState<Step>(initialStep);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { role: initialRole },
  });

  const handleRoleSelect = (role: UiRole) => {
    setSelectedRole(role);
    if (role === "customer") {
      setStep("customer-wa");
    } else {
      setStep("form");
    }
  };

  const handleBackToRole = () => {
    // Returns to role picker WITHOUT resetting form values (preserves user input)
    setStep("role");
  };

  const onSubmit = async (data: RegisterFormValues) => {
    setServerError(null);
    try {
      await registerAndRedirect({ ...data, role: selectedRole });
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
      ? t("registerTitle")
      : step === "customer-wa"
      ? t("customerWaTitle")
      : t("registerSubtitleForm");

  const cardSubtitle =
    step === "role"
      ? t("registerSubtitle")
      : step === "customer-wa"
      ? t("customerWaSubtitle")
      : `${t("registeringAs")} ${selectedRole}`;

  return (
    <AuthCard title={cardTitle} subtitle={cardSubtitle}>
      <div className="flex flex-col gap-6">

        {/* ── Step 1: Role picker ────────────────────────────────────── */}
        {step === "role" && (
          <RolePicker
            selected={selectedRole}
            onSelect={handleRoleSelect}
            customerCallout
            onCustomerCallout={() => {
              setSelectedRole("customer");
              setStep("customer-wa");
            }}
          />
        )}

        {/* ── Step: Customer → WhatsApp only ────────────────────────── */}
        {step === "customer-wa" && (
          <CustomerWhatsAppCta
            onBack={() => {
              setSelectedRole("vendor");
              setStep("role");
            }}
          />
        )}

        {/* ── Step 2: Registration form (non-customer roles only) ────── */}
        {step === "form" && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="flex flex-col gap-4"
          >
            {/* Role pill + back navigation */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-muted)]">
                {t("registeringAs")}
              </span>
              <button
                type="button"
                onClick={handleBackToRole}
                className="text-xs font-display font-semibold px-2.5 py-1 rounded-full bg-[var(--accent-light)] text-primary-600 hover:bg-primary-100 transition-colors capitalize"
              >
                {selectedRole} ↩
              </button>
            </div>

            {/* Hidden role field */}
            <input type="hidden" value={selectedRole} {...register("role")} />

            <AuthFormField
              label={t("nameLabel")}
              type="text"
              autoComplete="name"
              placeholder={t("namePlaceholder")}
              required
              {...register("name")}
              error={errors.name?.message}
            />

            <AuthFormField
              label={t("phoneLabel")}
              type="tel"
              autoComplete="tel"
              placeholder={t("phonePlaceholderRegister")}
              required
              {...register("phone")}
              error={errors.phone?.message}
            />

            <AuthFormField
              label={t("emailLabel")}
              type="email"
              autoComplete="email"
              placeholder={t("emailPlaceholder")}
              {...register("email")}
              error={errors.email?.message}
            />

            {/* Vendor-only field */}
            {selectedRole === "vendor" && (
              <AuthFormField
                label={t("businessNameLabel")}
                type="text"
                placeholder={t("businessNamePlaceholder")}
                required
                {...register("business_name")}
                error={errors.business_name?.message}
              />
            )}

            {/* Agency-only field */}
            {selectedRole === "agency" && (
              <AuthFormField
                label={t("agencyNameLabel")}
                type="text"
                placeholder={t("agencyNamePlaceholder")}
                required
                {...register("agency_name")}
                error={errors.agency_name?.message}
              />
            )}

            <AuthFormField
              label={t("passwordLabel")}
              type="password"
              autoComplete="new-password"
              placeholder={t("newPasswordPlaceholder")}
              required
              {...register("password")}
              error={errors.password?.message}
            />

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
              {isSubmitting ? t("creatingAccount") : t("createAccount")}
            </button>

            {/* Explicit back button for accessibility */}
            <button
              type="button"
              onClick={handleBackToRole}
              className="text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] text-center transition-colors"
            >
              ← {t("chooseDifferentRole")}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-[var(--border)] text-center text-sm text-[var(--text-muted)]">
          {t("alreadyAccount")}{" "}
          <Link
            href="/login"
            className="text-primary-600 hover:underline font-medium"
          >
            {t("signInLink")}
          </Link>
        </div>
      </div>
    </AuthCard>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" /></div>}>
      <RegisterFormContent />
    </Suspense>
  );
}
