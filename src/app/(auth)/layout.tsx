"use client";
/**
 * Auth layout — minimal, no landing Navbar.
 *
 * Two shapes share this layout:
 *  - /login and /register render AuthSplitShell, a full-width two-pane card that
 *    carries its own logo and locale/theme controls. This layout therefore gives
 *    them the background and nothing else — a second header would duplicate the
 *    brand row already inside the shell.
 *  - every other auth route (add-role, verify-email, auth-me) keeps the original
 *    single centred AuthCard under a plain header.
 *
 * "use client" is required to render AuthPageControls (uses useTheme / useLocale)
 * and to read the pathname. Child pages are independently "use client" so no
 * conflict.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Zap } from "lucide-react";
import { BRAND } from "@/lib/constants";
import AuthPageControls from "@/components/auth/AuthPageControls";
import { useTranslations } from "next-intl";

/** Routes whose page supplies its own full-bleed shell. */
const SPLIT_ROUTES = ["/login", "/register"];

/** Aurora-style ambient wash, shared by both shapes. */
function AuthBackdrop() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_-10%,rgba(13,160,107,0.14)_0%,transparent_70%)]" />
      <div
        className="aurora-blob aurora-a -top-[15%] -left-[10%] h-[55vh] w-[55vh]"
        style={{ background: "var(--aurora-1)" }}
      />
      <div
        className="aurora-blob aurora-c bottom-[-20%] right-[-8%] h-[50vh] w-[50vh]"
        style={{ background: "var(--aurora-3)" }}
      />
    </div>
  );
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations("auth");
  const pathname = usePathname();
  const isSplit = SPLIT_ROUTES.includes(pathname);

  if (isSplit) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)]">
        <AuthBackdrop />
        <main className="flex min-h-screen items-center justify-center px-3 py-6 sm:px-6 sm:py-10">
          {children}
        </main>
      </div>
    );
  }

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
        <AuthBackdrop />

        <div className="w-full max-w-lg">{children}</div>
      </main>
    </div>
  );
}
