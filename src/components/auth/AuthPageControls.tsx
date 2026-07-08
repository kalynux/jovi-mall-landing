"use client";
/**
 * AuthPageControls
 *
 * Renders the language switcher + theme toggle for the auth layout header.
 * Uses the exact same hooks and visual patterns as Navbar — no duplication.
 * Order: language switcher → theme toggle (per UX convention).
 */
import { useState, useRef, useEffect } from "react";
import { Globe, ChevronDown, Sun, Moon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "@/lib/theme";
import { useLocale, LOCALES, type Locale } from "@/lib/i18n-provider";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export default function AuthPageControls() {
  const { theme, toggle } = useTheme();
  const { locale, setLocale, localeLabels } = useLocale();
  const t = useTranslations("navbar");

  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  const currentLocale = LOCALES.find((l) => l.code === locale)!;

  // Close dropdown on outside click
  useEffect(() => {
    if (!langOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [langOpen]);

  // Close on Escape
  useEffect(() => {
    if (!langOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLangOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [langOpen]);

  function handleLocaleChange(code: Locale) {
    setLocale(code);
    setLangOpen(false);
  }

  return (
    <div className="flex items-center gap-2">
      {/* ── Language switcher ──────────────────────────────────────────── */}
      <div ref={langRef} className="relative">
        <button
          onClick={() => setLangOpen((v) => !v)}
          aria-label={t("languageSwitcher")}
          aria-expanded={langOpen}
          aria-haspopup="listbox"
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)] transition-all duration-200 border border-[var(--border)] text-xs font-display font-medium"
        >
          <Globe className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{localeLabels[locale] ?? currentLocale.label}</span>
          <ChevronDown
            className={cn(
              "w-3 h-3 transition-transform duration-200",
              langOpen && "rotate-180"
            )}
            aria-hidden="true"
          />
        </button>

        <AnimatePresence>
          {langOpen && (
            <motion.div
              role="listbox"
              aria-label={t("languageSwitcher")}
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.97 }}
              transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 mt-2 w-36 glass border border-[var(--border)] rounded-xl shadow-lg overflow-hidden z-50"
            >
              {LOCALES.map((l) => (
                <button
                  key={l.code}
                  role="option"
                  aria-selected={locale === l.code}
                  onClick={() => handleLocaleChange(l.code)}
                  className={cn(
                    "w-full px-3 py-2 text-xs font-medium transition-colors duration-150",
                    l.dir === "rtl" ? "text-right" : "text-left",
                    locale === l.code
                      ? "text-primary-600 bg-[var(--accent-light)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)]"
                  )}
                  lang={l.code}
                  dir={l.dir}
                >
                  {localeLabels[l.code] ?? l.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Theme toggle ───────────────────────────────────────────────── */}
      <button
        onClick={toggle}
        aria-label={theme === "dark" ? t("toggleLight") : t("toggleDark")}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)] transition-all duration-200 border border-[var(--border)]"
      >
        {theme === "dark" ? (
          <Sun className="w-4 h-4" aria-hidden="true" />
        ) : (
          <Moon className="w-4 h-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}
