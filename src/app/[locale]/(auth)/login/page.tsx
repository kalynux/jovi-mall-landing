"use client";
import { useState, Suspense } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  LoginSchema,
  type IdentifierType,
  type LoginFormValues,
} from "@/lib/auth/auth.schemas";
import { loginAndGetRedirect } from "@/lib/auth/auth.service";
import { validateReturnUrl } from "@/lib/auth/auth.redirect";
import { useLocale } from "@/lib/i18n-provider";
import { IS_NATIVE_BUILD } from "@/lib/platform";
import { localePath } from "@/i18n/routing";
import type { UiRole } from "@/lib/auth/auth.types";
import { mapApiErrors, parseRootType } from "@/lib/auth/form-errors";
import { sanitizePayload } from "@/lib/form/sanitize-payload";
import AuthSplitShell from "@/components/auth/AuthSplitShell";
import AuthFormField from "@/components/auth/AuthFormField";
import IdentifierTypeToggle from "@/components/auth/IdentifierTypeToggle";
import { PhoneField } from "@/components/ui/phone";
import { GlobalError } from "@/components/auth/GlobalError";
import RolePicker from "@/components/auth/RolePicker";
import CustomerMagicSignIn from "@/components/auth/CustomerMagicSignIn";

type Step = "role" | "customer" | "form";

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
  const { locale } = useLocale();

  /**
   * Who is asking, and therefore whether the role picker is a question worth
   * putting to them.
   *
   * Two callers already know the answer. The app build is the shop and nothing
   * else — there is no vendor console in the APK — and anything that redirects
   * out of `/shop/**` is a shopper by construction, so the guard and the
   * middleware both append `?role=customer` on the way here (auth.guard.tsx,
   * middleware.ts). For either of them, opening on a four-way choice with only
   * one right answer is a step that exists to be dismissed.
   *
   * Note this is **context, not viewport**: a vendor signing in from the
   * marketing site on the same phone still gets the full picker. The screen
   * size was never what made the question redundant.
   */
  const customerOnly = IS_NATIVE_BUILD || searchParams.get("role") === "customer";

  const [selectedRole, setSelectedRole] = useState<UiRole | null>(
    customerOnly ? "customer" : null
  );
  const [step, setStep] = useState<Step>(customerOnly ? "customer" : "role");

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
      setStep("customer");
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

  /**
   * Where a customer lands once the magic code has set their cookies.
   *
   * The other three roles leave for their own subdomain, so `resolvePostLoginUrl`
   * hands back an absolute URL. A customer's "dashboard" is this very app, so
   * the destination is an internal path — and it has to carry the active locale
   * explicitly, or the middleware re-resolves a bare `/shop` against whatever
   * `NEXT_LOCALE` happens to say rather than the language being read.
   *
   * A full page load, like every other auth handoff here: the session providers
   * resolve on mount, not on route change, so a client-side push would land on
   * the shop still believing nobody is signed in.
   */
  const handleCustomerSignedIn = () => {
    // A `return` from the middleware's gate already carries its locale prefix.
    const safeReturn = validateReturnUrl(returnParam);
    window.location.href = safeReturn ?? localePath(locale, "/shop");
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

      window.location.href = await loginAndGetRedirect(
        payload as typeof data & { role?: UiRole },
        returnParam
      );
    } catch (err) {
      mapApiErrors(err, setError, tErrors);
    }
  };

  // ── Title / subtitle per step ──────────────────────────────────────────────
  /**
   * "Sign in", on every step, and nothing else.
   *
   * It used to be "Welcome back" for a vendor and "No password needed" for a
   * shopper. The first is a greeting, not a name for the screen; the second
   * describes the mechanism — which is the subtitle's job, and the subtitle
   * directly beneath it was already doing that job properly. A card whose
   * heading explains *how* to sign in makes the reader work out *what* the
   * screen is from the form underneath.
   *
   * The eyebrow pill is gone with it: it said "Sign in" too, and the title is
   * the better place for the only two words this screen needs.
   */
  const cardTitle = t("signIn");

  /**
   * The customer step used to stack three sentences before the first field: a
   * six-word title, a subtitle about shopping accounts, and then the actual
   * instruction inside the form. On a phone that is most of the screen spent
   * saying one thing three ways.
   *
   * It is one instruction now, and it is the subtitle — so the form below opens
   * on the identifier field. The instruction differs by platform: a magic link
   * opens the phone's browser, not this WebView, so the app is only told about
   * the half that works there.
   */
  const cardSubtitle =
    step === "role"
      ? t("loginSubtitle")
      : step === "customer"
        ? IS_NATIVE_BUILD
          ? t("customerSignInCodeIntroApp")
          : t("customerSignInCodeIntroWeb")
        : t("loginSubtitleForm");

  // The customer branch is a whole different sign-in — a bot-issued link or
  // code, no password anywhere — so the two-step role/details rail does not
  // describe it and is not shown on it.
  const showSteps = step !== "customer";

  return (
    <AuthSplitShell
      mode="login"
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
            <Link
              href={customerOnly ? "/register?role=customer" : "/register"}
              className="font-medium text-primary-600 hover:underline"
            >
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

        {/* ── Step: customer → passwordless, via the bot ──────────────────── */}
        {step === "customer" && (
          <motion.div key="customer" {...stepMotion}>
            <CustomerMagicSignIn
              onSignedIn={handleCustomerSignedIn}
              /* The escape hatch, and the reason `customerOnly` skips the
                 picker rather than deleting it: a vendor who followed a shop
                 link, or who simply bookmarked `?role=customer`, is one tap
                 from the choice they actually wanted. Absent in the app, where
                 there is no other role to reach. */
              onBack={IS_NATIVE_BUILD ? undefined : handleBackToRole}
              backLabel={customerOnly ? t("signInOtherRole") : undefined}
            />
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
              {/* A dead button until now — `POST /auth/forgot-password` did not
                  exist, and the aria-label said so. It exists, so this is a link. */}
              <Link
                href="/forgot-password"
                className="self-end text-xs text-[var(--text-muted)] transition-colors hover:text-primary-600"
                aria-label={t("forgotPasswordAria")}
              >
                {t("forgotPassword")}
              </Link>
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

            {/* One action, one aside. Registration used to sit beside sign-in
                as a second solid button, which gave the page two things of
                equal weight to choose between; it now reads as the quiet
                alternative it is, in the same key as "Forgot password?". */}
            <div className="mt-1 flex flex-col gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? t("signingIn") : t("signIn")}
                {!isSubmitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              </button>
              <Link
                href="/register"
                className="self-center text-xs text-[var(--text-muted)] transition-colors hover:text-primary-600"
              >
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
