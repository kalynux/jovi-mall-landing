"use client";
import { useState, useEffect, useRef } from "react";
import { isRole } from "@/lib/auth/auth.redirect";
import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import { Menu, X, Sun, Moon, Globe, ChevronDown, LogIn } from "lucide-react";
import NavDropdown from "@/components/nav/NavDropdown";
import { MAIN_MENU, isNodeActive, type MenuNode } from "@/lib/nav/menu";
import WiMallMark from "@/components/brand/WiMallMark.generated";
import { motion, useScroll, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/constants";
import CTAButton from "@/components/ui/CTAButton";
import { useTheme } from "@/lib/theme";
import { useTranslations } from "next-intl";
import { useLocale, LOCALES, type Locale } from "@/lib/i18n-provider";
import { useAuth } from "@/lib/auth/useAuth";
import type { AuthRoleEntity } from "@/lib/auth/auth.types";
import UserMenuDropdown from "@/components/nav/UserMenuDropdown";

interface NavbarProps {
  onGetStarted: () => void;
}

interface AuthControlsProps {
  mobile?: boolean;
  status: "loading" | "authenticated" | "unauthenticated";
  user: unknown;
  role_entity: AuthRoleEntity | null;
  role: string | null;
  logout: () => Promise<void>;
  onGetStarted: () => void;
  setMenuOpen: (open: boolean) => void;
  t: ReturnType<typeof useTranslations>;
}

function AuthControls({
  mobile = false,
  status,
  user,
  role_entity,
  role,
  logout,
  onGetStarted,
  setMenuOpen,
  t,
}: AuthControlsProps) {
  if (status === "loading") {
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

  if (status === "authenticated" && user && role_entity) {
    return (
      <UserMenuDropdown
        // No cast: the literal satisfies `ActiveRoleUser` exactly. It used to be
        // `as AuthRoleEntity`, which quietly asserted that `active_role` belonged
        // to the API shape when it does not.
        //
        // ⚠ `isRole` rather than passing `role` straight through: it arrives as
        //   `string | null` off a wire payload, and the dropdown needs the narrow
        //   union to build a dashboard URL. An unrecognised value becomes `null`,
        //   which the dropdown handles by omitting that one link.
        user={{ ...role_entity, active_role: isRole(role) ? role : null }}
        onLogout={logout}
        onSwitchRole={() => {
          setMenuOpen(false);
          onGetStarted();
        }}
      />
    );
  }

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
          onClick={() => {
            setMenuOpen(false);
            onGetStarted();
          }}
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

/**
 * One collapsible group inside the mobile panel.
 *
 * The desktop popover does not translate to a phone — there is nowhere to hover
 * and no room to float a panel — so a `menu` node becomes a disclosure instead,
 * reusing the same `AnimatePresence` + `height: "auto"` motion the outer panel
 * already uses.
 */
function MobileMenuSection({
  node,
  pathname,
  t,
  expanded,
  onToggle,
  onNavigate,
}: {
  node: Extract<MenuNode, { kind: "menu" }>;
  pathname: string;
  t: ReturnType<typeof useTranslations>;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: () => void;
}) {
  const sectionActive = isNodeActive(node, pathname);
  const panelId = `mobile-menu-${node.key}`;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className={cn(
          "w-full flex items-center justify-between py-2.5 px-3 rounded-lg text-sm font-medium transition-colors",
          sectionActive
            ? "text-primary-600"
            : "text-[var(--text-primary)] hover:bg-[var(--accent-light)] hover:text-primary-600"
        )}
      >
        {t(node.key)}
        <ChevronDown
          className={cn("w-4 h-4 transition-transform duration-200", expanded && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id={panelId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="ps-3 ms-3 border-s border-[var(--border-medium)] flex flex-col gap-1 py-1">
              {node.items.map((item) => {
                const itemActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={itemActive ? "page" : undefined}
                    className={cn(
                      "py-2 px-3 rounded-lg text-sm transition-colors",
                      itemActive
                        ? "bg-[var(--accent-light)] text-primary-600 font-medium"
                        : "text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:text-primary-600"
                    )}
                  >
                    {t(item.key)}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Navbar({ onGetStarted }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  /** Which mobile submenu is expanded — one at a time keeps the panel short. */
  const [openSection, setOpenSection] = useState<string | null>(null);
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const { theme, toggle } = useTheme();
  const { locale, setLocale, localeLabels } = useLocale();
  const menuRef = useRef<HTMLDivElement>(null);
  // Desktop and mobile render their own language switcher, and only one of them
  // is mounted at a time — but they used to share a single ref, so outside-click
  // detection bound to whichever mounted last and silently stopped working for
  // the other. One ref each.
  const langRefDesktop = useRef<HTMLDivElement>(null);
  const langRefMobile = useRef<HTMLDivElement>(null);
  const t = useTranslations("navbar");

  // Auth state — single source of truth from AuthProvider
  const { user, role, role_entity, status, logout } = useAuth();

  // NOTE: this component used to consume `useOptionalSectionNav()` so that
  // `#anchor` entries could smooth-scroll the landing page's full-page scroller.
  // Every nav entry is a real route now (see `lib/nav/menu.ts`), so that branch
  // was unreachable and is gone. The landing's own section rail
  // (`SectionProgressIndicator`) still drives the scroller.

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

  // Close lang dropdown on outside click. A click counts as "outside" only when
  // it misses *both* switchers, so whichever one is mounted keeps working.
  useEffect(() => {
    if (!langOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const inside =
        langRefDesktop.current?.contains(target) || langRefMobile.current?.contains(target);
      if (!inside) setLangOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [langOpen]);

  const pathname = usePathname();

  const currentLocaleConfig = LOCALES.find((l) => l.code === locale)!;

  function handleLocaleChange(code: Locale) {
    setLocale(code);
    setLangOpen(false);
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
            <WiMallMark className="w-8 h-8 group-hover:scale-110 transition-transform duration-200" />
            <span className="font-display font-bold text-lg tracking-tight text-[var(--text-primary)]">
              {BRAND.name}
            </span>
          </Link>

          {/* Desktop Nav — structure comes from MAIN_MENU, labels from `navbar`. */}
          <nav className="hidden md:flex items-center gap-7" aria-label={t("mainNavAriaLabel")}>
            {MAIN_MENU.map((node) => {
              if (node.kind === "menu") {
                return (
                  <NavDropdown key={node.key} node={node} pathname={pathname} t={t} />
                );
              }
              const isActive = isNodeActive(node, pathname);
              return (
                <Link
                  key={node.href}
                  href={node.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "relative text-sm font-medium transition-colors duration-200",
                    isActive
                      ? "text-[var(--text-primary)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  )}
                >
                  {t(node.key)}
                  {isActive && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute -bottom-1.5 left-0 right-0 h-0.5 rounded-full bg-primary-500"
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Desktop controls */}
          <div className="hidden md:flex items-center gap-2">
            {/* Language switcher */}
            <div ref={langRefDesktop} className="relative">
              <button
                onClick={() => setLangOpen(!langOpen)}
                aria-label={t("languageSwitcher")}
                aria-expanded={langOpen}
                className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)] transition-all duration-200 border border-[var(--border)] text-xs font-display font-medium"
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{localeLabels[locale] ?? currentLocaleConfig.label}</span>
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
                        {localeLabels[l.code] ?? l.label}
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
            <AuthControls
              status={status}
              user={user}
              role_entity={role_entity}
              role={role}
              logout={logout}
              onGetStarted={onGetStarted}
              setMenuOpen={setMenuOpen}
              t={t}
            />
          </div>

          {/* Mobile controls */}
          <div className="md:hidden flex items-center gap-2">
            {/* Mobile lang */}
            <div ref={langRefMobile} className="relative">
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
                        {localeLabels[l.code] ?? l.label}
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
              background: theme === "dark" ? "#05050C" : "#FFFFFF",
            }}
          >
            {/* Nesting makes this list long enough to run past the bottom of a
                short viewport, and the header it hangs from is `fixed` with
                `overflow-hidden` — so it needs its own scroll container or the
                last items become unreachable. */}
            <div className="px-4 py-5 flex flex-col gap-1 max-h-[calc(100svh-4rem)] overflow-y-auto">
              {MAIN_MENU.map((node) =>
                node.kind === "menu" ? (
                  <MobileMenuSection
                    key={node.key}
                    node={node}
                    pathname={pathname}
                    t={t}
                    expanded={openSection === node.key}
                    onToggle={() =>
                      setOpenSection((current) => (current === node.key ? null : node.key))
                    }
                    onNavigate={() => setMenuOpen(false)}
                  />
                ) : (
                  <Link
                    key={node.href}
                    href={node.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={isNodeActive(node, pathname) ? "page" : undefined}
                    className={cn(
                      "py-2.5 px-3 rounded-lg text-sm font-medium transition-colors",
                      isNodeActive(node, pathname)
                        ? "bg-[var(--accent-light)] text-primary-600"
                        : "text-[var(--text-primary)] hover:bg-[var(--accent-light)] hover:text-primary-600"
                    )}
                  >
                    {t(node.key)}
                  </Link>
                )
              )}
              <div className="pt-3 mt-2 border-t border-[var(--border-medium)] flex flex-col gap-2">
                <AuthControls
                  mobile
                  status={status}
                  user={user}
                  role_entity={role_entity}
                  role={role}
                  logout={logout}
                  onGetStarted={onGetStarted}
                  setMenuOpen={setMenuOpen}
                  t={t}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
