"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Button, EmptyState, Skeleton, type IconName } from "@/components/shop/ds";
import { useShopPageTitle } from "@/components/shop/ShopChrome";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { translateError } from "@/lib/auth/error-translator";
import { isNetworkError } from "@/lib/errors/is-network-error";
import type { ResourceStatus } from "@/lib/shop/useApiResource";

/**
 * The frame every `/shop/account/*` page sits in: the title, and the session
 * gate.
 *
 * Neither the title nor the way back is drawn here any more — both are the
 * header bar's, on every shop screen rather than on this one family of them.
 * The title is still declared here, because this component is the only thing
 * that knows it, and it reaches the bar through `useShopPageTitle`; the
 * screen-reader heading below is what the bar cannot be, since the bar is
 * chrome shared with pages that own an `<h1>` of their own.
 *
 * `useAuthGuard` redirects an unauthenticated visitor to `/login?return=…`, so
 * these pages never render owner-scoped data to a signed-out browser. The
 * middleware guards the same routes server-side; this is the client half, and
 * it is what covers a session that expires while the page is open.
 */
export function AccountShell({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  const { status } = useAuthGuard();
  useShopPageTitle(title);

  return (
    <div className="mx-auto max-w-[760px] px-4 py-6 sm:px-6">
      <h1 className="sr-only">{title}</h1>

      {(description || action) && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <p className="muted" style={{ flex: 1, minWidth: 0, fontSize: 13.5 }}>
            {description}
          </p>
          {action}
        </div>
      )}

      {/* The guard is still resolving the session — showing the page body here
          would flash owner-scoped chrome at someone about to be redirected. */}
      {status === "loading" ? <AccountSkeleton /> : children}
    </div>
  );
}

/** Generic three-row placeholder, sized to the card lists these pages render. */
export function AccountSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          style={{
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-lg)",
            padding: 14,
            display: "flex",
            flexDirection: "column",
            gap: 9,
          }}
        >
          <Skeleton width="45%" height={14} />
          <Skeleton width="75%" height={12} />
        </div>
      ))}
    </div>
  );
}

/**
 * Renders the standard failure state for a resource load.
 *
 * Copy comes from the shared `errors` namespace — the one part of the shop tree
 * that is already translated in all five locales — via the same
 * code → category → message ladder the auth pages use.
 */
export function ResourceError({
  error,
  onRetry,
  fallback,
}: {
  error: unknown;
  onRetry: () => void;
  fallback?: string;
}) {
  const t = useTranslations("errors");
  // Root-scoped: the heading and the action are shop vocabulary, the body is
  // an `errors.*` code — two namespaces, one screen.
  const tKey = useTranslations();

  /**
   * An unreachable server gets its own heading and icon.
   *
   * `translateError` already resolves the DESCRIPTION to "check your
   * connection", but the heading above it still read "Something went wrong"
   * — and a heading is what gets read first, so the screen opened by telling
   * someone in a lift that the fault was ours and then correcting itself in
   * smaller type. "Try again" is the right action for both, and it is the
   * action that actually works once the signal is back.
   */
  const offline = isNetworkError(error);

  return (
    <EmptyState
      icon={offline ? "wifi-off" : "circle-alert"}
      title={tKey(offline ? "shop.feedback.noConnection" : "shop.feedback.somethingWentWrong")}
      description={translateError(t, error, fallback)}
      actionLabel={tKey("shop.common.tryAgain")}
      actionIcon="refresh-cw"
      onAction={onRetry}
    />
  );
}

/**
 * Loading → error → content, so no page has to spell the branch out itself.
 * `children` only runs once `data` is non-null, which is what lets call sites
 * take it as a plain value rather than a nullable one.
 */
export function ResourceView<T>({
  status,
  error,
  data,
  onRetry,
  errorFallback,
  skeleton,
  children,
}: {
  status: ResourceStatus;
  error: unknown;
  data: T | null;
  onRetry: () => void;
  errorFallback?: string;
  skeleton?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (status === "loading") return <>{skeleton ?? <AccountSkeleton />}</>;
  if (status === "error") return <ResourceError error={error} onRetry={onRetry} fallback={errorFallback} />;
  if (data == null) return <>{skeleton ?? <AccountSkeleton />}</>;
  return <>{children(data)}</>;
}

/** A settings-style row card, shared by the address / payment / notification lists. */
export function AccountCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        background: "var(--surface)",
        padding: 14,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/** Small inline action used inside cards ("Make default", "Remove"). */
export function CardAction({
  label,
  icon,
  danger,
  disabled,
  onClick,
}: {
  label: string;
  icon?: IconName;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      leadingIcon={icon}
      disabled={disabled}
      onClick={onClick}
      style={danger ? { color: "var(--danger)" } : undefined}
    >
      {label}
    </Button>
  );
}
