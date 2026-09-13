"use client"
/**
 * UserMenuDropdown
 *
 * Renders the authenticated user's name as a trigger button.
 * On click, shows a dropdown with: Dashboard, Switch Role, Add Role, Logout.
 *
 * Accessibility:
 * - role="menu" / role="menuitem"
 * - aria-expanded on trigger
 * - Closes on Escape and outside click
 *
 * Layout:
 * - Name truncated at max-w-[120px] to protect navbar layout
 * - Display name priority: user.name → user.email → "Account"
 */
import { useState, useRef, useEffect } from "react";
import { ChevronDown, LayoutDashboard, RefreshCw, LogOut, PlusCircle } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { AuthRoleEntity, Role } from "@/lib/auth/auth.types";
import { getRoleUrl } from "@/lib/auth/auth.redirect";

/**
 * The role entity plus the caller's notion of which role is active.
 *
 * ⚠ `active_role` IS NOT AN API FIELD. The auth endpoints do not return it;
 *   `Navbar` builds it from the session's own `role` and passes the pair down.
 *   It is spelled out here because the alternative — adding it to
 *   `AuthRoleEntity` — would assert that the server sends it, and that file
 *   deliberately marks which of its fields the endpoints really return.
 *
 * ⚠ Until 2026-09-13 this prop was typed as a bare `AuthRoleEntity` and the caller
 *   cast the extra field in. That compiled only because the interface ended in
 *   `[key: string]: any`, so `user.active_role` was `any` and
 *   `getRoleUrl(user.active_role)` type-checked against a five-value union
 *   without anything being verified. Narrowing the catch-all to `unknown` turned
 *   it into the compile error that produced this type.
 */
export type ActiveRoleUser = AuthRoleEntity & { active_role: Role | null };

interface UserMenuDropdownProps {
  user: ActiveRoleUser;
  onLogout: () => Promise<void>;
  onSwitchRole: () => void;
}

export default function UserMenuDropdown({
  user,
  onLogout,
  onSwitchRole,
}: UserMenuDropdownProps) {
  const t = useTranslations("navbar");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  // Display name: name is always present per AuthRoleEntity type.
  // Guard anyway for resilience.
  const displayName = user.name || user.display_name || user.agency_name || user.business_name || user.email || t("userMenuAriaLabel");

  // Dashboard URL for the current active role, when there is one.
  //
  // ⚠ `null` IS NOT DEFENSIVE PADDING — it removes a broken link. `getRoleUrl`
  //   reads `ROLE_SUBDOMAIN_MAP[role]`, so a missing role produced the string
  //   "https://undefined" and the menu showed a Dashboard entry that went nowhere.
  //   It type-checked only because `active_role` resolved through the old
  //   `[key: string]: any` catch-all on AuthRoleEntity.
  //
  // ⚠ The MENU STILL RENDERS in that state, deliberately. The obvious fix — guard
  //   the whole dropdown in Navbar — falls through to the signed-out controls and
  //   takes LOG OUT away from someone who is signed in. Hiding one link is the
  //   small failure; stranding a session with no way out is the large one.
  const dashboardUrl = user.active_role ? getRoleUrl(user.active_role) : null;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    setLoading(true);
    try {
      await onLogout();
    } finally {
      setLoading(false);
    }
  }

  function handleSwitchRole() {
    setOpen(false);
    onSwitchRole();
  }

  return (
    <div ref={ref} className="relative">
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={t("userMenuAriaLabel")}
        aria-expanded={open}
        aria-haspopup="menu"
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium",
          "border border-[var(--border)]",
          "text-[var(--text-primary)] bg-[var(--bg-subtle)]",
          "hover:bg-[var(--accent-light)] transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        )}
        disabled={loading}
      >
        {/* Avatar initials */}
        <span className="w-5 h-5 rounded-full bg-primary-500/20 text-primary-600 flex items-center justify-center text-[10px] font-bold uppercase shrink-0">
          {displayName.charAt(0)}
        </span>
        <span className="max-w-[120px] truncate">{displayName}</span>
        <ChevronDown
          className={cn(
            "w-3.5 h-3.5 shrink-0 text-[var(--text-muted)] transition-transform duration-200",
            open && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label={t("userMenuAriaLabel")}
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 mt-2 w-44 glass border border-[var(--border)] rounded-xl shadow-lg overflow-hidden z-50"
          >
            {/* 1. Dashboard — omitted when no active role resolved; see above. */}
            {dashboardUrl && (
            <a
              href={dashboardUrl}
              role="menuitem"
              className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)] transition-colors"
              onClick={() => setOpen(false)}
            >
              <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
              {t("dashboard")}
            </a>
            )}

            {/* 2. Switch Role */}
            {/* <button
              role="menuitem"
              onClick={handleSwitchRole}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)] transition-colors"
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              {t("switchRole")}
            </button> */}
            <Link
              href="/auth-me"
              role="menuitem"
              className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)] transition-colors"
              onClick={() => setOpen(false)}
            >
              <RefreshCw className="w-4 h-4" aria-hidden="true" />
              {t("switchRole")}
            </Link>

            {/* 3. Add Role */}
            <Link
              href="/add-role"
              role="menuitem"
              className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)] transition-colors"
              onClick={() => setOpen(false)}
            >
              <PlusCircle className="w-4 h-4" aria-hidden="true" />
              {t("addRole")}
            </Link>

            {/* Divider */}
            <div className="h-px bg-[var(--border-medium)] mx-2 my-1" />

            {/* 4. Logout */}
            <button
              role="menuitem"
              onClick={handleLogout}
              disabled={loading}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              {t("logout")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
