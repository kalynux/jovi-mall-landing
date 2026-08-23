"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Avatar, Icon, Skeleton } from "@/components/shop/ds";
import { ResourceError } from "@/components/shop/account/AccountShell";
import { LanguageSheet } from "@/components/shop/LanguageSheet";
import { useTheme } from "@/lib/theme";
import { useLocale, LOCALES } from "@/lib/i18n-provider";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { getProfile } from "@/lib/shop/profile.api";
import { useApiResource } from "@/lib/shop/useApiResource";
import { IS_NATIVE_BUILD } from "@/lib/platform";
import { openExternal } from "@/lib/native/links";
import { absoluteUrl } from "@/lib/site";
import type { CustomerProfile } from "@/lib/shop/customer.types";

interface MenuRow {
  icon: string;
  label: string;
  href: string;
  /** Right-hand summary, derived from the real record — never invented. */
  value?: (p: CustomerProfile) => string;
  /**
   * This route is NOT in the app bundle — it lives on the marketing site.
   * Rendered as an in-app browser link on the native target rather than a
   * `<Link>` to a file the static export never wrote.
   */
  offBundle?: boolean;
}

/** Shared by both row renderings below, so the two cannot drift apart. */
const MENU_ROW_STYLE = {
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: 12,
  padding: "14px",
  borderBottom: "1px solid var(--border-subtle)",
  background: "var(--surface)",
  textDecoration: "none",
} as const;

/*
 * Notifications is deliberately NOT a row here.
 *
 * The bell in the header bar is on every shop screen at every width, badge and
 * all — so a second door to the same inbox, two taps deeper and reachable only
 * from this one screen, was the weaker of the two by every measure. The one
 * thing the row had that the bell does not, an unread count, the bell shows as
 * a dot on the icon itself.
 */
const MENU: MenuRow[] = [
  { icon: "package", label: "My orders", href: "/shop/account/orders" },
  {
    icon: "map-pin",
    label: "Addresses",
    href: "/shop/account/addresses",
    value: (p) => {
      const n = p.savedAddresses.length;
      return n === 0 ? "None saved" : `${n} saved`;
    },
  },
  {
    icon: "wallet",
    label: "Payment methods",
    href: "/shop/account/payment-methods",
    value: (p) => {
      const n = p.savedPaymentMethods.length;
      return n === 0 ? "None saved" : `${n} saved`;
    },
  },
  { icon: "download", label: "My downloads", href: "/shop/account/downloads" },
  // Where the shop's help shortcut lives now. It used to be a circle floating
  // over every shop page, which on a phone meant a third hovering control
  // competing with the tab bar and the cards' quick-add buttons — and a
  // settings row is where someone looks for it anyway.
  { icon: "circle-help", label: "Help & FAQ", href: "/faq", offBundle: true },
];

