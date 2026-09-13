"use client";

import { useTranslations } from "next-intl";

import { Link } from "@/i18n/navigation";
import { usePathname } from "@/i18n/navigation";
import { useCart, useFavorites, useNotifications } from "@/components/shop/providers";
import { Icon, IconButton } from "@/components/shop/ds";
import WiMallMark from "@/components/brand/WiMallMark.generated";
import { AccountHeaderMenu } from "@/components/shop/account/AccountHeaderMenu";
import { useShopChrome } from "@/components/shop/ShopChrome";
import { homePath, normalizePath } from "@/lib/shop/shop.routes";
import { SHOP_TABS } from "@/lib/shop/shop.pages";

function CountDot({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span
      style={{
        position: "absolute",
        top: -5,
        right: -6,
        background: "var(--danger)",
        color: "#fff",
        fontSize: 10,
        fontWeight: 800,
        minWidth: 17,
        height: 17,
        borderRadius: 9,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 4px",
        border: "2px solid var(--surface)",
      }}
    >
      {n}
    </span>
  );
}

/**
 * The shop's app bar: where you are, how you get back, and the few controls
 * that belong on every screen.
 *
 * ── It names the page, not the brand ─────────────────────────────────────────
 *
 * It used to render the wordmark and nothing else, on all twenty screens. A bar
 * that says "Wi-Mall" on the Wi-Mall app is a bar that says nothing: the shopper
 * knows which app they opened, and what they do not know — after a tap from a
 * notification, or three screens into the account tree — is which screen they
 * are on. So the title comes from `ShopChrome`, which answers from the route and
 * lets a screen whose name is live data replace it once it has loaded.
 *
 * The wordmark stays from `md` up, where there is room for both and where it is
 * also the only link home: the desktop web has no tab bar underneath.
 *
 * ── The back arrow ───────────────────────────────────────────────────────────
 *
 * On every screen that is not one of the four tab roots. A root is where back
 * *goes*, so an arrow on one is either a no-op or a way out of the app.
 *
 * ── What is not here any more ────────────────────────────────────────────────
 *
 * The theme toggle. Dark mode is a setting, it is already a row on the account
 * screen, and a control that restyles everything does not need to be one tap
 * from everywhere — it needs to be findable once. It was also spending a phone's
 * scarce header width on something nobody presses twice.
 */
export function ShopHeader() {
  const t = useTranslations("shop.chrome");
  // Root-scoped: for the lib modules’ absolute keys (`shop.nav.tabs.…`), and
  // for the page names in `shop.nav`, which this bar shares with the routes.
  const tKey = useTranslations();
  const pathname = usePathname();
  const { title, showBack, goBack } = useShopChrome();
  const { count: cartCount } = useCart();
  const { count: favCount } = useFavorites();
  const { unread } = useNotifications();

  const here = normalizePath(pathname);

  /**
   * The bell is on every shop screen, at every width.
   *
   * It used to be desktop-only and hidden at zero unread, which left a phone
   * with no way to reach notifications except Account → Notifications, two taps
   * from anywhere and invisible until something had already gone unread. A
   * notification centre nobody can find until it is too late is not one. So it
   * is always rendered, badge or no badge — an empty inbox is an answer, and
   * the shopper asked the question.
   *
   * The single exclusion is the notifications page itself: an icon that
   * navigates to where you already are is a dead control, and it is the one
   * place the unread count is about to become stale anyway. That page shows the
   * settings gear in its place.
   */
  const onNotifications = here === "/shop/account/notifications";

  const badgeFor = (href: string) =>
    href === "/shop/cart" ? cartCount : href === "/shop/saved" ? favCount : 0;

  return (
    <header
      className="shop-header sticky top-0 z-[200] flex-none border-b"
      style={{ background: "var(--surface)", borderColor: "var(--border-subtle)" }}
    >
      <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-2 px-4 sm:px-6">
        {showBack && (
          <IconButton
            icon="arrow-left"
            variant="plain"
            label={tKey("shop.common.back")}
            onClick={goBack}
            // Pulled into the page gutter so the glyph, rather than the edge of
            // its tap target, lines up with the content below it.
            style={{ marginInlineStart: -10 }}
          />
        )}

        <Link
          href={homePath()}
          className="me-1 hidden items-center gap-2 md:flex"
          aria-label={t("brandHome")}
        >
          <WiMallMark style={{ width: 22, height: 22 }} />
          <span
            className="font-display"
            style={{ fontWeight: 800, fontSize: 19, letterSpacing: "-0.03em", color: "var(--text-strong)" }}
          >
            Wi-<span style={{ color: "var(--brand)" }}>Mall</span>
          </span>
        </Link>

        {/*
          Chrome, not a heading. The pages that are indexed — the storefront, a
          product, a vendor's shop — own an <h1> that is part of their content,
          and a second one up here would compete with it. The app screens that
          gave their visible heading to this bar keep a screen-reader one; see
          `AccountShell`.
        */}
        <span
          style={{
            flex: 1,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 17,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--text-strong)",
          }}
        >
          {title}
        </span>

        {/* Where the inbox sends you for the switches that used to be a tab
            beside it. */}
        {onNotifications && (
          <Link
            href="/shop/account/notifications/settings"
            aria-label={tKey("shop.nav.titles.notificationSettings")}
            title={tKey("shop.nav.titles.notificationSettings")}
            className="inline-flex items-center justify-center rounded-[12px]"
            style={{ width: 40, height: 40, color: "var(--text-body)" }}
          >
            <Icon name="settings" size={21} />
          </Link>
        )}

        {!onNotifications && (
          <Link
            href="/shop/account/notifications"
            aria-label={
              unread > 0
                ? t("notificationsUnread", { n: unread })
                : tKey("shop.nav.titles.notifications")
            }
            className="relative inline-flex items-center justify-center rounded-[12px] transition-colors"
            style={{ width: 40, height: 40, color: "var(--text-body)" }}
          >
            <Icon name="bell" size={21} />
            <CountDot n={unread} />
          </Link>
        )}

        {/*
          Desktop only, and the same four destinations as the phone's tab bar —
          which is hidden from `md` up, where these take over. Below `md` they
          would spend a third of the header duplicating the bar the thumb is
          already resting on.
        */}
        {SHOP_TABS.map((tab) => {
          const active = here === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-label={tKey(tab.labelKey)}
              title={tKey(tab.labelKey)}
              className="relative hidden items-center justify-center rounded-[12px] transition-colors md:inline-flex"
              style={{
                width: 40,
                height: 40,
                color: active ? "var(--brand-hover)" : "var(--text-body)",
                background: active ? "var(--brand-subtle)" : "transparent",
              }}
            >
              <Icon name={tab.icon} size={22} />
              <CountDot n={badgeFor(tab.href)} />
            </Link>
          );
        })}

        {/* Sign out and Close account — the account screen's own overflow. */}
        {here === "/shop/account" && <AccountHeaderMenu />}
      </div>
    </header>
  );
}
