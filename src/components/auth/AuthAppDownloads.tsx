"use client";
/**
 * The chosen role's app, on /login and /register.
 *
 * Rendered twice by AuthSplitShell: in the dark showcase pane from `lg` up, and
 * under the form below that, where the showcase is gone. Before a role is
 * picked there is no app to offer, so only the link to /apps shows.
 *
 * Never rendered in the native build — that visitor is already in the app.
 */
import { ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { UiRole } from "@/lib/auth/auth.types";
import { APPS, ROLE_APP } from "@/lib/apps/apps";
import { useAppRelease } from "@/lib/apps/useAppRelease";
import AppDownloadLinks, { useReleaseFacts } from "@/components/apps/AppDownloadLinks";

interface AuthAppDownloadsProps {
  role: UiRole | null;
  tone: "light" | "dark";
  className?: string;
}

export default function AuthAppDownloads({ role, tone, className }: AuthAppDownloadsProps) {
  const t = useTranslations("apps");
  const app = role ? ROLE_APP[role] : null;
  const release = useAppRelease(app);
  const facts = useReleaseFacts(release);
  const dark = tone === "dark";

  const allApps = (
    <Link
      href="/apps"
      className={cn(
        "group inline-flex items-center gap-1 text-xs font-semibold transition-colors duration-200",
        dark ? "text-white/70 hover:text-white" : "text-primary-600 hover:text-primary-700"
      )}
    >
      {t("allApps")}
      <ArrowRight
        className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 rtl:-scale-x-100 rtl:group-hover:-translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );

  if (!app) return <div className={className}>{allApps}</div>;

  return (
    <section aria-label={t("getApp", { app: APPS[app].name })} className={className}>
      <p
        className={cn(
          "font-display text-[11px] font-semibold uppercase tracking-wider",
          dark ? "text-white/60" : "text-[var(--text-subtle)]"
        )}
      >
        {t("getApp", { app: APPS[app].name })}
      </p>
      <AppDownloadLinks app={app} release={release} tone={tone} className="mt-3" />
      {/* Reserve the line's height so the pane does not jump when it lands. */}
      <p
        className={cn(
          "mt-3 min-h-4 text-xs tabular-nums",
          dark ? "text-white/55" : "text-[var(--text-muted)]"
        )}
      >
        {facts.join(" · ")}
      </p>
      <div className="mt-2">{allApps}</div>
    </section>
  );
}
