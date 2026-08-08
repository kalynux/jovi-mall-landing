"use client";
import { HelpCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * Persistent shortcut to /faq, bottom-right on every page.
 *
 * Mounted in the root layout rather than per-page so it survives every route —
 * including the auth and shop trees, where "what does this cost / how does
 * delivery work" is exactly the question that stalls someone mid-flow.
 *
 * Two placement facts it has to respect:
 *
 *  • It hides on /faq itself. A button that scrolls you to the page you are
 *    already on is noise.
 *  • The shop's bottom tab bar is `fixed bottom-0` and mobile-only, so on /shop
 *    routes the button lifts above it below `md`. Without that it sits on top of
 *    the cart tab.
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

  if (pathname === "/faq") return null;

  const overShopNav = pathname.startsWith("/shop");

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
        overShopNav ? "bottom-[calc(4.75rem+env(safe-area-inset-bottom))] md:bottom-5" : "bottom-5"
      )}
    >
      <HelpCircle className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
      <span className="hidden font-display text-sm font-semibold sm:inline">{t("faqShort")}</span>
    </Link>
  );
}
