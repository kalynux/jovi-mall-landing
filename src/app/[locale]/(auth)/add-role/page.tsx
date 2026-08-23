"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import {
  AddRoleSchema,
  BUSINESS_NAME_MAX,
  ROLES_WITH_BUSINESS_NAME,
  type AddRoleFormValues,
} from "@/lib/auth/auth.schemas";
import { addRoleAndGetRedirect, redirectToOnboarding } from "@/lib/auth/auth.service";
import { isUiRole, type UiRole } from "@/lib/auth/auth.types";
import { mapApiErrors, parseRootType } from "@/lib/auth/form-errors";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import AuthCard from "@/components/auth/AuthCard";
import AuthFormField from "@/components/auth/AuthFormField";
import { GlobalError } from "@/components/auth/GlobalError";
import RolePicker from "@/components/auth/RolePicker";
import { AnimatePresence, motion } from "framer-motion";

type ConfirmState = { newRole: UiRole; redirectUrl: string } | null;

function AddRoleContent() {
  const t = useTranslations("addRole");
  const tRoles = useTranslations("modal");
  const tAuthMe = useTranslations("authMe");
  const tErrors = useTranslations("errors");

  const { user, role, status } = useAuthGuard();
  const roleParam = useSearchParams().get("role");

  // Both of these are `null` until the visitor acts, at which point their
  // choice overrides whatever ?role= asked for — see the preselect below.
  const [pickedRole, setPickedRole] = useState<UiRole | null>(null);
  const [calloutOpen, setCalloutOpen] = useState<boolean | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AddRoleFormValues>({
    resolver: zodResolver(AddRoleSchema),
  });

  // ── ?role= preselect ───────────────────────────────────────────────────────
  // Role CTAs across the site send signed-in visitors who do not hold a role
  // here with it already chosen, so the picker step can be skipped.
  //
  // Derived rather than pushed into state from an effect: useAuthGuard resolves
  // `user.roles` asynchronously and the request has to be validated against
  // them, so an effect would mean rendering the wrong thing first. Once the
  // visitor picks anything themselves, their choice wins.
  const requestedRole = isUiRole(roleParam) && status === "authenticated" ? roleParam : null;
  const preselectRole =
    requestedRole &&
    requestedRole !== "customer" &&
    // RolePicker renders already-held roles at 50% opacity but still lets them
    // be clicked (RolePicker.tsx:101-108), so the guard has to live here.
    // Preselecting one would reveal a form whose submit is bound to fail.
    !(user?.roles ?? []).includes(requestedRole)
      ? requestedRole
      : null;

  const selectedRole = pickedRole ?? preselectRole;
  const showCustomerCallout = calloutOpen ?? requestedRole === "customer";

  // ── Loading / guard ────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <AuthCard title={t("title")}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      </AuthCard>
    );
  }

  // Roles the user already holds (excluding admin — not shown in UI)
  const heldRoles: UiRole[] = (user?.roles ?? []).filter(
    (r): r is UiRole => r !== "admin"
  );

  // The role this session is currently scoped to
  const activeRole = role as UiRole | undefined;

  // Vendor/agency give two distinct names: their own (stored on the new role
  // profile as display_name) and their business name (stored on the Store /
  // Magazin provisioned alongside it). Other roles give one name.
  const hasBusinessName =
    selectedRole !== null && ROLES_WITH_BUSINESS_NAME.includes(selectedRole);

  // Hide roles the user already holds — EXCEPT the active role (shown disabled)
  // const excludedRoles = heldRoles.filter((r) => r !== activeRole);

  const onSubmit = async (data: AddRoleFormValues) => {
    try {
      const { newRole, redirectUrl } = await addRoleAndGetRedirect({
        ...data,
        role: selectedRole!,
      });

      setConfirmState({ newRole: newRole as UiRole, redirectUrl });
    } catch (err) {
      mapApiErrors(err, setError, tErrors);
    }
  };

  // ── Post-add-role confirm prompt ───────────────────────────────────────────
  if (confirmState) {
    return (
      <AuthCard
        title={t("confirmTitle")}
        subtitle={t("confirmSubtitle", { role: confirmState.newRole })}
      >
        <div className="flex flex-col items-center gap-5 py-2 text-center">
          <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-green-500" />
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            {t("confirmBody", { role: confirmState.newRole })}
          </p>
          <div className="flex flex-col gap-3 w-full">
            <button
              type="button"
              onClick={() => redirectToOnboarding(confirmState.newRole)}
              className="btn-primary w-full"
            >
              {t("confirmSwitch")}
            </button>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="btn-secondary w-full"
            >
              {t("confirmStay")}
            </button>
          </div>
        </div>
      </AuthCard>
    );
  }

  // ── Customer callout ──────────────────────────────────────────────────────
  if (showCustomerCallout) {
    return (
      <AuthCard
        title={t("customerCalloutTitle")}
        subtitle={t("customerCalloutSubtitle")}
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            {t("customerCalloutBody")}
          </p>
          <button
            type="button"
            onClick={() => setCalloutOpen(false)}
            className="btn-secondary w-full"
          >
            {t("customerCalloutBack")}
          </button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t("title")}
      subtitle={
        heldRoles.length > 0
          ? t("subtitle", { roles: heldRoles.map((r) => tRoles(`roles.${r}.label` as Parameters<typeof t>[0])).join(", ") })
          : t("subtitleEmpty")
      }
    >
      <div className="flex flex-col gap-5">
        <RolePicker
          selected={selectedRole}
          onSelect={setPickedRole}
          ownedRoles={heldRoles}
          disabledRole={activeRole}
          disabledRoleLabel={tAuthMe("currentBadge")}
          ownedRolesLabel={tAuthMe("ownedBadge")}
          customerCallout
          onCustomerCallout={() => setCalloutOpen(true)}
        />

        <AnimatePresence mode="wait">
          {selectedRole && selectedRole !== "customer" && (
            <motion.form
              key={selectedRole}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              onSubmit={handleSubmit(onSubmit)}
              noValidate
              className="flex flex-col gap-4"
            >
              <input
                type="hidden"
                value={selectedRole}
                {...register("role")}
              />

              {/*
                name — required for vendor, agency, agent. Lands on the new role
                profile itself (display_name for vendor/agency, name for agent),
                separate from the business name below.
              */}
              <AuthFormField
                label={hasBusinessName ? t("personalNameLabel") : t("nameLabel")}
                type="text"
                placeholder={t("namePlaceholder")}
                required
                hint={hasBusinessName ? t("personalNameHint") : undefined}
                {...register("name")}
                error={errors.name?.message}
                id={`add-role-name-${selectedRole}`}
              />

              {/* business_name — vendor only. Seeds the new Store, not the vendor profile. */}
              {selectedRole === "vendor" && (
                <AuthFormField
                  label={t("businessNameLabel")}
                  type="text"
                  autoComplete="organization"
                  placeholder={t("businessNamePlaceholder")}
                  required
                  maxLength={BUSINESS_NAME_MAX}
                  hint={t("businessNameHint")}
                  {...register("business_name")}
                  error={errors.business_name?.message}
                  id="add-role-business-name"
                />
              )}

              {/* agency_name — agency only. Seeds the new Magazin, not the agency profile. */}
              {selectedRole === "agency" && (
                <AuthFormField
                  label={t("agencyNameLabel")}
                  type="text"
                  autoComplete="organization"
                  placeholder={t("agencyNamePlaceholder")}
                  required
                  maxLength={BUSINESS_NAME_MAX}
                  hint={t("agencyNameHint")}
                  {...register("agency_name")}
                  error={errors.agency_name?.message}
                  id="add-role-agency-name"
                />
              )}

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

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting
                  ? t("submitting")
                  : t("submitBtn", { role: selectedRole })}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </AuthCard>
  );
}

// useSearchParams needs a Suspense boundary above it or the production build
// fails — same split as register/page.tsx.
export default function AddRolePage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-[var(--text-muted)]" />
        </div>
      }
    >
      <AddRoleContent />
    </Suspense>
  );
}
