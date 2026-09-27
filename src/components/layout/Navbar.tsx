"use client";
import { useState, useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
import { useHydrated } from "@/lib/use-hydrated";
import { useBodyScrollLock } from "@/components/ui/ModalShell";

interface NavbarProps {
  onGetStarted: () => void;
}

/**
 * `openSection` value for the drawer's language disclosure.
 *
 * Double-underscored so it can never collide with a `MAIN_MENU` key — the
 * language row shares the one-open-at-a-time state with `solutions`/`company`.
 */
const LANG_SECTION = "__language";

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
 * One collapsible row inside the mobile drawer.
 *
 * The desktop popover does not translate to a phone — there is nowhere to hover
 * and no room to float a panel — so a `menu` node becomes a disclosure instead.
 * The language switcher uses the same disclosure for the same reason: an
 * absolutely-positioned popover inside a scrolling drawer is clipped by it.
 */
function MobileDisclosure({
  panelId,
  label,
  trailing,
  active = false,
  expanded,
  onToggle,
  children,
}: {
  panelId: string;
  label: ReactNode;
  /** Rendered before the chevron — the current locale, for the language row. */
  trailing?: ReactNode;
  active?: boolean;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className={cn(
          "w-full flex items-center justify-between gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-colors",
          active
            ? "text-primary-600"
            : "text-[var(--text-primary)] hover:bg-[var(--accent-light)] hover:text-primary-600"
        )}
      >
        <span className="flex min-w-0 items-center gap-2 truncate">{label}</span>
        <span className="flex flex-none items-center gap-2">
          {trailing}
          <ChevronDown
            className={cn("w-4 h-4 transition-transform duration-200", expanded && "rotate-180")}
            aria-hidden="true"
          />
        </span>
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
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A `menu` node from MAIN_MENU, rendered as a drawer disclosure. */
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
  return (
    <MobileDisclosure
      panelId={`mobile-menu-${node.key}`}
      label={t(node.key)}
      active={isNodeActive(node, pathname)}
      expanded={expanded}
      onToggle={onToggle}
    >
      {node.items.map((item) => {
        const itemActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
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
    </MobileDisclosure>
  );
}

export default function Navbar({ onGetStarted }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  /** Which drawer disclosure is expanded — one at a time keeps the list short. */
  const [openSection, setOpenSection] = useState<string | null>(null);
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(false);
  const { theme, toggle } = useTheme();
  const { locale, setLocale, localeLabels } = useLocale();
  const drawerRef = useRef<HTMLDivElement>(null);
  /** Whatever had focus when the drawer opened, so close can hand it back. */
  const focusReturnRef = useRef<HTMLElement | null>(null);
  const langRefDesktop = useRef<HTMLDivElement>(null);
  const t = useTranslations("navbar");
  const pathname = usePathname();

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

  /**
   * The drawer renders into `document.body`, following ResponsiveDialog and
   * ModalShell.
   *
   * The `<header>` is `position: fixed` and opens its own stacking context, so
   * a panel rendered inside it can never cover the page: it is bounded by the
   * header's box and pinned to the header's z-layer. Portalling is what lets a
   * full-height drawer exist at all — it is not a nicety here.
   *
   * `useHydrated` rather than an effect that sets state: there is no `document`
   * during SSR, and both the server and hydrating renders return false, so the
   * passes agree without a cascading re-render.
   */
  const hydrated = useHydrated();

  // Nothing behind the drawer should scroll while it is open. ModalShell's hook,
  // imported rather than re-implemented, so the two cannot drift apart.
  useBodyScrollLock(menuOpen);

  // Escape closes the drawer. Bound to the document so it works wherever focus
  // happens to be.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  // Focus moves into the drawer on open, so screen readers announce the new
  // context and the keyboard starts inside it rather than behind it, and goes
  // back to the trigger on close. `document.contains` because the element that
  // had focus may have been unmounted meanwhile.
  useEffect(() => {
    if (menuOpen) {
      focusReturnRef.current = document.activeElement as HTMLElement | null;
      drawerRef.current?.focus();
      return;
    }
    const previous = focusReturnRef.current;
    focusReturnRef.current = null;
    if (previous && document.contains(previous)) previous.focus();
  }, [menuOpen]);

  // Close on route change. In-drawer links already call `setMenuOpen(false)`,
  // but a back/forward gesture or any programmatic navigation did not, and the
  // panel survived onto the next page.
  //
  // Adjusted during render rather than in an effect. An effect that calls
  // setState unconditionally on [pathname] renders the new page with the drawer
  // still open, then immediately re-renders it closed — a cascading render that
  // `react-hooks/set-state-in-effect` fails the build over, and a visible flash
  // of the old page's drawer over the new page. Comparing against the previous
  // value here is React's documented way to reset state when a prop changes:
  // the extra render happens before the browser paints, so nothing flashes.
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMenuOpen(false);
    setLangOpen(false);
  }

  // The drawer is the phone-sized presentation of a menu the desktop renders
  // inline. Rotating or resizing to a tablet width while it is open would
  // otherwise leave body scroll locked behind a drawer `md:hidden` has just
  // made invisible.
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    const onChange = () => {
      if (mq.matches) setMenuOpen(false);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Close lang dropdown on outside click. Desktop only — on a phone the
  // switcher is a disclosure inside the drawer, not a popover, so there is no
  // second ref to keep in step any more.
  useEffect(() => {
    if (!langOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (!langRefDesktop.current?.contains(e.target as Node)) setLangOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [langOpen]);

  const currentLocaleConfig = LOCALES.find((l) => l.code === locale)!;

  function handleLocaleChange(code: Locale) {
    setLocale(code);
    setLangOpen(false);
    setMenuOpen(false);
  }

  /**
   * Where the drawer sits when closed. It is anchored to the inline-end edge
   * (`end-0`), which flips on its own in RTL — but framer-motion's `x` is a
   * physical transform and does not, so the sign has to come from the locale's
   * direction. Get this wrong and the Arabic drawer is pinned left while
   * sliding in from off-screen right.
   */
  const drawerOffscreenX = currentLocaleConfig.dir === "rtl" ? "-100%" : "100%";

  const drawer = (
    <AnimatePresence>
      {menuOpen && (
        <>
          <motion.div
            key="nav-drawer-scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setMenuOpen(false)}
            aria-hidden="true"
            className="fixed inset-0 z-[90] bg-black/50 md:hidden"
          />

          <motion.div
            key="nav-drawer"
            ref={drawerRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label={t("mainNavAriaLabel")}
            initial={{ x: drawerOffscreenX }}
            animate={{ x: 0 }}
            exit={{ x: drawerOffscreenX }}
            transition={{ type: "spring", stiffness: 420, damping: 40 }}
            className={cn(
              "fixed inset-y-0 end-0 z-[91] md:hidden",
              "flex w-[min(86vw,22rem)] max-w-full flex-col",
              // Opaque, over a scrim. The hardcoded #05050C/#FFFFFF this panel
              // used to carry existed only because it hung off a translucent
              // header; it does not any more, so it uses the tokens.
              "border-s border-[var(--border)] bg-[var(--surface)] shadow-2xl",
              "pt-[var(--sa-top,0px)] focus-visible:outline-none"
            )}
          >
            <div className="flex h-16 flex-none items-center justify-between gap-3 border-b border-[var(--border)] px-4">
              <Link
                href="/"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2"
                aria-label={t("logoAriaLabel")}
              >
                <WiMallMark className="h-7 w-7" />
                <span className="font-display text-base font-bold tracking-tight text-[var(--text-primary)]">
                  {BRAND.name}
                </span>
              </Link>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                aria-label={t("closeMenu")}
                className="-me-1 flex h-9 w-9 flex-none items-center justify-center rounded-xl text-[var(--text-secondary)] transition-colors hover:bg-[var(--accent-light)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Nesting makes this list longer than a short viewport, so the
                drawer scrolls internally rather than running past its own
                bottom edge. `overscroll-contain` stops a flick at the end of
                the list from chaining into the (locked) page behind it. */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5">
              <div className="flex flex-col gap-1">
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

                <div className="my-2 h-px bg-[var(--border-medium)]" aria-hidden="true" />

                <MobileDisclosure
                  panelId="mobile-menu-language"
                  label={
                    <>
                      <Globe className="w-4 h-4 flex-none" aria-hidden="true" />
                      {t("languageSwitcher")}
                    </>
                  }
                  trailing={
                    <span className="font-display text-xs font-medium text-[var(--text-secondary)]">
                      {localeLabels[locale] ?? currentLocaleConfig.label}
                    </span>
                  }
                  expanded={openSection === LANG_SECTION}
                  onToggle={() =>
                    setOpenSection((current) => (current === LANG_SECTION ? null : LANG_SECTION))
                  }
                >
                  {LOCALES.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => handleLocaleChange(l.code)}
                      lang={l.code}
                      dir={l.dir}
                      aria-current={locale === l.code ? "true" : undefined}
                      className={cn(
                        "py-2 px-3 rounded-lg text-start text-sm transition-colors",
                        l.dir === "rtl" && "text-end",
                        locale === l.code
                          ? "bg-[var(--accent-light)] text-primary-600 font-medium"
                          : "text-[var(--text-secondary)] hover:bg-[var(--accent-light)] hover:text-primary-600"
                      )}
                    >
                      {localeLabels[l.code] ?? l.label}
                    </button>
                  ))}
                </MobileDisclosure>
              </div>

              {/* In flow at the end of the scroller rather than pinned to the
                  drawer's bottom edge: when signed in this slot is
                  UserMenuDropdown, whose popover opens downward and would be
                  cut off by the viewport if the row were pinned there. */}
              <div className="mt-4 flex flex-col gap-2 border-t border-[var(--border-medium)] pt-4 pb-[var(--sa-bottom,0px)]">
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
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <header
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
                      // `end-0`, not `right-0`: on /ar the trigger sits at the
                      // inline end, which is the left edge, and a physical
                      // `right-0` hung the popover off the wrong side.
                      className="absolute end-0 mt-2 w-36 glass border border-[var(--border)] rounded-xl shadow-lg overflow-hidden z-50"
                    >
                      {LOCALES.map((l) => (
                        <button
                          key={l.code}
                          onClick={() => handleLocaleChange(l.code)}
                          className={cn(
                            // `text-start` resolves against each button's own
                            // `dir` below, which is what the explicit
                            // rtl-means-text-right pair was hand-rolling.
                            "w-full text-start px-3 py-2 text-xs font-medium transition-colors duration-150",
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

            {/* Mobile controls. The language switcher used to be a third popover
                here; it is a disclosure inside the drawer now, which is where
                the rest of the mobile menu already lived. */}
            <div className="md:hidden flex items-center gap-2">
              <button
                onClick={toggle}
                aria-label={theme === "dark" ? t("toggleLight") : t("toggleDark")}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)] transition-all duration-200"
              >
                {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
              <button
                type="button"
                className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--accent-light)] transition-colors"
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label={menuOpen ? t("closeMenu") : t("openMenu")}
                aria-expanded={menuOpen}
                aria-haspopup="dialog"
              >
                {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {hydrated ? createPortal(drawer, document.body) : null}
    </>
  );
}
