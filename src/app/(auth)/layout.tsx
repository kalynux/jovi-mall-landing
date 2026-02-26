"use client";
/**
 * Auth layout — minimal, no landing Navbar.
 * Full-screen centered layout for /login and /register.
 *
 * "use client" is required to render AuthPageControls (uses useTheme / useLocale).
 * Child pages are independently "use client" so no conflict.
 */
import Link from "next/link";
import { Zap } from "lucide-react";
import { BRAND } from "@/lib/constants";
import AuthPageControls from "@/components/auth/AuthPageControls";
import { useTranslations } from "next-intl";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("auth");

  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 flex-shrink-0">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 group"
          aria-label={t("backToHome")}
        >
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow-primary group-hover:scale-110 transition-transform duration-200">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight text-[var(--text-primary)]">
            {BRAND.name}
          </span>
        </Link>

        {/* Right: language switcher + theme toggle */}
        <AuthPageControls />
      </header>

      {/* Page area */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        {/* Subtle ambient glow */}
        <div
          className="pointer-events-none fixed inset-0 -z-10"
          aria-hidden="true"
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(124,58,237,0.14)_0%,transparent_70%)]" />
        </div>

        <div className="w-full max-w-lg">{children}</div>
      </main>
    </div>
  );
}
