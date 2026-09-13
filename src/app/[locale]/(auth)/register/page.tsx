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
  RegisterSchema,
  BUSINESS_NAME_MAX,
  ROLES_WITH_BUSINESS_NAME,
  type RegisterFormValues,
} from "@/lib/auth/auth.schemas";
import { registerAndGetRedirect } from "@/lib/auth/auth.service";
import { isUiRole, type UiRole } from "@/lib/auth/auth.types";
import { mapApiErrors, parseRootType } from "@/lib/auth/form-errors";
import { sanitizePayload } from "@/lib/form/sanitize-payload";
import AuthSplitShell from "@/components/auth/AuthSplitShell";
import AuthFormField from "@/components/auth/AuthFormField";
import { PhoneField } from "@/components/ui/phone";
import { GlobalError } from "@/components/auth/GlobalError";
import RolePicker from "@/components/auth/RolePicker";
import CustomerWhatsAppCta from "@/components/auth/CustomerWhatsAppCta";
import { IS_NATIVE_BUILD } from "@/lib/platform";

type Step = "role" | "customer-wa" | "form";

/** Shared entrance for whichever step is on screen. */
const stepMotion = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
};

function RegisterFormContent() {
  const t = useTranslations("auth");
  const tModal = useTranslations("modal");
  const tErrors = useTranslations("errors");
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");

  /**
   * Customer-only entry, on the same rule the sign-in page uses.
   *
   * `?role=customer` is what the shop's own links carry, and the app build is
   * the shop and nothing else — there is no vendor console in the APK. For
   * either, the four-way picker is a question with one right answer.
   *
   * Context, not viewport: a vendor registering from the marketing site on a
   * phone still gets the full picker.
   */
  const customerOnly = IS_NATIVE_BUILD || roleParam === "customer";

  const initialRole: UiRole = isUiRole(roleParam)
    ? roleParam
    : customerOnly
      ? "customer"
      : "vendor";

  const initialStep: Step = customerOnly
    ? "customer-wa"
    : isUiRole(roleParam)
      ? "form"
      : "role";

  const [selectedRole, setSelectedRole] = useState<UiRole>(initialRole);
  const [step, setStep] = useState<Step>(initialStep);

  const {
    register,
    control,
    handleSubmit,
    setError,
    clearErrors,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(RegisterSchema),
    // `phone` must start as "" rather than undefined — PhoneField is a
    // controlled input and would otherwise flip from uncontrolled on first key.
    defaultValues: { role: initialRole, phone: "" },
  });

  // NOTE: `initialRole` / `initialStep` are useState initialisers, so they run
  // once at mount and never re-read the param. That is fine because there is no
  // path from /register?role=x to /register?role=y without an unmount — the
  // auth shell carries no Navbar and no role picker modal (AuthShell.tsx), so
  // every link into this page comes from another route.
  //
  // Vendor/agency give two distinct names: their own (stored on the role
  // profile as display_name) and their business name (stored on their Store /
  // Magazin). Every other role gives one name, so the extra labelling is dropped.
  const hasBusinessName = ROLES_WITH_BUSINESS_NAME.includes(selectedRole);

  const handleRoleSelect = (role: UiRole) => {
    setSelectedRole(role);
    setValue("role", role); // keep RHF internal state in sync so Zod superRefine validates the correct role
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
    // Clear any stale global error before each attempt
    clearErrors("root");

    try {
      // sanitizePayload trims strings and drops empty/null/undefined fields.
      // Critically this removes email: "" when the optional field is left blank,
      // preventing the backend from receiving an invalid empty-string email.
      const payload = sanitizePayload({
        ...data,
        role: selectedRole,
      });

      // ⚠ THE RULE IS WRONG HERE, PERMANENTLY — see the same note in
      //   (auth)/auth-me/page.tsx. Assigning window.location.href is a full page
      //   navigation, not a mutation of React state, and the new account's session
      //   must be loaded fresh rather than carried over client-side.
      // eslint-disable-next-line react-hooks/immutability
      window.location.href = await registerAndGetRedirect(payload as RegisterFormValues);
    } catch (err) {
      mapApiErrors(err, setError, tErrors);
    }
  };

  // ── Title / subtitle per step ──────────────────────────────────────────────
  const cardTitle =
    step === "customer-wa" ? t("customerWaTitle") : t("registerTitle");

  const cardSubtitle =
    step === "role"
      ? t("registerSubtitle")
      : step === "customer-wa"
        ? t("customerWaSubtitle")
        : t("registerSubtitleForm");

  // Customers never reach the details step — they shop on WhatsApp — so the
  // two-step rail is only shown on the path it actually describes.
  const showSteps = step !== "customer-wa";

  return (
    <AuthSplitShell
      mode="register"
      eyebrow={t("createAccount")}
      title={cardTitle}
      subtitle={cardSubtitle}
      steps={showSteps ? [t("stepRole"), t("stepDetails")] : undefined}
      currentStep={step === "role" ? 1 : 2}
      onStepSelect={handleBackToRole}
      // `selectedRole` defaults to "vendor" so the form has something to
      // validate against, but nothing has actually been chosen on the picker
      // step — the showcase stays on its generic pitch until it has.
      role={step === "role" ? null : selectedRole}
      footer={
        // On the form step the "Sign in" button below already carries this, so
        // it isn't repeated here.
        step === "form" ? undefined : (
          <>
            {t("alreadyAccount")}{" "}
            <Link href="/login" className="font-medium text-primary-600 hover:underline">
              {t("signInLink")}
            </Link>
          </>
        )
      }
    >
      <AnimatePresence mode="wait">
        {/* ── Step 1: Role picker ─────────────────────────────────────────── */}
        {step === "role" && (
          <motion.div key="role" {...stepMotion}>
            <RolePicker
              selected={selectedRole}
              onSelect={handleRoleSelect}
              customerCallout
              onCustomerCallout={() => {
                setSelectedRole("customer");
                setStep("customer-wa");
              }}
            />
          </motion.div>
        )}

        {/* ── Step: Customer → WhatsApp only ──────────────────────────────── */}
        {step === "customer-wa" && (
          <motion.div key="customer-wa" {...stepMotion}>
            <CustomerWhatsAppCta
              /* The escape hatch back to the picker, absent in the app —
                 there is no other role to register for in a shop bundle. */
              onBack={
                IS_NATIVE_BUILD
                  ? undefined
                  : () => {
                      setSelectedRole("vendor");
                      setStep("role");
                    }
              }
              backLabel={customerOnly ? t("signInOtherRole") : undefined}
            />
          </motion.div>
        )}

        {/* ── Step 2: Registration form (non-customer roles only) ─────────── */}
        {step === "form" && (
          <motion.form
            key="form"
            {...stepMotion}
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
                className="rounded-full bg-[var(--accent-light)] px-2.5 py-1 font-display text-xs font-semibold capitalize text-primary-600 transition-colors hover:bg-primary-100"
              >
                {tModal(`roles.${selectedRole}.label` as Parameters<typeof tModal>[0])} ↩
              </button>
            </div>

            {/* Hidden role field */}
            <input type="hidden" value={selectedRole} {...register("role")} />

            {/* One column at every width. The two-column arrangement this
                replaced saved vertical space but paired unrelated fields side
                by side, and the descriptions that explain them now live in
                tooltips rather than under each field — so the column no longer
                runs long enough to be worth splitting. */}
            <div className="flex flex-col gap-4">
              {/*
                Personal name — lands on the role profile itself (display_name for
                vendor/agency, name for agent). Vendors and agencies additionally
                give a business name below, which the backend stores on a separate
                document, so the two fields are labelled distinctly for them.
              */}
              <AuthFormField
                variant="floating"
                label={hasBusinessName ? t("personalNameLabel") : t("nameLabel")}
                type="text"
                autoComplete="name"
                placeholder={t("namePlaceholder")}
                required
                hint={hasBusinessName ? t("personalNameHint") : undefined}
                {...register("name", {
                  onChange: () => { clearErrors("name"); clearErrors("root"); },
                })}
                error={errors.name?.message}
              />

              {/*
                Phone is the login identifier, so it is the one field that must
                be unambiguous: PhoneField validates against the selected
                country's numbering plan and hands RegisterSchema a value it
                normalises to E.164 before submit.
              */}
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <PhoneField
                    label={t("phoneLabel")}
                    required
                    name={field.name}
                    value={field.value ?? ""}
                    onChange={(next) => {
                      field.onChange(next);
                      clearErrors("phone");
                      clearErrors("root");
                    }}
                    onBlur={field.onBlur}
                    inputRef={field.ref}
                    error={errors.phone?.message}
                  />
                )}
              />

              {/*
                Required for a vendor, optional for agency and agent — see the
                long note in RegisterSchema: api-doc says optional for all four,
                the vendor model says otherwise, and the backend answers 500
                rather than 400 when they disagree.

                The label follows suit, so it never reads "(optional) *".
                sanitizePayload drops the field when left blank, so the backend
                never receives an empty-string email.
              */}
              <AuthFormField
                variant="floating"
                label={
                  selectedRole === "vendor" ? t("emailLabelLogin") : t("emailLabel")
                }
                type="email"
                autoComplete="email"
                placeholder={t("emailPlaceholder")}
                required={selectedRole === "vendor"}
                {...register("email", {
                  onChange: () => { clearErrors("email"); clearErrors("root"); },
                })}
                error={errors.email?.message}
              />

              {/*
                Vendor-only. This is NOT saved on the vendor profile — the backend
                seeds it onto the vendor's Store, which is the source of truth for
                the public business name (2–100 chars, enforced by RegisterSchema).
              */}
              {selectedRole === "vendor" && (
                <AuthFormField
                  variant="floating"
                  label={t("businessNameLabel")}
                  type="text"
                  autoComplete="organization"
                  placeholder={t("businessNamePlaceholder")}
                  required
                  maxLength={BUSINESS_NAME_MAX}
                  hint={t("businessNameHint")}
                  {...register("business_name", {
                    onChange: () => { clearErrors("business_name"); clearErrors("root"); },
                  })}
                  error={errors.business_name?.message}
                />
              )}

              {/* Agency-only. Same split — seeds the agency's Magazin, not the profile. */}
              {selectedRole === "agency" && (
                <AuthFormField
                  variant="floating"
                  label={t("agencyNameLabel")}
                  type="text"
                  autoComplete="organization"
                  placeholder={t("agencyNamePlaceholder")}
                  required
                  maxLength={BUSINESS_NAME_MAX}
                  hint={t("agencyNameHint")}
                  {...register("agency_name", {
                    onChange: () => { clearErrors("agency_name"); clearErrors("root"); },
                  })}
                  error={errors.agency_name?.message}
                />
              )}

              <AuthFormField
                variant="floating"
                label={t("passwordLabel")}
                type="password"
                autoComplete="new-password"
                placeholder={t("newPasswordPlaceholder")}
                required
                {...register("password", {
                  onChange: () => { clearErrors("password"); clearErrors("root"); },
                })}
                error={errors.password?.message}
              />
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

            {/* One action, one aside — the mirror of the sign-in screen.
                Signing in is the quiet alternative here, so it carries the
                weight of a link rather than a second solid button. */}
            <div className="mt-1 flex flex-col gap-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isSubmitting ? t("creatingAccount") : t("createAccount")}
                {!isSubmitting && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
              </button>
              <Link
                href="/login"
                className="self-center text-xs text-[var(--text-muted)] transition-colors hover:text-primary-600"
              >
                {t("signInLink")}
              </Link>
            </div>

            {/* Explicit back button for accessibility */}
            <button
              type="button"
              onClick={handleBackToRole}
              className="flex items-center justify-center gap-1.5 text-sm text-[var(--text-muted)] transition-colors hover:text-[var(--text-primary)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {t("chooseDifferentRole")}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </AuthSplitShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
        </div>
      }
    >
      <RegisterFormContent />
    </Suspense>
  );
}
