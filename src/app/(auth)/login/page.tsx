"use client";
import { useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { LoginSchema, type LoginFormValues } from "@/lib/auth/auth.schemas";
import { loginAndGetAction, logoutAndRedirect } from "@/lib/auth/auth.service";
import type { UiRole, AuthRoleEntity } from "@/lib/auth/auth.types";
import { mapApiErrors, parseRootType } from "@/lib/auth/form-errors";
import { sanitizePayload } from "@/lib/form/sanitize-payload";
import AuthSplitShell from "@/components/auth/AuthSplitShell";
import AuthFormField from "@/components/auth/AuthFormField";
import { GlobalError } from "@/components/auth/GlobalError";
import RolePicker from "@/components/auth/RolePicker";
import CustomerWhatsAppCta from "@/components/auth/CustomerWhatsAppCta";
import { WhatsAppVerificationModal } from "@/components/auth/WhatsAppVerificationModal";

type Step = "role" | "customer-wa" | "form";

/** Shared entrance for whichever step is on screen. */
const stepMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
};

function LoginFormContent() {
  const t = useTranslations("auth");
  const tModal = useTranslations("modal");
  const tErrors = useTranslations("errors");
  const searchParams = useSearchParams();
  const returnParam = searchParams.get("return");

  const [selectedRole, setSelectedRole] = useState<UiRole | null>(null);
  const [step, setStep] = useState<Step>("role");

  // WA gate state — set when loginAndGetAction returns type === "wa_gate"
  const [waGateData, setWaGateData] = useState<{
    roleEntity: AuthRoleEntity;
    redirectUrl: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
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

  /** Back to the role picker, dropping the role the form is scoped to. */
  const handleBackToRole = () => {
    setSelectedRole(null);
    setStep("role");
  };

  const onSubmit = async (data: LoginFormValues) => {
    clearErrors("root");

    try {
      const payload = sanitizePayload({
        ...data,
        role: selectedRole ?? undefined,
      });

      const action = await loginAndGetAction(
        payload as typeof data & { role?: UiRole },
        returnParam
      );

      if (action.type === "redirect") {
        window.location.href = action.url;
      } else {
        // WA gate triggered — show modal instead of redirecting
        setWaGateData({
          roleEntity: action.roleEntity,
          redirectUrl: action.redirectUrl,
        });
      }
    } catch (err) {
      mapApiErrors(err, setError, tErrors);
    }
  };

  // ── WA verification gate overlay ─────────────────────────────────────────
  if (waGateData) {
    return (
      <WhatsAppVerificationModal
        roleEntity={waGateData.roleEntity}
        onSuccess={() => {
          window.location.href = waGateData.redirectUrl;
        }}
        onLogout={logoutAndRedirect}
      />
    );
  }

  // ── Title / subtitle per step ──────────────────────────────────────────────
  const cardTitle =
    step === "customer-wa" ? t("customerWaTitle") : t("welcomeBack");

  const cardSubtitle =
    step === "role"
      ? t("loginSubtitle")
      : step === "customer-wa"
        ? t("customerWaSubtitle")
        : t("loginSubtitleForm");

  // The customer branch leaves the sign-in path entirely (they shop on
  // WhatsApp), so the two-step rail is only shown on the path it describes.
  const showSteps = step !== "customer-wa";

  return (
    <AuthSplitShell
      mode="login"
      eyebrow={t("signIn")}
      title={cardTitle}
      subtitle={cardSubtitle}
      steps={showSteps ? [t("stepRole"), t("stepDetails")] : undefined}
      currentStep={step === "role" ? 1 : 2}
      onStepSelect={handleBackToRole}
      role={selectedRole}
      footer={
        // On the form step the "Create account" button below already carries
        // this, so it isn't repeated here.
        step === "form" ? undefined : (
          <>
            {t("noAccount")}{" "}
            <Link href="/register" className="font-medium text-primary-600 hover:underline">
              {t("createOne")}
            </Link>
          </>
        )
      }
    >
      <AnimatePresence mode="wait">
        {/* ── Step: role picker ───────────────────────────────────────────── */}
        {step === "role" && (
          <motion.div key="role" {...stepMotion}>
            <RolePicker
              selected={selectedRole}
              onSelect={handleRoleSelect}
              skipMessage={t("skipStep")}
              onSkip={handleSkip}
            />
          </motion.div>
        )}

        {/* ── Step: customer → WhatsApp only ──────────────────────────────── */}
        {step === "customer-wa" && (
          <motion.div key="customer-wa" {...stepMotion}>
            <CustomerWhatsAppCta onBack={handleBackToRole} />
          </motion.div>
        )}

        {/* ── Step: login form ────────────────────────────────────────────── */}
        {step === "form" && (
          <motion.form
            key="form"
            {...stepMotion}
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
                  onClick={handleBackToRole}
                  className="rounded-full bg-[var(--accent-light)] px-2.5 py-1 font-display text-xs font-semibold capitalize text-primary-600 transition-colors hover:bg-primary-100"
                >
                  {tModal(`roles.${selectedRole}.label` as Parameters<typeof tModal>[0])} ↩
                </button>
              </div>
            )}

            <AuthFormField
              variant="floating"
              label={t("phoneLabelLogin")}
              type="text"
              autoComplete="username"
              placeholder={t("phonePlaceholder")}
              required
              {...register("identifier", {
                onChange: () => clearErrors(["identifier", "root"] as any),
              })}
              error={errors.identifier?.message}
            />

            <div className="flex flex-col gap-1.5">
              <AuthFormField
                variant="floating"
                label={t("passwordLabel")}
                type="password"
                autoComplete="current-password"
                placeholder={t("passwordPlaceholder")}
                required
                {...register("password", {
                  onChange: () => clearErrors(["password", "root"] as any),
                })}
                error={errors.password?.message}
              />
              <button
                type="button"
                onClick={(e) => e.preventDefault()}
                className="self-end text-xs text-[var(--text-muted)] transition-colors hover:text-primary-600"
                aria-label={t("forgotPasswordAria")}
              >
                {t("forgotPassword")}
              </button>
            </div>

            {(() => {
              const { errorCode, requestId } = parseRootType(
                errors.root?.type as string | undefined
              );
              return (
                <GlobalError
                  message={errors.root?.message}
                  requestId={requestId}
                  errorCode={errorCode}
                />
              );
            })()}

            {/* Action pair — sign in, or peel off to registration. */}
            <div className="mt-1 grid gap-3 sm:grid-cols-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? t("signingIn") : t("signIn")}
                {!isSubmitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              </button>
              <Link href="/register" className="btn-secondary w-full">
                {t("createAccount")}
              </Link>
            </div>

            {!selectedRole && (
              <button
                type="button"
                onClick={() => setStep("role")}
                className="flex items-center justify-center gap-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                {t("chooseDifferentRole")}
              </button>
            )}
          </motion.form>
        )}
      </AnimatePresence>
    </AuthSplitShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
        </div>
      }
    >
      <LoginFormContent />
    </Suspense>
  );
}
