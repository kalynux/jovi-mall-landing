"use client";

import { Avatar, Icon } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { useTheme } from "@/lib/theme";
import { useLocale, LOCALES } from "@/lib/i18n-provider";

const MENU: [string, string, string][] = [
  ["package", "My orders", "3 active"],
  ["map-pin", "Addresses", ""],
  ["wallet", "Payment methods", "MTN · Orange"],
  ["bell", "Notifications", "WhatsApp"],
  ["circle-help", "Help & support", ""],
];

export default function AccountPage() {
  const { theme, toggle } = useTheme();
  const { locale, localeLabels } = useLocale();
  const { flash } = useToast();
  const dark = theme === "dark";
  const currentLang = localeLabels[locale] ?? LOCALES.find((l) => l.code === locale)?.label ?? "English";

  return (
    <div className="mx-auto max-w-[600px] px-4 py-8 sm:px-6">
      <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-strong)", marginBottom: 18 }}>Account</h1>

      <div style={{ display: "flex", alignItems: "center", gap: 13, marginBottom: 20 }}>
        <Avatar name="Aïcha Ngo" size={58} />
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: "var(--text-strong)" }}>Aïcha Ngo</div>
          <div className="muted">+237 6 70 00 00 00 · Douala</div>
        </div>
      </div>

      <div style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--surface)" }}>
        {MENU.map(([ic, lb, val]) => (
          <button
            key={lb}
            onClick={() => flash(lb)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px",
              border: "none",
              borderBottom: "1px solid var(--border-subtle)",
              background: "var(--surface)",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
            }}
          >
            <Icon name={ic} size={19} style={{ color: "var(--text-muted)" }} />
            <span style={{ flex: 1, textAlign: "left", fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)" }}>{lb}</span>
            {val && <span className="muted" style={{ fontSize: 12.5 }}>{val}</span>}
            <Icon name="chevron-right" size={17} style={{ color: "var(--text-subtle)" }} />
          </button>
        ))}

        {/* Language (display current — switch from the site header) */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px", borderBottom: "1px solid var(--border-subtle)" }}>
          <Icon name="globe" size={19} style={{ color: "var(--text-muted)" }} />
          <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)" }}>Language</span>
          <span className="muted" style={{ fontSize: 12.5 }}>{currentLang}</span>
        </div>

        {/* Dark mode — reuses the app-wide ThemeProvider */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px" }}>
          <Icon name="moon" size={19} style={{ color: "var(--text-muted)" }} />
          <span style={{ flex: 1, fontSize: 14.5, fontWeight: 600, color: "var(--text-strong)" }}>Dark mode</span>
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

      <p className="muted" style={{ textAlign: "center", marginTop: 20 }}>
        Jovi Mall · shopping from your WhatsApp
      </p>
    </div>
  );
}
