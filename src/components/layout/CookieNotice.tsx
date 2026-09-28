"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { IS_NATIVE_BUILD } from "@/lib/platform";
import { useHydrated } from "@/lib/use-hydrated";

const SEEN_KEY = "wi-mall-cookie-notice";

function alreadySeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * One line, one button, shown once.
 *
 * A notice rather than a consent banner, on purpose: everything the site stores
 * is strictly necessary (the sign-in cookies, the guest cart, language and
 * theme), so there is nothing to accept or reject. If an analytics or ad script
 * is ever added, this has to become a real opt-in that runs before it loads.
 *
 * Never in the app: it authenticates with a bearer token, not cookies.
 *
 * Physical `left`/`right` for the same reason as FloatingFaqButton. On phones
 * the notice stops short of the right edge so the FAQ circle stays visible
 * next to it; in the shop there is no FAQ button, and it rises above the tab
 * bar through `--tabbar-h`, like the shop toast does.
 */
export default function CookieNotice() {
  const t = useTranslations("cookieNotice");
  const pathname = usePathname();
  const hydrated = useHydrated();
  const [dismissed, setDismissed] = useState(false);

  if (IS_NATIVE_BUILD || !hydrated || dismissed || pathname === "/cookies" || alreadySeen()) {
    return null;
  }

  const inShop = pathname.startsWith("/shop");

  const dismiss = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Private browsing: it simply shows again next visit.
    }
    setDismissed(true);
  };

  return (
    <div
      role="region"
      aria-label={t("label")}
      style={{ bottom: `calc(1.25rem + var(--tabbar-h, 0px))` }}
      className={cn(
        "fixed left-4 z-40 flex items-center gap-3 rounded-2xl px-4 py-3",
        "border border-[var(--border-medium)] bg-[var(--surface)] shadow-lg",
        inShop ? "right-4" : "right-20",
        "sm:right-auto sm:max-w-sm"
      )}
    >
      <p className="text-xs leading-relaxed text-[var(--text-secondary)] sm:text-sm">
        {t("text")}{" "}
        <Link href="/cookies" className="font-semibold text-primary-600 underline underline-offset-2 hover:text-primary-700">
          {t("learnMore")}
        </Link>
      </p>
      <button
        type="button"
        onClick={dismiss}
        className={cn(
          "flex-shrink-0 rounded-full bg-primary-600 px-4 py-1.5 font-display text-sm font-semibold text-white",
          "transition-colors hover:bg-primary-700",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
        )}
      >
        {t("ok")}
      </button>
    </div>
  );
}
