"use client";
import { useState, Suspense } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useLocalizedResolver } from "@/lib/auth/useLocalizedResolver";
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
import { addRoleReturnPath, validateReturnUrl } from "@/lib/auth/auth.redirect";
import { errorCodeOf } from "@/lib/auth/error-translator";
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

  /**
   * The role a correct password was just refused for — see the note in
   * `onSubmit` — and, once the visitor accepts the way round it, the role to
   * add after they sign in with one the account does hold.
   *
   * Two pieces of state rather than one because they mean different things: the
   * first only words the banner, the second changes where signing in lands.
   * Nothing sets the second without a click.
   */
  const [missingRole, setMissingRole] = useState<UiRole | null>(null);
  const [addRoleAfterSignIn, setAddRoleAfterSignIn] = useState<UiRole | null>(null);

  /**
   * Where signing in goes. The `?return=` the page arrived with, unless the
   * visitor has since asked to add a role — that request is newer and was made
   * on this screen, so it wins.
   */
  const effectiveReturn = addRoleAfterSignIn
    ? addRoleReturnPath(locale, addRoleAfterSignIn)
    : returnParam;

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
    resolver: useLocalizedResolver(zodResolver(LoginSchema)),
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
    const safeReturn = validateReturnUrl(effectiveReturn);
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
        effectiveReturn
      );
    } catch (err) {
      mapApiErrors(err, setError, tErrors);

      /**
       * `AUTH_ROLE_NOT_FOUND` here means the password was RIGHT and the account
       * simply lacks the role picked — and only that. The backend answers it
       * after `bcrypt.compare` and after the status checks (AuthService.login),
       * so reaching it already proves the credential, and telling this visitor
       * about their own account's roles gives nothing away. A wrong password
       * never gets this far: it is `AUTH_INVALID_CREDENTIALS`, and must stay the
       * one answer for every other failure.
       *
       * The shared `errors.AUTH_ROLE_NOT_FOUND` stays generic on purpose — it is
       * also what `requireRole` answers for any 403 anywhere in the API.
       *
       * Remembered by value rather than read from `selectedRole` at render:
       * going back to the picker changes `selectedRole`, and the banner must
       * keep naming the role that was actually refused.
       */
      setMissingRole(errorCodeOf(err) === "AUTH_ROLE_NOT_FOUND" ? selectedRole : null);
    }
  };

  /**
   * Back to the picker to sign in with a role the account does hold, carrying
   * the refused one forward so signing in ends on `/add-role` with it chosen.
   *
   * The phone/email and password stay filled in — `handleBackToRole` only
   * changes the step, and react-hook-form keeps values across the unmount —
   * so the second attempt is one tap on the right role and one on "Sign in".
   */
  const handleAddMissingRole = () => {
    setAddRoleAfterSignIn(missingRole);
    clearErrors("root");
    handleBackToRole();
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
  // After "choose the role you already use", the picker's usual question is
  // replaced by what happens next, so the detour reads as a step forward.
  const cardSubtitle =
    step === "role"
      ? addRoleAfterSignIn
        ? t("roleMissing.pickerSubtitle", {
            role: tModal(`roles.${addRoleAfterSignIn}.label` as Parameters<typeof tModal>[0]),
          })
        : t("loginSubtitle")
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
            className="flex flex-col gap-7"
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
            <div className="flex flex-col gap-3">
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
                    onChange: () => { clearErrors("identifier"); clearErrors("root"); },
                  })}
                  error={errors.identifier?.message}
                />
              )}
            </div>

            <div className="flex flex-col gap-2">
              <AuthFormField
                variant="floating"
                label={t("passwordLabel")}
                type="password"
                autoComplete="current-password"
                placeholder={t("passwordPlaceholder")}
                required
                {...register("password", {
                  onChange: () => { clearErrors("password"); clearErrors("root"); },
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
              // See the note in `onSubmit` for why naming the role is safe here.
              const refused = errorCode === "AUTH_ROLE_NOT_FOUND" ? missingRole : null;
              return (
                <GlobalError
                  message={
                    refused
                      ? t("roleMissing.body", {
                          role: tModal(`roles.${refused}.label` as Parameters<typeof tModal>[0]),
                        })
                      : errors.root?.message
                  }
                  requestId={requestId}
                  errorCode={errorCode}
                  category={category}
                  action={
                    refused ? (
                      <button
                        type="button"
                        onClick={handleAddMissingRole}
                        className="inline-flex items-center gap-1.5 font-semibold underline underline-offset-4 hover:text-red-700"
                      >
                        {t("roleMissing.action")}
                        <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden="true" />
                      </button>
                    ) : undefined
                  }
                />
              );
            })()}

            {/* One action, one aside. Registration used to sit beside sign-in
                as a second solid button, which gave the page two things of
                equal weight to choose between; it now reads as the quiet
                alternative it is, in the same key as "Forgot password?".

                Quiet is not the same as cramped, though. At `text-xs` and 12px
                under a full-width button it sat inside the button's glow, which
                made the one escape route off this screen both hard to read and
                hard to hit. It keeps the secondary weight and gets the size and
                the clearance of something meant to be used. */}
            <div className="mt-2 flex flex-col gap-6">
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
                className="self-center px-2 py-1 text-sm font-medium text-[var(--text-secondary)] underline-offset-4 transition-colors hover:text-primary-600 hover:underline"
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