export default function AccountPage() {
  const { theme, toggle } = useTheme();
  const { locale, localeLabels } = useLocale();
  const [langOpen, setLangOpen] = useState(false);
  const { status: authStatus } = useAuthGuard();
  const t = useTranslations("errors");

  const profile = useApiResource<CustomerProfile>(() => getProfile());

  const dark = theme === "dark";
  const currentLang =
    localeLabels[locale] ?? LOCALES.find((l) => l.code === locale)?.label ?? "English";

  const loading = authStatus === "loading" || profile.status === "loading";
  const p = profile.data;

  return (
    <div className="mx-auto max-w-[600px] px-4 py-6 sm:px-6">
      {/* The visible one is in the header bar, along with the overflow menu that
          used to sit beside it here — see `AccountHeaderMenu`. */}
      <h1 className="sr-only">Account</h1>

      {/* Identity */}
      <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 20 }}>
        {loading ? (
          <>
            <Skeleton width={58} height={58} radius="50%" />
            <div style={{ flex: 1 }}>
              <Skeleton width="55%" height={16} style={{ marginBottom: 7 }} />
              <Skeleton width="70%" height={12} />
            </div>
          </>
        ) : p ? (
          <>
            {p.avatar ? (
              <Image
                src={p.avatar.url}
                alt=""
                width={58}
                height={58}
                unoptimized
                style={{ borderRadius: "50%", objectFit: "cover", width: 58, height: 58 }}
              />
            ) : (
              <Avatar name={p.name} size={58} />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text-strong)" }}>
                {p.name}
              </div>
              <div className="muted" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {[p.phone, p.email].filter(Boolean).join(" · ") || "No contact details"}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {profile.status === "error" ? (
        <ResourceError
          error={profile.error}
          onRetry={profile.reload}
          fallback={t("UNKNOWN_ERROR")}
        />
      ) : (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            overflow: "hidden",
            background: "var(--surface)",
          }}
        >
          {MENU.map((row) => {
            const value = p && row.value ? row.value(p) : "";

            const body = (
              <>
                <Icon name={row.icon} size={19} style={{ color: "var(--text-muted)" }} />
                <span
                  style={{
                    flex: 1,
                    textAlign: "left",
                    fontSize: 14.5,
                    fontWeight: 600,
                    color: "var(--text-strong)",
                  }}
                >
                  {row.label}
                </span>
                {value && (
                  <span className="muted" style={{ fontSize: 12.5 }}>
                    {value}
                  </span>
                )}
                <Icon
                  name={row.offBundle && IS_NATIVE_BUILD ? "external-link" : "chevron-right"}
                  size={17}
                  style={{ color: "var(--text-subtle)" }}
                />
              </>
            );

            /**
             * "Help & FAQ" points at `/faq`, which is a MARKETING route — and the
             * app bundle is `/shop/**` plus the auth pages and nothing else. A
             * `<Link>` to it inside the app navigates to a file the export never
             * wrote, so the row 404s on a device while working perfectly on the
             * web.
             *
             * So on the native target it opens the real site in the in-app
             * browser instead: a Custom Tab on Android, `SFSafariViewController`
             * on iOS, both with a Done button that comes back. The chevron
             * becomes an external-link glyph so the row says where it goes
             * before it is tapped.
             *
             * `IS_NATIVE_BUILD` is compile-time, so the web build keeps the plain
             * `<Link>` and never loads the browser plugin.
             */
            if (row.offBundle && IS_NATIVE_BUILD) {
              return (
                <button
                  key={row.href}
                  type="button"
                  onClick={() => void openExternal(absoluteUrl(row.href))}
                  style={{ ...MENU_ROW_STYLE, border: "none", cursor: "pointer" }}
                >
                  {body}
                </button>
              );
            }

            return (
              <Link key={row.href} href={row.href} style={MENU_ROW_STYLE}>
                {body}
              </Link>
            );
          })}

          {/* Language.

              This row used to only *display* the active language and leave the
              switch to the marketing navbar — which the app bundle does not
              contain, so in the app it named a setting no shipped screen could
              change. It opens the picker now. */}
          <button
            type="button"
            onClick={() => setLangOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={langOpen}
            style={{ ...MENU_ROW_STYLE, border: "none", cursor: "pointer" }}
          >
            <Icon name="globe" size={19} style={{ color: "var(--text-muted)" }} />
            <span
              style={{
                flex: 1,
                textAlign: "left",
                fontSize: 14.5,
                fontWeight: 600,
                color: "var(--text-strong)",
              }}
            >
              Language
            </span>
            <span className="muted" style={{ fontSize: 12.5 }}>
              {currentLang}
            </span>
            <Icon name="chevron-right" size={17} style={{ color: "var(--text-subtle)" }} />
          </button>

          {/* Dark mode — reuses the app-wide ThemeProvider.

              The only control for it that ships, now that the header's toggle is
              gone: a switch that restyles the whole app belongs with the other
              settings, not one mis-tap away on every screen. */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px" }}>
            <Icon name="moon" size={19} style={{ color: "var(--text-muted)" }} />
            <span
              style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)" }}
            >
              Dark mode
            </span>
            <button
              onClick={toggle}
              aria-pressed={dark}
              aria-label="Toggle dark mode"
              style={{
                width: 44,
                height: 26,
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                background: dark ? "var(--brand)" : "var(--gray-300)",
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  left: dark ? 21 : 3,
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "#fff",
                  transition: "left .15s",
                  boxShadow: "var(--shadow-sm)",
                }}
              />
            </button>
          </div>
        </div>
      )}

      <LanguageSheet open={langOpen} onClose={() => setLangOpen(false)} />

      {/* Where "Sign out" and "Close account" went.

          Both are in the overflow menu in the header bar. Closing the account is
          rare, deliberate and close to irreversible, and a red row standing on
          its own under the settings card made it one of the six things this
          screen appears to be for. Sign out is not rare, but it is one mis-tap
          from ending a session — and the menu is where you look for the way out
          of an account anyway. Both ask before they act. */}
      <p className="muted" style={{ textAlign: "center", marginTop: 20 }}>
        Wi-Mall · shopping from your WhatsApp
      </p>
    </div>
  );
}
