"use client";
import { HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { IS_NATIVE_BUILD } from "@/lib/platform";

/**
 * Persistent shortcut to /faq, bottom-right on the marketing and auth pages.
 *
 * Mounted in the root layout rather than per-page so it survives every route.
 * Two routes opt out:
 *
 *  • /faq itself. A button that opens the page you are already on is noise.
 *  • The whole /shop tree. The shop is an app shell with its own bottom tab
 *    bar, and a floating circle over that is one hovering control too many —
 *    it sat on top of the product grid and, on the tab bar's own line, on top
 *    of the cart tab. The shortcut lives in the account menu there instead,
 *    alongside the other settings rows.
 *
 * Deliberately physical `right`, not logical `end`: the landing's section rail
 * (SectionProgressIndicator) is also pinned physically right, and mirroring only
 * this one in Arabic would split them across opposite edges of the same screen.
 * If RTL mirroring is wanted, both should move together.
 */
export default function FloatingFaqButton() {
  const t = useTranslations("pages.common");
  // Locale-stripped, so "/fr/faq" reads back as "/faq".
  const pathname = usePathname();

  /**
   * Never in the app.
   *
   * The `/shop` opt-out below already covers most of the app, but the bundle
   * also carries the `(auth)` screens — and there this rendered a floating
   * circle linking to `/faq`, a MARKETING route the export never wrote. Tapping
   * it was a client-side navigation to nothing.
   *
   * Not worth routing to the in-app browser either: a help shortcut hovering
   * over a sign-in form is not something the app wants, and the shop's own
   * shortcut lives in the account menu, which opens the real site properly.
   */
  if (IS_NATIVE_BUILD) return null;

  if (pathname === "/faq" || pathname.startsWith("/shop")) return null;

  return (
    <Link
      href="/faq"
      aria-label={t("ctaFaq")}
      title={t("ctaFaq")}
      className={cn(
        "fixed right-4 z-40 inline-flex items-center gap-2 rounded-full",
        "border border-[var(--border-medium)] bg-[var(--surface)] shadow-lg",
        "text-[var(--text-secondary)] transition-all duration-200",
        "hover:-translate-y-0.5 hover:border-primary-400 hover:text-primary-600 hover:shadow-xl",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
        // Icon-only circle on phones, labelled pill from sm up — a bare "?" is
        // ambiguous once there is room to say what it opens.
        "h-12 w-12 justify-center sm:h-auto sm:w-auto sm:px-4 sm:py-2.5",
        "bottom-5"
      )}
    >
      <HelpCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
      <span className="hidden font-display text-sm font-semibold sm:inline">{t("faqShort")}</span>
    </Link>
  );
}
