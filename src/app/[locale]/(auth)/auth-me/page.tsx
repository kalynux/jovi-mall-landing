"use client";
import { useState } from "react";
import { Loader2, UserCircle2 } from "lucide-react";
import { Store, Building2, Bike, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { switchRoleAndGetRedirect } from "@/lib/auth/auth.service";
import { ApiError } from "@/lib/auth/auth.types";
import type { Role } from "@/lib/auth/auth.types";
import { translateCode } from "@/lib/auth/error-translator";
import { isNetworkError } from "@/lib/errors/is-network-error";
import AuthCard from "@/components/auth/AuthCard";
import { cn } from "@/lib/utils";

const ROLE_ICONS: Record<string, React.ElementType> = {
  vendor: Store,
  agency: Building2,
  agent: Bike,
  customer: MessageCircle,
  admin: UserCircle2,
};

export default function AuthMePage() {
  const t = useTranslations("authMe");
  const tErrors = useTranslations("errors");
  const { user, role, status } = useAuthGuard();

  const [switching, setSwitching] = useState<Role | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (status === "loading") {
    return (
      <AuthCard title={t("title")}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      </AuthCard>
    );
  }

  const roles = user?.roles ?? [];
  const activeRole = role;

  // One message with the role interpolated into it, not a prefix glued to a
  // name: "signed in as Vendor" puts the role last in English and Spanish and
  // nowhere near last in every language (§4).
  const activeRoleName = activeRole
    ? (t.raw("roleNames") as Record<string, string>)[activeRole] ?? activeRole
    : "";
  const subtitle = activeRole ? t("subtitle", { role: activeRoleName }) : "";

  const handleSwitchRole = async (role: Role) => {
    // Current role is disabled — guard against any programmatic call
    if (switching || role === activeRole) return;
    setError(null);
    setSwitching(role);
    try {
      // ⚠ THE RULE IS WRONG HERE, PERMANENTLY. react-hooks/immutability reads this
      //   as modifying a value the component must not touch; it is the platform API
      //   for leaving the page, not React state. A full navigation is also the point
      //   — a client-side route would keep the loaded bundle and the stale session
      //   it holds, which is exactly what switching role must not do.
      // eslint-disable-next-line react-hooks/immutability
      window.location.href = await switchRoleAndGetRedirect(role);
    } catch (err) {
      setSwitching(null);
      // Same resolution order the auth forms use via `mapApiErrors`: translate
      // the backend's *code*, never its raw message. Testing `instanceof
      // AuthError` here used to surface the untranslated English body — and,
      // on a non-structured response, the literal "Request failed (500)".
      if (err instanceof ApiError) {
        setError(translateCode(tErrors, err.code, err.message));
      } else if (isNetworkError(err)) {
        setError(tErrors("NETWORK_ERROR"));
      } else {
        setError(t("switchError"));
      }
    }
  };

  return (
    <AuthCard title={t("title")} subtitle={subtitle}>
      <div className="flex flex-col gap-4">
        {/* Role list */}
        <div className="flex flex-col gap-2">
          {roles.map((role, i) => {
            const Icon = ROLE_ICONS[role] ?? UserCircle2;
            const isActive = role === activeRole;
            const isSwitching = switching === role;
            const isWa = role === "customer";
            // Translated role label for display
            const roleLabel =
              (t.raw("roleLabels") as Record<string, string>)[role] ?? role;

            return (
              <motion.button
                key={role}
                type="button"
                onClick={() => handleSwitchRole(role as Role)}
                // Current role: prevent all interaction
                disabled={isActive || Boolean(switching)}
                aria-disabled={isActive ? "true" : undefined}
                tabIndex={isActive ? -1 : undefined}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                aria-label={
                  isActive ? t("roleAriaCurrent", { role: roleLabel }) : roleLabel
                }
                className={cn(
                  "flex items-center gap-4 w-full p-4 rounded-2xl border text-left",
                  "transition-all duration-200",
                  isActive
                    ? isWa
                      ? "border-wa/40 bg-wa-soft opacity-60 cursor-not-allowed"
                      : "border-primary-500/40 bg-[var(--accent-light)] opacity-60 cursor-not-allowed"
                    : "border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--bg-subtle)] hover:border-primary-400/40",
                  switching && !isSwitching && !isActive ? "opacity-50" : "",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                  "disabled:cursor-not-allowed"
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                    isWa ? "bg-wa-soft" : "bg-[var(--accent-light)]"
                  )}
                >
                  {isSwitching ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                  ) : (
                    <Icon
                      className={cn(
                        "w-5 h-5",
                        isActive
                          ? "text-[var(--text-muted)]"
                          : isWa
                            ? "text-wa-dark"
                            : "text-primary-600"
                      )}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-sm text-[var(--text-primary)] capitalize">
                    {roleLabel}
                  </p>
                </div>

                {/* Single shared "Current role" badge — same key as RolePicker uses */}
                {isActive && (
                  <span className="text-[10px] font-display font-bold px-2 py-0.5 rounded-full bg-[var(--border-medium)] text-[var(--text-muted)] flex-shrink-0">
                    {t("currentBadge")}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-xl px-4 py-3 bg-red-500/10 border border-red-500/20 text-sm text-red-600 font-medium"
          >
            {error}
          </div>
        )}

        {/* Add role — replaces the previous Sign Out button */}
        <Link
          href="/add-role"
          className="btn-secondary w-full text-center text-sm"
        >
          {t("addRoleBtn")}
        </Link>
      </div>
    </AuthCard>
  );
}
