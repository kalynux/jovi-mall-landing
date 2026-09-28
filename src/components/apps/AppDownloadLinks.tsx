/**
 * An app's three download channels — APK, Google Play, App Store — with the
 * current release's version, size and minimum Android underneath.
 *
 * Hook-free apart from next-intl, so it renders as a server component on /apps
 * and inside the client auth shell alike. The release is passed in: the server
 * page reads it on the way to HTML, the auth panes fetch it in the browser.
 *
 * A channel with no URL is shown greyed out rather than hidden. The row reads
 * the same for every app, and "coming soon" is itself the answer to the
 * question an iPhone owner arrives with.
 */
import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import {
  APPS,
  androidVersionForSdk,
  formatAppSize,
  type AppKey,
  type AppRelease,
} from "@/lib/apps/apps";
import { AndroidGlyph, AppleGlyph, PlayGlyph } from "@/components/apps/AppGlyphs";

type Tone = "light" | "dark";

interface AppDownloadLinksProps {
  app: AppKey;
  release: AppRelease | null;
  /** `dark` is for the always-dark auth showcase. */
  tone?: Tone;
  /** `tiles`: three compact icons. `buttons`: labelled buttons for the /apps cards. */
  variant?: "tiles" | "buttons";
  className?: string;
}

/** "v1.0.1 · 9.6 MB · Android 7.0+", from whatever the release carries. */
export function useReleaseFacts(release: AppRelease | null): string[] {
  const t = useTranslations("apps");
  const locale = useLocale();
  if (!release) return [];
  const android = androidVersionForSdk(release.minSdk);
  return [
    t("version", { version: release.versionName }),
    formatAppSize(release.sizeBytes, locale),
    ...(android ? [t("requires", { version: android })] : []),
  ];
}

type Channel = {
  key: "apk" | "playStore" | "appStore";
  href: string;
  glyph: ReactNode;
  label: string;
  /** Screen-reader name: says what the link does, or that it does nothing yet. */
  aria: string;
};

export default function AppDownloadLinks({
  app,
  release,
  tone = "light",
  variant = "tiles",
  className,
}: AppDownloadLinksProps) {
  const t = useTranslations("apps");
  const locale = useLocale();
  const { name, apkUrl, playStoreUrl, appStoreUrl } = APPS[app];
  const glyphClass = variant === "tiles" ? "h-6 w-6" : "h-5 w-5";

  const channels: Channel[] = [
    {
      key: "apk",
      href: apkUrl,
      glyph: <AndroidGlyph className={glyphClass} />,
      label: t("apk"),
      aria: release
        ? t("apkAriaSized", { app: name, size: formatAppSize(release.sizeBytes, locale) })
        : t("apkAria", { app: name }),
    },
    {
      key: "playStore",
      href: playStoreUrl,
      glyph: <PlayGlyph className={glyphClass} />,
      label: t("playStore"),
      aria: playStoreUrl
        ? t("storeAria", { app: name, store: t("playStore") })
        : t("storeSoonAria", { app: name, store: t("playStore") }),
    },
    {
      key: "appStore",
      href: appStoreUrl,
      glyph: <AppleGlyph className={glyphClass} />,
      label: t("appStore"),
      aria: appStoreUrl
        ? t("storeAria", { app: name, store: t("appStore") })
        : t("storeSoonAria", { app: name, store: t("appStore") }),
    },
  ];

  const dark = tone === "dark";

  if (variant === "buttons") {
    return (
      <ul className={cn("flex flex-wrap gap-2.5", className)}>
        {channels.map((c) => {
          const live = Boolean(c.href);
          const primary = c.key === "apk";
          const body = (
            <>
              {c.glyph}
              <span className="flex flex-col items-start leading-tight">
                <span className="font-display text-sm font-semibold">
                  {primary ? t("downloadApk") : c.label}
                </span>
                {!live && <span className="text-[11px] font-medium opacity-80">{t("comingSoon")}</span>}
              </span>
            </>
          );
          const shared =
            "inline-flex min-h-11 items-center gap-2.5 rounded-xl border px-4 py-2 transition-colors duration-200";
          return (
            <li key={c.key}>
              {live ? (
                <a
                  href={c.href}
                  aria-label={c.aria}
                  className={cn(
                    shared,
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]",
                    primary
                      ? "border-primary-600 bg-primary-600 text-white hover:border-primary-700 hover:bg-primary-700"
                      : "border-[var(--border-medium)] bg-[var(--surface)] text-[var(--text-primary)] hover:border-primary-400/60 hover:bg-[var(--accent-light)]"
                  )}
                >
                  {body}
                </a>
              ) : (
                <span
                  role="link"
                  aria-disabled="true"
                  aria-label={c.aria}
                  title={t("comingSoon")}
                  className={cn(
                    shared,
                    "cursor-not-allowed border-dashed border-[var(--border-medium)] bg-[var(--bg-muted)] text-[var(--text-subtle)]"
                  )}
                >
                  {body}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <ul className={cn("flex items-start gap-3", className)}>
      {channels.map((c) => {
        const live = Boolean(c.href);
        const tile = cn(
          "relative grid h-12 w-12 place-items-center rounded-2xl border transition-all duration-200",
          live
            ? dark
              ? "border-white/20 bg-white/10 text-white group-hover:-translate-y-0.5 group-hover:border-white/40 group-hover:bg-white/[0.16]"
              : "border-[var(--border-medium)] bg-[var(--surface)] text-[var(--text-primary)] shadow-[var(--shadow-sm)] group-hover:-translate-y-0.5 group-hover:border-primary-400/60 group-hover:text-primary-600"
            : dark
              ? "border-dashed border-white/15 bg-white/[0.03] text-white/35"
              : "border-dashed border-[var(--border-medium)] bg-[var(--bg-muted)] text-[var(--text-subtle)] opacity-70"
        );
        const caption = cn(
          "mt-1.5 block text-center font-display text-[11px] font-semibold",
          live
            ? dark
              ? "text-white/80"
              : "text-[var(--text-secondary)]"
            : dark
              ? "text-white/35"
              : "text-[var(--text-subtle)]"
        );
        const body = (
          <>
            <span className={tile}>
              {c.glyph}
              {!live && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "absolute -top-2 -end-2 rounded-full px-1.5 py-px font-display text-[9px] font-bold uppercase tracking-wide",
                    dark ? "bg-white/15 text-white/70" : "bg-[var(--bg-subtle)] text-[var(--text-muted)] ring-1 ring-[var(--border)]"
                  )}
                >
                  {t("soon")}
                </span>
              )}
            </span>
            <span className={caption} aria-hidden="true">
              {c.label}
            </span>
          </>
        );
        return (
          <li key={c.key} className="w-[4.25rem]">
            {live ? (
              <a
                href={c.href}
                aria-label={c.aria}
                title={c.aria}
                className={cn(
                  "group flex flex-col items-center rounded-2xl focus-visible:outline-none focus-visible:ring-2",
                  dark ? "focus-visible:ring-white/70" : "focus-visible:ring-primary-500"
                )}
              >
                {body}
              </a>
            ) : (
              <span
                role="link"
                aria-disabled="true"
                aria-label={c.aria}
                title={t("comingSoon")}
                className="flex cursor-not-allowed flex-col items-center"
              >
                {body}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
