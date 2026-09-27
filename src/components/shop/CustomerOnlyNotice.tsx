"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
// The PREFIXED pathname, deliberately — see the same pairing in auth.guard.ts.
// It becomes the `return` param, and a French shopper must come back to /fr/….
import { usePathname } from "next/navigation";
import { Button, Icon, type IconName } from "@/components/shop/ds";
import { switchRole } from "@/lib/auth/auth.api";
import { getRoleUrl } from "@/lib/auth/auth.redirect";
import type { Role } from "@/lib/auth/auth.types";
import { translateError } from "@/lib/auth/error-translator";
import { useAuth } from "@/lib/auth/useAuth";
import { localePath } from "@/i18n/routing";
import { useLocale } from "@/lib/i18n-provider";
import { BOT_COMMANDS } from "@/lib/constants";
import { IS_NATIVE_BUILD } from "@/lib/platform";
import { isBusinessSession } from "@/lib/shop/customer-session";

/** The glyph for the role the session is scoped to — the business, not a warning. */
const ROLE_ICON: Record<Exclude<Role, "customer">, IconName> = {
  vendor: "store",
  agency: "building-2",
  agent: "truck",
  admin: "shield",
};

/**
 * What the shop shows a session scoped to a vendor, an agency or an agent.
 *
 * ── Why this is not an error state ───────────────────────────────────────────
 *
 * Every owner-scoped route the shop calls is `requireRole(['customer'])`, so a
 * business session gets `403 AUTH_ROLE_NOT_FOUND` from all of them. That used
 * to reach the screen as "Something went wrong" with a "Try again" button —
 * and retrying sends the same cookie, scoped to the same role, so it could
 * never succeed. Nothing is broken here: the visitor is signed in as the wrong
 * one of their own roles, and the only useful screen is one that says so and
 * offers the way across. So there is no retry on this screen, ever.
 *
 * Naming the role is safe. It is the visitor's own session, read from their
 * own `GET /auth/me`, not something probed about another account.
 *
 * ── Two ways across, and which one is offered depends on the account ────────
 *
 * **The account already holds the customer role** → switch in place.
 * `GET /auth/auth-me/customer` re-issues the pair scoped to `customer`, copying
 * `auth_time`, so it proves nothing new and cannot extend the 90-day cap. It is
 * one tap with no bot round-trip, so it is the primary action, and signing out
 * stays beside it for anyone who would rather.
 *
 * **It does not** → sign out, then sign in as a customer. Customers are
 * passwordless, so "sign in as a customer" means the bot's `/login` link or
 * code, and the sign-out lands on `/login?role=customer`, which opens straight
 * on that. It works for a business account with no customer role yet: since
 * 2026-08-26 the bot's `identity/sync` runs on every inbound message, BEFORE
 * any command, and attaches a customer role and profile to the account whose
 * phone number sent it (`BotRegistrationService.sync` → `ensureCustomer`). So by
 * the time `/login` is dispatched, the resolver's `not_customer` gate passes.
 * That is why the hint says "from this account's phone number": a different
 * number resolves to a different account.
 *
 * ── Where it appears ─────────────────────────────────────────────────────────
 *
 * `CustomerOnlyGate` puts it in front of the two subtrees that need an account,
 * `/shop/account/**` and `/shop/checkout/**` — the same two the middleware
 * gates on the presence of a cookie. `ResourceError` shows it for an
 * `AUTH_ROLE_NOT_FOUND` from anywhere else. Browsing, the cart and saved items
 * need no account and treat a business session as a signed-out one.
 */
