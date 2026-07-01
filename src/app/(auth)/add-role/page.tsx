"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { AddRoleSchema, type AddRoleFormValues } from "@/lib/auth/auth.schemas";
import { addRoleAndGetAction, redirectToOnboarding, logoutAndRedirect } from "@/lib/auth/auth.service";
import type { UiRole, AuthRoleEntity } from "@/lib/auth/auth.types";
import { mapApiErrors, parseRootType } from "@/lib/auth/form-errors";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import AuthCard from "@/components/auth/AuthCard";
import AuthFormField from "@/components/auth/AuthFormField";
import { GlobalError } from "@/components/auth/GlobalError";
import RolePicker from "@/components/auth/RolePicker";
import { AnimatePresence, motion } from "framer-motion";
import { WhatsAppVerificationModal } from "@/components/auth/WhatsAppVerificationModal";

type ConfirmState = { newRole: UiRole; redirectUrl: string } | null;

export default function AddRolePage() {
  const t = useTranslations("addRole");
  const tRoles = useTranslations("modal");
  const tAuthMe = useTranslations("authMe");
  const tErrors = useTranslations("errors");

  const { user, role, role_entity, status, waGateRequired } = useAuthGuard();

  const [selectedRole, setSelectedRole] = useState<UiRole | null>(null);
  const [showCustomerCallout, setShowCustomerCallout] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  // WA gate state — set after addRoleAndGetAction returns type === "wa_gate"
  const [waGateData, setWaGateData] = useState<{
    roleEntity: AuthRoleEntity;
    redirectUrl: string;
  } | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AddRoleFormValues>({
    resolver: zodResolver(AddRoleSchema),
  });

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

  // ── WA gate (bypass-via-reload fix) ───────────────────────────────────────
  // useAuthGuard computes waGateRequired from the restoreSession() response,
  // so a direct navigation or hard reload still enforces the gate.
  if (waGateRequired && role_entity) {
    return (
      <WhatsAppVerificationModal
        roleEntity={role_entity}
        onSuccess={() => {
          // After WA verification, send them to their current role's dashboard
          if (role) window.location.href = `/`;
        }}
        onLogout={logoutAndRedirect}
      />
    );
  }

  // ── WA gate from add-role action ───────────────────────────────────────────
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

  // Roles the user already holds (excluding admin — not shown in UI)
  const heldRoles: UiRole[] = (user?.roles ?? []).filter(
    (r): r is UiRole => r !== "admin"
  );

  // The role this session is currently scoped to
  const activeRole = role as UiRole | undefined;

  // Hide roles the user already holds — EXCEPT the active role (shown disabled)
  // const excludedRoles = heldRoles.filter((r) => r !== activeRole);

  const onSubmit = async (data: AddRoleFormValues) => {
    try {
      const { newRole, action } = await addRoleAndGetAction({
        ...data,
        role: selectedRole!,
      });

      if (action.type === "wa_gate") {
        setWaGateData({
          roleEntity: action.roleEntity,
          redirectUrl: action.redirectUrl,
        });
      } else {
        // No WA gate — go directly to confirm screen
        setConfirmState({
          newRole: newRole as UiRole,
          redirectUrl: action.url,
        });
      }
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
            onClick={() => setShowCustomerCallout(false)}
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
          onSelect={setSelectedRole}
          ownedRoles={heldRoles}
          disabledRole={activeRole}
          disabledRoleLabel={tAuthMe("currentBadge")}
          ownedRolesLabel={tAuthMe("ownedBadge")}
          customerCallout
          onCustomerCallout={() => setShowCustomerCallout(true)}
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

              {/* name — required for vendor, agency, agent */}
              <AuthFormField
                label={t("nameLabel")}
                type="text"
                placeholder={t("namePlaceholder")}
                required
                {...register("name")}
                error={errors.name?.message}
                id={`add-role-name-${selectedRole}`}
              />

              {/* business_name — vendor only */}
              {selectedRole === "vendor" && (
                <AuthFormField
                  label={t("businessNameLabel")}
                  type="text"
                  placeholder={t("businessNamePlaceholder")}
                  required
                  {...register("business_name")}
                  error={errors.business_name?.message}
                  id="add-role-business-name"
                />
              )}

              {/* agency_name — agency only */}
              {selectedRole === "agency" && (
                <AuthFormField
                  label={t("agencyNameLabel")}
                  type="text"
                  placeholder={t("agencyNamePlaceholder")}
                  required
                  {...register("agency_name")}
                  error={errors.agency_name?.message}
                  id="add-role-agency-name"
                />
              )}

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
