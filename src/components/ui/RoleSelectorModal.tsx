"use client";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { Store, Building2, Bike, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";

const ICON_MAP = { Store, Building2, Bike, MessageCircle };
type RoleId = "vendor" | "agency" | "agent" | "customer";

const ROLES: {
  id: RoleId;
  icon: keyof typeof ICON_MAP;
  href: string;
  color: "primary" | "wa";
}[] = [
  { id: "vendor", icon: "Store", href: "/register?role=vendor", color: "primary" },
  { id: "agency", icon: "Building2", href: "/register?role=agency", color: "primary" },
  { id: "agent", icon: "Bike", href: "/register?role=agent", color: "primary" },
  { id: "customer", icon: "MessageCircle", href: "/register?role=customer", color: "wa" },
];

interface RoleSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RoleSelectorModal({ isOpen, onClose }: RoleSelectorModalProps) {
  const t = useTranslations("modal");

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            key="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-modal-title"
            initial={{ opacity: 0, scale: 0.9, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 16 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed inset-0 z-[101] flex items-center justify-center p-4"
          >
            <div className="relative w-full max-w-lg glass rounded-3xl border border-[var(--border)] shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-[var(--border)]">
                <button
                  onClick={onClose}
                  className="absolute top-4 right-4 p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)] transition-all"
                  aria-label={t("close")}
                >
                  <X className="w-4 h-4" />
                </button>
                <h2 id="role-modal-title" className="font-display text-xl font-bold text-[var(--text-primary)]">
                  {t("title")}
                </h2>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  {t("subtitle")}
                </p>
              </div>

              {/* Role Cards */}
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ROLES.map((role, i) => {
                  const Icon = ICON_MAP[role.icon];
                  const isWa = role.color === "wa";
                  return (
                    <motion.a
                      key={role.id}
                      href={role.href}
                      onClick={onClose}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07 + 0.1, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className={cn(
                        "group relative p-4 rounded-2xl border border-[var(--border)]",
                        "bg-[var(--bg)] hover:bg-[var(--bg-subtle)]",
                        "hover:border-primary-400/50",
                        "transition-all duration-200 cursor-pointer",
                        "hover:shadow-card-hover hover:-translate-y-0.5"
                      )}
                      aria-label={t(`roles.${role.id}.headline` as Parameters<typeof t>[0])}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center mb-3",
                        isWa ? "bg-wa/10" : "bg-[var(--accent-light)]"
                      )}>
                        <Icon className={cn("w-5 h-5", isWa ? "text-wa-dark" : "text-primary-600")} />
                      </div>
                      <div className={cn(
                        "absolute top-3 right-3 text-[9px] font-display font-bold px-2 py-0.5 rounded-full",
                        isWa ? "bg-wa/10 text-wa-dark" : "bg-[var(--accent-light)] text-primary-600"
                      )}>
                        {t(`roles.${role.id}.label` as Parameters<typeof t>[0])}
                      </div>
                      <h3 className="font-display font-semibold text-sm text-[var(--text-primary)] mb-0.5">
                        {t(`roles.${role.id}.headline` as Parameters<typeof t>[0])}
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                        {t(`roles.${role.id}.description` as Parameters<typeof t>[0])}
                      </p>
                    </motion.a>
                  );
                })}
              </div>

              <div className="px-6 pb-5 text-center">
                <p className="text-xs text-[var(--text-muted)]">
                  {t("signIn")}{" "}
                  <a href="/login" className="text-primary-600 hover:underline font-medium">{t("signInLink")}</a>
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