export function CustomerOnlyNotice({
  headingLevel = 2,
}: {
  /**
   * 1 where this IS the page (the gate); 2 inside a page that already has its
   * own `<h1>`.
   */
  headingLevel?: 1 | 2;
}) {
  const t = useTranslations("shop.customerOnly");
  const tCommon = useTranslations("shop.common");
  // The role vocabulary the rest of the site already uses: `roleNames` is
  // "Vendor", `roleLabels` is "Vendor Dashboard".
  const tRoles = useTranslations("authMe");
  const tErrors = useTranslations("errors");
  const { locale } = useLocale();
  const pathname = usePathname();
  const { user, role, status, logout } = useAuth();

  const [pending, setPending] = useState<"switch" | "sign-out" | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Both callers mount this only once `isBusinessSession` holds, so `null` here
  // is defence rather than a state anyone sees.
  const businessRole = isBusinessSession(status, role) ? (role as Exclude<Role, "customer">) : null;
  const Heading = headingLevel === 1 ? "h1" : "h2";
  const canSwitch = Boolean(user?.roles.includes("customer"));

  const roleName = businessRole
    ? (tRoles.raw("roleNames") as Record<string, string>)[businessRole] ?? businessRole
    : "";

  /**
   * One tap, then a full page load.
   *
   * A load rather than `refresh()`: the session providers — cart, saved,
   * notifications — resolve on mount, and a screen that already failed its own
   * request would not re-ask on a context change. Every other auth handoff in
   * this app ends the same way, for the same reason.
   */
  const switchToCustomer = async () => {
    if (pending) return;
    setPending("switch");
    setError(null);
    try {
      await switchRole("customer");
      window.location.reload();
    } catch (err) {
      setPending(null);
      setError(translateError(tErrors, err, t("switchFailed")));
    }
  };

  /**
   * Out, and straight onto the customer sign-in — with the page they were on
   * as `return`, so signing in brings them back here rather than to the shop
   * home. `logout` navigates on its own; nothing to reset on this path.
   */
  const signOut = async () => {
    if (pending) return;
    setPending("sign-out");
    const signIn = `${localePath(locale, "/login")}?role=customer&return=${encodeURIComponent(
      pathname ?? "/",
    )}`;
    await logout(signIn);
  };

  const bold = (chunks: ReactNode) => (
    <strong style={{ color: "var(--text-strong)", fontWeight: 700 }}>{chunks}</strong>
  );

  // There is no vendor console in the app, and the admin host is unconfirmed
  // (auth.redirect.ts) — a link to either would be a dead tap.
  const dashboardHref =
    businessRole && businessRole !== "admin" && !IS_NATIVE_BUILD ? getRoleUrl(businessRole) : null;

  return (
    <section
      aria-labelledby="customer-only-title"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        padding: "40px 8px",
        gap: 6,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "var(--surface-2)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 8,
        }}
      >
        <Icon
          name={businessRole ? ROLE_ICON[businessRole] : "user"}
          size={30}
          style={{ color: "var(--text-muted)" }}
        />
      </span>

      <Heading
        id="customer-only-title"
        style={{ fontSize: 17, fontWeight: 800, color: "var(--text-strong)", margin: 0 }}
      >
        {t("title")}
      </Heading>

      <p
        style={{
          fontSize: 14,
          color: "var(--text-muted)",
          lineHeight: 1.5,
          margin: 0,
          maxWidth: 340,
        }}
      >
        {canSwitch
          ? t.rich("bodySwitch", { role: roleName, b: bold })
          : t.rich("bodySignOut", { role: roleName, b: bold })}
      </p>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
          width: "100%",
          maxWidth: 320,
          marginTop: 16,
        }}
      >
        {canSwitch && (
          <Button
            block
            leadingIcon="repeat"
            disabled={pending !== null}
            onClick={() => void switchToCustomer()}
          >
            {pending === "switch" ? t("switching") : t("switchAction")}
          </Button>
        )}

        <Button
          block
          variant={canSwitch ? "secondary" : "primary"}
          leadingIcon="log-out"
          disabled={pending !== null}
          onClick={() => void signOut()}
        >
          {pending === "sign-out" ? t("signingOut") : tCommon("signOut")}
        </Button>

        {error && (
          <p role="alert" style={{ fontSize: 13, color: "var(--danger)", margin: 0 }}>
            {error}
          </p>
        )}
      </div>

      {/* Only where the sign-out path is the one on offer: an account that can
          switch never needs the bot for this. */}
      {!canSwitch && (
        <p
          className="muted"
          style={{ fontSize: 12.5, lineHeight: 1.5, margin: "14px 0 0", maxWidth: 320 }}
        >
          {t.rich("botHint", {
            command: BOT_COMMANDS.login,
            // `dir` isolates the command, or an Arabic paragraph reorders
            // "/login" into "login/".
            code: (chunks) => (
              <code
                dir="ltr"
                style={{
                  fontFamily: "var(--font-mono, ui-monospace, monospace)",
                  fontWeight: 600,
                  fontSize: 12,
                  color: "var(--text-strong)",
                  background: "var(--surface-2)",
                  borderRadius: 4,
                  padding: "1px 5px",
                }}
              >
                {chunks}
              </code>
            ),
          })}
        </p>
      )}

      {dashboardHref && (
        <a
          href={dashboardHref}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginTop: 14,
            fontSize: 13.5,
            fontWeight: 700,
            color: "var(--brand-hover)",
            textDecoration: "none",
          }}
        >
          {(tRoles.raw("roleLabels") as Record<string, string>)[businessRole!] ?? businessRole}
          <Icon name="external-link" size={15} />
        </a>
      )}
    </section>
  );
}

/**
 * Puts {@link CustomerOnlyNotice} in front of a subtree that needs a customer.
 *
 * Mounted by the `/shop/account` and `/shop/checkout` layouts, so it covers
 * every screen beneath them — including ones added later — without each page
 * having to remember. Once the session is known, those pages do not mount for
 * a business session at all, so moving between them sends nothing that would
 * only come back 403.
 *
 * While the session resolves it renders the children as before: every page
 * there already has its own skeleton for that, and holding them back would
 * start a customer's own requests one round trip later on every cold load.
 * The cost is that a business session's FIRST page may already have sent its
 * one request by the time we know — a single 403 that is never shown, since
 * `ResourceError` holds a skeleton for it until the session answers.
 */
export function CustomerOnlyGate({ children }: { children: ReactNode }) {
  const { status, role } = useAuth();

  if (isBusinessSession(status, role)) {
    return (
      <div className="mx-auto max-w-[600px] px-4 py-6 sm:px-6">
        <CustomerOnlyNotice headingLevel={1} />
      </div>
    );
  }

  return <>{children}</>;
}
