"use client";
/**
 * Auth chrome — minimal, no landing Navbar.
 *
 * Two shapes share this shell:
 *  - /login and /register render AuthSplitShell, a full-width two-pane card that
 *    carries its own logo and locale/theme controls. This shell therefore gives
 *    them the background and nothing else — a second header would duplicate the
 *    brand row already inside the card.
 *  - every other auth route (add-role, verify-email, auth-me) keeps the original
 *    single centred AuthCard under a plain header.
 *
 * "use client" is required to render AuthPageControls (uses useTheme / useLocale)
 * and to read the pathname. It lives here rather than on the route layout so
 * that layout can stay a server component and export the noindex metadata.
 */
import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import WiMallMark from "@/components/brand/WiMallMark.generated";
import { homePath, normalizePath } from "@/lib/shop/shop.routes";
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

export default function AuthShell({ children }: { children: React.ReactNode }) {
  const t = useTranslations("auth");
  const pathname = usePathname();
  /**
   * Normalised, and it has to be.
   *
   * The app build sets `trailingSlash: true`, so `usePathname()` answers
   * "/login/" on a device while SPLIT_ROUTES is written "/login". The plain
   * comparison was therefore false in the app and true on the web — which put
   * the header BACK on the one screen that had just been redesigned without
   * one: a logo, a language menu and a theme toggle across the top of the
   * app's sign-in page, above a card that already knew not to draw them.
   *
   * Same trap as the bottom tab bar's, and the same fix — see `normalizePath`.
   */
  const isSplit = SPLIT_ROUTES.includes(normalizePath(pathname));

  if (isSplit) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)]">
        <AuthBackdrop />
        <main className="flex min-h-screen items-center justify-center px-4 py-6 sm:px-6 sm:py-10">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="auth-frame min-h-screen bg-[var(--bg)] flex flex-col">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 flex-shrink-0">
        {/* Logo */}
        <Link
          href={homePath()}
          className="flex items-center gap-2 group"
          aria-label={t("backToHome")}
        >
          <WiMallMark className="w-8 h-8 group-hover:scale-110 transition-transform duration-200" />
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
