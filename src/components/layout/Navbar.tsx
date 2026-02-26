"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Menu, X, Zap, Sun, Moon, Globe, ChevronDown, LogIn } from "lucide-react";
import { motion, useScroll, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/constants";
import CTAButton from "@/components/ui/CTAButton";
import { useTheme } from "@/lib/theme";
import { useTranslations } from "next-intl";
import { useLocale, LOCALES, type Locale } from "@/lib/i18n-provider";
import { useAuth } from "@/lib/auth/useAuth";
import UserMenuDropdown from "@/components/nav/UserMenuDropdown";

interface NavbarProps {
  onGetStarted: () => void;
}

export default function Navbar({ onGetStarted }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const { theme, toggle } = useTheme();
  const { locale, setLocale } = useLocale();
  const menuRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("navbar");

  // Auth state — single source of truth from AuthProvider
  const { user, status, logout } = useAuth();

  useEffect(() => {
    const unsub = scrollY.onChange((v) => setScrolled(v > 60));
    return unsub;
  }, [scrollY]);

  // Close mobile menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  // Close lang dropdown on outside click
  useEffect(() => {
    if (!langOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [langOpen]);

  // Nav links from translations
  const NAV_LINKS = [
    // { label: t("howItWorks"), href: "#how-it-works" },
    { label: t("forVendors"), href: "#vendors" },
    { label: t("forAgencies"), href: "#agencies" },
    { label: t("forAgents"), href: "#agents" },
  ];

  const currentLocaleConfig = LOCALES.find((l) => l.code === locale)!;

  function handleLocaleChange(code: Locale) {
    setLocale(code);
    setLangOpen(false);
  }

  // ── Auth CTAs — shared logic for desktop + mobile CTAs ───────────────────

  /**
   * Renders the right-side auth controls.
   * - "loading" → invisible skeleton (same width, no layout shift)
   * - "unauthenticated" → Login + Get Started
   * - "authenticated" → UserMenuDropdown
   */
  function AuthControls({ mobile = false }: { mobile?: boolean }) {
    if (status === "loading") {
      // Match approximate width of Login + Get Started buttons
      return (
        <div
          className={cn(
            "rounded-xl bg-[var(--border)] animate-pulse",
            mobile ? "h-10 w-full" : "h-9 w-48"
          )}
          aria-hidden="true"
        />
      );
    }

    if (status === "authenticated" && user) {
      return (
        <UserMenuDropdown
          user={user}
          onLogout={logout}
          onSwitchRole={() => {
            setMenuOpen(false);
            onGetStarted(); // Reuse the existing role-modal flow
          }}
        />
      );
    }

    // Unauthenticated
    if (mobile) {
      return (
        <>
          <Link
            href="/login"
            onClick={() => setMenuOpen(false)}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--accent-light)] transition-colors"
          >
            <LogIn className="w-4 h-4" aria-hidden="true" />
            {t("login")}
          </Link>
          <CTAButton
            variant="primary"
            size="sm"
            className="w-full justify-center"
            onClick={() => { setMenuOpen(false); onGetStarted(); }}
          >
            {t("getStarted")}
          </CTAButton>
        </>
      );
    }

    return (
      <>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)] border border-[var(--border)] transition-all duration-200"
          aria-label={t("login")}
        >
          <LogIn className="w-3.5 h-3.5" aria-hidden="true" />
          {t("login")}
        </Link>
        <CTAButton variant="primary" size="sm" onClick={onGetStarted}>
          {t("getStarted")}
        </CTAButton>
      </>
    );
  }

  return (
    <header
      ref={menuRef}
      className={cn(
        "fixed top-0 inset-x-0 z-50 transition-all duration-300",
        scrolled
          ? "glass border-b border-[var(--border-medium)] shadow-sm"
          : "bg-transparent"
      )}
    >
      <div className="container-xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-[4.5rem]">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group" aria-label={t("logoAriaLabel")}>
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-glow-primary group-hover:scale-110 transition-transform duration-200">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-display font-bold text-lg tracking-tight text-[var(--text-primary)]">
              {BRAND.name}
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8" aria-label={t("mainNavAriaLabel")}>
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors duration-200"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop controls */}
          <div className="hidden md:flex items-center gap-2">
            {/* Language switcher */}
            <div ref={langRef} className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                aria-label={t("languageSwitcher")}
                aria-expanded={langOpen}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)] transition-all duration-200 border border-[var(--border)] text-xs font-display font-medium"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{currentLocaleConfig.label}</span>
                <ChevronDown className={cn("w-3 h-3 transition-transform duration-200", langOpen && "rotate-180")} />
              </button>
              <AnimatePresence>
                {langOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute right-0 mt-2 w-36 glass border border-[var(--border)] rounded-xl shadow-lg overflow-hidden z-50"
                  >
                    {LOCALES.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => handleLocaleChange(l.code)}
                        className={cn(
                          "w-full text-left px-3 py-2 text-xs font-medium transition-colors duration-150",
                          l.dir === "rtl" && "text-right",
                          locale === l.code
                            ? "text-primary-600 bg-[var(--accent-light)]"
                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)]"
                        )}
                        lang={l.code}
                        dir={l.dir}
                      >
                        {l.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Theme toggle */}
            <button
              onClick={toggle}
              aria-label={theme === "dark" ? t("toggleLight") : t("toggleDark")}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)] transition-all duration-200 border border-[var(--border)]"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Auth CTAs (login/get-started OR user menu) */}
            <AuthControls />
          </div>

          {/* Mobile controls */}
          <div className="md:hidden flex items-center gap-2">
            {/* Mobile lang */}
            <div ref={langRef} className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                aria-label={t("languageSwitcher")}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)] transition-all duration-200"
              >
                <Globe className="w-4 h-4" />
              </button>
              <AnimatePresence>
                {langOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-36 glass border border-[var(--border)] rounded-xl shadow-lg overflow-hidden z-50"
                  >
                    {LOCALES.map((l) => (
                      <button
                        key={l.code}
                        onClick={() => handleLocaleChange(l.code)}
                        className={cn(
                          "w-full text-left px-3 py-2 text-xs font-medium transition-colors duration-150",
                          l.dir === "rtl" && "text-right",
                          locale === l.code
                            ? "text-primary-600 bg-[var(--accent-light)]"
                            : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-muted)]"
                        )}
                        lang={l.code}
                        dir={l.dir}
                      >
                        {l.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={toggle}
              aria-label={theme === "dark" ? t("toggleLight") : t("toggleDark")}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)] transition-all duration-200"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)] transition-colors"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label={menuOpen ? t("closeMenu") : t("openMenu")}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="md:hidden overflow-hidden border-t border-[var(--border-medium)]"
            style={{
              background: theme === "dark"
                ? "rgba(5,5,12,0.97)"
                : "rgba(255,255,255,0.98)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <div className="px-4 py-5 flex flex-col gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className="py-2.5 px-3 rounded-lg text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--accent-light)] hover:text-primary-600 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-3 mt-2 border-t border-[var(--border-medium)] flex flex-col gap-2">
                <AuthControls mobile />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
