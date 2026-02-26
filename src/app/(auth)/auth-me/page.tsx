"use client";
import { useState } from "react";
import { Loader2, LogOut, UserCircle2 } from "lucide-react";
import { Store, Building2, Bike, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { switchRoleAndRedirect, logoutAndRedirect } from "@/lib/auth/auth.service";
import { AuthError } from "@/lib/auth/auth.types";
import type { Role } from "@/lib/auth/auth.types";
import AuthCard from "@/components/auth/AuthCard";
import { cn } from "@/lib/utils";

const ROLE_ICONS: Record<string, React.ElementType> = {
  vendor: Store,
  agency: Building2,
  agent: Bike,
  customer: MessageCircle,
  admin: UserCircle2,
};

const ROLE_LABELS: Record<string, string> = {
  vendor: "Vendor Dashboard",
  agency: "Agency Dashboard",
  agent: "Agent App",
  customer: "Customer Portal",
  admin: "Admin Panel",
};

export default function AuthMePage() {
  const { user, status } = useAuthGuard();

  const [switching, setSwitching] = useState<Role | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "loading") {
    return (
      <AuthCard title="Switch Role">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
        </div>
      </AuthCard>
    );
  }

  const roles = user?.roles ?? [];
  const activeRole = user?.activeRole;

  const handleSwitchRole = async (role: Role) => {
    if (switching || role === activeRole) return;
    setError(null);
    setSwitching(role);
    try {
      await switchRoleAndRedirect(role);
    } catch (err) {
      setSwitching(null);
      if (err instanceof AuthError) {
        setError(err.message);
      } else {
        setError("Failed to switch role. Please try again.");
      }
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    await logoutAndRedirect();
  };

  return (
    <AuthCard
      title="Switch Role"
      subtitle={`Signed in as ${user?.name ?? "…"}. Choose a role to continue.`}
    >
      <div className="flex flex-col gap-4">
        {/* Role list */}
        <div className="flex flex-col gap-2">
          {roles.map((role, i) => {
            const Icon = ROLE_ICONS[role] ?? UserCircle2;
            const isActive = role === activeRole;
            const isSwitching = switching === role;
            const isWa = role === "customer";

            return (
              <motion.button
                key={role}
                type="button"
                onClick={() => handleSwitchRole(role)}
                disabled={Boolean(switching) || loggingOut}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.07, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                aria-pressed={isActive}
                aria-label={`Switch to ${ROLE_LABELS[role] ?? role}`}
                className={cn(
                  "flex items-center gap-4 w-full p-4 rounded-2xl border text-left",
                  "transition-all duration-200",
                  isActive
                    ? isWa
                      ? "border-wa bg-wa/10"
                      : "border-primary-500 bg-[var(--accent-light)]"
                    : "border-[var(--border)] bg-[var(--bg)] hover:bg-[var(--bg-subtle)] hover:border-primary-400/40",
                  (switching && !isSwitching) ? "opacity-50" : "",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
                  "disabled:cursor-not-allowed"
                )}
              >
                <div
                  className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                    isWa ? "bg-wa/10" : "bg-[var(--accent-light)]"
                  )}
                >
                  {isSwitching ? (
                    <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                  ) : (
                    <Icon
                      className={cn(
                        "w-5 h-5",
                        isWa ? "text-wa-dark" : "text-primary-600"
                      )}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-display font-semibold text-sm text-[var(--text-primary)] capitalize">
                    {ROLE_LABELS[role] ?? role}
                  </p>
                  {isActive && (
                    <p className="text-xs text-[var(--text-muted)]">
                      Current session
                    </p>
                  )}
                </div>

                {isActive && (
                  <span className="text-[10px] font-display font-bold px-2 py-0.5 rounded-full bg-primary-600 text-white flex-shrink-0">
                    Active
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

        {/* Add role link */}
        <a
          href="/add-role"
          className="btn-secondary w-full text-center text-sm"
        >
          + Add another role
        </a>

        {/* Divider + Logout */}
        <div className="pt-2 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut || Boolean(switching)}
            className={cn(
              "flex items-center justify-center gap-2 w-full py-2.5 rounded-xl",
              "text-sm font-medium text-red-500 hover:bg-red-500/10",
              "transition-all duration-200",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {loggingOut ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
            {loggingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </AuthCard>
  );
}
