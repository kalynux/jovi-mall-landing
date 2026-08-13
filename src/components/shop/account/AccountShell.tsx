"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button, EmptyState, Icon, Skeleton } from "@/components/shop/ds";
import { useAuthGuard } from "@/lib/auth/auth.guard";
import { translateError } from "@/lib/auth/error-translator";
import type { ResourceStatus } from "@/lib/shop/useApiResource";

/**
 * The frame every `/shop/account/*` page sits in: back link, title, and the
 * session gate.
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
  const router = useRouter();
  const { status } = useAuthGuard();

  return (
    <div className="mx-auto max-w-[760px] px-4 py-8 sm:px-6">
      <button
        onClick={() => router.push("/shop/account")}
        className="mb-4 inline-flex items-center gap-1.5"
        style={{
          border: "none",
          background: "none",
          cursor: "pointer",
          color: "var(--text-muted)",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        <Icon name="arrow-left" size={16} /> Account
      </button>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text-strong)", margin: 0 }}>
            {title}
          </h1>
          {description && (
            <p className="muted" style={{ fontSize: 13.5, marginTop: 5 }}>
              {description}
            </p>
          )}
        </div>
        {action}
      </div>

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
  return (
    <EmptyState
      icon="circle-alert"
      title="Something went wrong"
      description={translateError(t, error, fallback)}
      actionLabel="Try again"
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
  icon?: string;
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
