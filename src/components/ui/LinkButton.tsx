"use client";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

/**
 * A button-shaped link to a route inside the app.
 *
 * Separate from CTAButton because CTAButton renders a raw `<a href>`: fine for
 * an external link or an in-page anchor, wrong for an internal route, since it
 * drops the locale prefix and sends a visitor reading /fr to the English page.
 * This uses next-intl's Link, so /vendors resolves to /fr/vendors under /fr.
 *
 * Visual variants mirror CTAButton's so the two can sit side by side.
 */
export default function LinkButton({
  href,
  children,
  variant = "secondary",
  size = "md",
  showArrow = false,
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
  size?: "sm" | "md";
  showArrow?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 font-display font-semibold",
        "transition-all duration-200",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
        size === "sm" ? "rounded-xl px-4 py-2 text-sm" : "rounded-xl px-6 py-3 text-base",
        variant === "primary" && [
          "text-white bg-gradient-to-r from-primary-700 to-primary-500",
          "shadow-[0_0_20px_rgba(13,160,107,0.35)] hover:shadow-[0_0_34px_rgba(13,160,107,0.6)]",
        ],
        variant === "secondary" && [
          "text-[var(--text-primary)] border border-[var(--border)] bg-[var(--surface-glass)]",
          "hover:bg-[var(--accent-light)] hover:border-primary-400",
        ],
        className
      )}
    >
      {children}
      {showArrow && <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />}
    </Link>
  );
}
