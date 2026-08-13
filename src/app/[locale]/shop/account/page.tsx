"use client";

import { useTranslations } from "next-intl";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Avatar, Icon, Skeleton } from "@/components/shop/ds";
import { ResourceError } from "@/components/shop/account/AccountShell";
import { useTheme } from "@/lib/theme";
import { useLocale, LOCALES } from "@/lib/i18n-provider";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { getProfile } from "@/lib/shop/profile.api";
import { getUnreadCount } from "@/lib/shop/notifications.api";
import { useApiResource } from "@/lib/shop/useApiResource";
import type { CustomerProfile } from "@/lib/shop/customer.types";

interface MenuRow {
  icon: string;
  label: string;
  href: string;
  /** Right-hand summary, derived from the real record — never invented. */
  value?: (p: CustomerProfile, unread: number) => string;
}

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
  {
    icon: "bell",
    label: "Notifications",
    href: "/shop/account/notifications",
    value: (_p, unread) => (unread > 0 ? `${unread} unread` : ""),
  },
  { icon: "download", label: "My downloads", href: "/shop/account/downloads" },
];

export default function AccountPage() {
  const { theme, toggle } = useTheme();
  const { locale, localeLabels } = useLocale();
  const { status: authStatus } = useAuthGuard();
  const t = useTranslations("errors");

  const profile = useApiResource<CustomerProfile>(() => getProfile());
  // The badge is a separate, much cheaper call than a page of rows. It is
  // deliberately not fatal: a failed count leaves the row without a summary
  // rather than erroring the whole account page.
  const unread = useApiResource<number>(() => getUnreadCount().catch(() => 0));

  const dark = theme === "dark";
  const currentLang =
    localeLabels[locale] ?? LOCALES.find((l) => l.code === locale)?.label ?? "English";

  const loading = authStatus === "loading" || profile.status === "loading";
  const p = profile.data;
  const unreadCount = unread.data ?? 0;

  return (
    <div className="mx-auto max-w-[600px] px-4 py-8 sm:px-6">
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-strong)", marginBottom: 18 }}>
        Account
      </h1>

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
            const value = p && row.value ? row.value(p, unreadCount) : "";
            return (
              <Link
                key={row.href}
                href={row.href}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "14px",
                  borderBottom: "1px solid var(--border-subtle)",
                  background: "var(--surface)",
                  textDecoration: "none",
                }}
              >
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
                <Icon name="chevron-right" size={17} style={{ color: "var(--text-subtle)" }} />
              </Link>
            );
          })}

          {/* Language (display current — switch from the site header) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <Icon name="globe" size={19} style={{ color: "var(--text-muted)" }} />
            <span
              style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)" }}
            >
              Language
            </span>
            <span className="muted" style={{ fontSize: 12.5 }}>
              {currentLang}
            </span>
          </div>

          {/* Dark mode — reuses the app-wide ThemeProvider */}
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

      <p className="muted" style={{ textAlign: "center", marginTop: 20 }}>
        WiMall · shopping from your WhatsApp
      </p>
    </div>
  );
}
