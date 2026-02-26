"use client";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, CheckCircle2 } from "lucide-react";
import { AddRoleSchema, type AddRoleFormValues } from "@/lib/auth/auth.schemas";
import { addRoleFlow, redirectToOnboarding } from "@/lib/auth/auth.service";
import { AuthError } from "@/lib/auth/auth.types";
import type { UiRole, Role } from "@/lib/auth/auth.types";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import AuthCard from "@/components/auth/AuthCard";
import AuthFormField from "@/components/auth/AuthFormField";
import RolePicker from "@/components/auth/RolePicker";
import { AnimatePresence, motion } from "framer-motion";

type ConfirmState = { newRole: Role } | null;

export default function AddRolePage() {
  const { user, status } = useAuthGuard();

  const [selectedRole, setSelectedRole] = useState<UiRole | null>(null);
  const [showCustomerCallout, setShowCustomerCallout] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AddRoleFormValues>({
    resolver: zodResolver(AddRoleSchema),
  });

  // ── Loading / guard ────────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <AuthCard title="Add a Role">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      </AuthCard>
    );
  }

  const heldRoles: UiRole[] = (user?.roles ?? []).filter(
    (r): r is UiRole => r !== "admin"
  );

  const onSubmit = async (data: AddRoleFormValues) => {
    setServerError(null);
    try {
      const { newRole } = await addRoleFlow({ ...data, role: selectedRole! });
      setConfirmState({ newRole });
    } catch (err) {
      if (err instanceof AuthError) {
        setServerError(err.message);
      } else {
        setServerError("Something went wrong. Please try again.");
      }
    }
  };

  // ── Post-add-role confirm prompt ───────────────────────────────────────────
  if (confirmState) {
    return (
      <AuthCard
        title="Role added!"
        subtitle={`You now have the ${confirmState.newRole} role.`}
      >
        <div className="flex flex-col items-center gap-5 py-2 text-center">
          <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center">
            <CheckCircle2 className="w-7 h-7 text-green-500" />
          </div>
          <p className="text-sm text-[var(--text-secondary)]">
            Would you like to switch to your new{" "}
            <span className="font-semibold text-[var(--text-primary)] capitalize">
              {confirmState.newRole}
            </span>{" "}
            role now and complete onboarding?
          </p>
          <div className="flex flex-col gap-3 w-full">
            <button
              type="button"
              onClick={() => redirectToOnboarding(confirmState.newRole)}
              className="btn-primary w-full"
            >
              Switch & complete onboarding
            </button>
            <button
              type="button"
              onClick={() => window.history.back()}
              className="btn-secondary w-full"
            >
              Stay with current role
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
        title="Customers shop via WhatsApp"
        subtitle="The customer role is automatic — no setup needed."
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <p className="text-sm text-[var(--text-secondary)]">
            Your account already supports shopping via WhatsApp. Just send a
            message to start browsing products.
          </p>
          <button
            type="button"
            onClick={() => setShowCustomerCallout(false)}
            className="btn-secondary w-full"
          >
            ← Choose a different role
          </button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Add a new role"
      subtitle={
        heldRoles.length > 0
          ? `You currently have: ${heldRoles.join(", ")}`
          : "Expand what you can do on Jovi Mall"
      }
    >
      <div className="flex flex-col gap-5">
        <RolePicker
          selected={selectedRole}
          onSelect={setSelectedRole}
          excluded={heldRoles}
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

              {selectedRole === "vendor" && (
                <AuthFormField
                  label="Business Name"
                  type="text"
                  placeholder="Your shop or brand name"
                  required
                  {...register("business_name")}
                  error={errors.business_name?.message}
                />
              )}
              {selectedRole === "agency" && (
                <AuthFormField
                  label="Agency Name"
                  type="text"
                  placeholder="Your delivery agency name"
                  required
                  {...register("agency_name")}
                  error={errors.agency_name?.message}
                />
              )}

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
                className="btn-primary w-full disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isSubmitting ? "Adding role…" : `Add ${selectedRole} role`}
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </AuthCard>
  );
}
