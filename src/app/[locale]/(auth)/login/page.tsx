"use client";
import { useRef, useState, Suspense } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  IDENTIFIER_TYPES,
  LoginSchema,
  type IdentifierType,
  type LoginFormValues,
} from "@/lib/auth/auth.schemas";
import { loginAndGetAction, logoutAndRedirect } from "@/lib/auth/auth.service";
import type { UiRole, AuthRoleEntity } from "@/lib/auth/auth.types";
import { mapApiErrors, parseRootType } from "@/lib/auth/form-errors";
import { sanitizePayload } from "@/lib/form/sanitize-payload";
import AuthSplitShell from "@/components/auth/AuthSplitShell";
import AuthFormField from "@/components/auth/AuthFormField";
import { PhoneField } from "@/components/ui/phone";
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

/**
 * Picks which kind of identifier is being entered.
 *
 * Sign-in accepts a phone number or an email, and the two need different
 * inputs — a phone needs the country selector and E.164 normalisation that the
 * rest of the app uses, an email must not get either. Asking up front is what
 * lets both be handled properly instead of guessing from the typed characters.
 *
 * Radio semantics with a roving tabindex: one tab stop for the group, arrows
 * move between the options, which is what a segmented control should do.
 */
function IdentifierTypeToggle({
  value,
  onChange,
  labels,
  groupLabel,
}: {
  value: IdentifierType;
  onChange: (next: IdentifierType) => void;
  labels: Record<IdentifierType, string>;
  groupLabel: string;
}) {
  const refs = useRef<Partial<Record<IdentifierType, HTMLButtonElement | null>>>({});

  const move = (delta: number) => {
    const index = IDENTIFIER_TYPES.indexOf(value);
    const next =
      IDENTIFIER_TYPES[
        (index + delta + IDENTIFIER_TYPES.length) % IDENTIFIER_TYPES.length
      ];
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={groupLabel}
      className="inline-flex rounded-full bg-[var(--bg-subtle)] p-0.5"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      {IDENTIFIER_TYPES.map((type) => {
        const selected = type === value;
        return (
          <button
            key={type}
            ref={(node) => {
              refs.current[type] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(type)}
            className={[
              "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
              selected
                ? "bg-[var(--surface)] text-primary-600 shadow-[var(--shadow-sm)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
            ].join(" ")}
          >
            {labels[type]}
          </button>
        );
      })}
    </div>
  );
}

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
    control,
    handleSubmit,
    setError,
    clearErrors,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(LoginSchema),
    defaultValues: { identifier_type: "phone", identifier: "", password: "" },
  });

  const identifierType = watch("identifier_type");

  /**
   * Clears the identifier field and any global error together.
   *
   * Two calls rather than one array: `clearErrors` types "root" separately
   * from field paths, so a mixed array only compiles behind a cast.
   */
  const clearIdentifierErrors = () => {
    clearErrors("identifier");
    clearErrors("root");
  };

  /** Switching kind clears the value — a phone number is not a draft email. */
  const handleIdentifierType = (next: IdentifierType) => {
    setValue("identifier_type", next);
    setValue("identifier", "");
    clearIdentifierErrors();
  };

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
      // `identifier_type` picks the input; the backend only wants the
      // identifier itself, already normalised to E.164 by LoginSchema.
      const credentials = {
        identifier: data.identifier,
        password: data.password,
      };

      const payload = sanitizePayload({
        ...credentials,
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

            {/* Identifier — phone or email, each with the input it deserves. */}
            <div className="flex flex-col gap-2">
              <IdentifierTypeToggle
                value={identifierType}
                onChange={handleIdentifierType}
                groupLabel={t("identifierTypeLabel")}
                labels={{
                  phone: t("identifierTypePhone"),
                  email: t("identifierTypeEmail"),
                }}
              />

              {identifierType === "phone" ? (
                <Controller
                  name="identifier"
                  control={control}
                  render={({ field }) => (
                    <PhoneField
                      label={t("phoneLabel")}
                      required
                      autoComplete="username"
                      name={field.name}
                      value={field.value ?? ""}
                      onChange={(next) => {
                        field.onChange(next);
                        clearIdentifierErrors();
                      }}
                      onBlur={field.onBlur}
                      inputRef={field.ref}
                      error={errors.identifier?.message}
                    />
                  )}
                />
              ) : (
                <AuthFormField
                  variant="floating"
                  // Not `emailLabel` — that one is suffixed "(optional)" for
                  // registration, and here it is the credential.
                  label={t("emailLabelLogin")}
                  type="email"
                  autoComplete="username"
                  placeholder={t("emailPlaceholder")}
                  required
                  {...register("identifier", {
                    onChange: () => clearErrors(["identifier", "root"] as any),
                  })}
                  error={errors.identifier?.message}
                />
              )}
            </div>

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
              const { errorCode, requestId, category } = parseRootType(
                errors.root?.type as string | undefined
              );
              return (
                <GlobalError
                  message={errors.root?.message}
                  requestId={requestId}
                  errorCode={errorCode}
                  category={category}
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
