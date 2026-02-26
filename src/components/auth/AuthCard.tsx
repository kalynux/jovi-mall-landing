"use client";
import { cn } from "@/lib/utils";

interface AuthCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Glass card shell for all auth pages.
 * Uses global CSS variables so it respects both light and dark themes.
 */
export default function AuthCard({
  title,
  subtitle,
  children,
  className,
}: AuthCardProps) {
  return (
    <div
      className={cn(
        "w-full max-w-md mx-auto",
        "glass rounded-3xl border border-[var(--border)]",
        "shadow-[var(--shadow-card)]",
        "overflow-hidden",
        className
      )}
    >
      {/* Header */}
      <div className="px-8 pt-8 pb-5 border-b border-[var(--border)]">
        <h1 className="font-display text-2xl font-bold text-[var(--text-primary)]">
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            {subtitle}
          </p>
        )}
      </div>

      {/* Body */}
      <div className="px-8 py-6">{children}</div>
    </div>
  );
}
