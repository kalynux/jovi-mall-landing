"use client";
/**
 * `/login/magic` — the one page the storefront owes the passwordless customer
 * flow.
 *
 * The bot's magic link points here (`STOREFRONT_URL/login/magic?t=…`, built by
 * the backend's `buildMagicLinkUrl`), **not** at the API, and the reason is a
 * live bug if ignored: WhatsApp and Telegram fetch URLs to build preview cards,
 * so a GET endpoint that signs you in is spent by the crawler before the user
 * ever taps it — a dead link, every time, for every user. This page issues the
 * POST instead, and a crawler does not execute it.
 *
 * It shows a **spinner, not a button**: the user already expressed intent by
 * tapping the link, and asking them to confirm it again would be asking twice.
 *
 * See api-doc/auth/magic-login.md and api-doc/auth/customer-auth.md.
 */
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlertCircle, Loader2, MessageCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import AuthCard from "@/components/auth/AuthCard";
import { magicLinkSignIn } from "@/lib/auth/auth.api";
import { translateError } from "@/lib/auth/error-translator";
import { BOT_COMMANDS, buildWhatsAppUrl } from "@/lib/constants";
import { useLocale } from "@/lib/i18n-provider";
import { localePath } from "@/i18n/routing";

type State = "redeeming" | "no-token" | "failed";

function MagicLinkContent() {
  const t = useTranslations("magicLogin");
  const tErrors = useTranslations("errors");
  const { locale } = useLocale();
  const token = useSearchParams().get("t");

  const [state, setState] = useState<State>(token ? "redeeming" : "no-token");
  const [failure, setFailure] = useState<string | null>(null);

  // The token is single-use and is spent by the *attempt*, success or not, so
  // it must be posted exactly once. React runs effects twice in development's
  // StrictMode, which would burn the token on the first run and show the user
  // the failure from the second.
  const redeemed = useRef(false);

  useEffect(() => {
    if (!token || redeemed.current) return;
    redeemed.current = true;

    let cancelled = false;

    magicLinkSignIn(token)
      .then(() => {
        // Cookies are set. A full page load rather than a client-side push:
        // every other auth path in this app hands off the same way, and the
        // providers that cache session state resolve on mount, not on route
        // change. `localePath` keeps the reader in the language they arrived in.
        window.location.href = localePath(locale, "/shop");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // MAGIC_LINK_INVALID and MAGIC_LINK_EXPIRED are both 401 and both mean
        // the same thing to the person holding a dead link: ask the bot for a
        // new one. Never retry the token — it is already spent.
        setFailure(translateError(tErrors, err, t("failedBody")));
        setState("failed");
      });

    return () => {
      cancelled = true;
    };
  }, [token, locale, t, tErrors]);

  // ── A link that arrived without its token ──────────────────────────────────
  if (state === "no-token") {
    return (
      <AuthCard title={t("title")}>
        <Refusal body={t("missingToken")} />
      </AuthCard>
    );
  }

  if (state === "failed") {
    return (
      <AuthCard title={t("failedTitle")}>
        <Refusal body={failure ?? t("failedBody")} />
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t("title")} subtitle={t("subtitle")}>
      <div
        className="flex flex-col items-center gap-4 py-6 text-center"
        role="status"
        aria-live="polite"
      >
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" aria-hidden="true" />
        <p className="text-sm text-[var(--text-secondary)]">{t("redeeming")}</p>
      </div>
    </AuthCard>
  );
}

/**
 * Every refusal on this page has the same remedy — send `/login` again — so
 * they share one presentation rather than four near-identical branches.
 */
function Refusal({ body }: { body: string }) {
  const t = useTranslations("magicLogin");

  return (
    <div className="flex flex-col items-center gap-4 py-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10">
        <AlertCircle className="h-7 w-7 text-red-500" aria-hidden="true" />
      </div>

      <p className="text-sm text-[var(--text-secondary)]" role="alert">
        {body}
      </p>

      <a
        href={buildWhatsAppUrl(BOT_COMMANDS.login)}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary mt-1 flex w-full items-center justify-center gap-2"
      >
        <MessageCircle className="h-4 w-4" aria-hidden="true" />
        {t("retryCta")}
      </a>

      <Link
        href="/login"
        className="text-xs text-[var(--text-muted)] transition-colors hover:text-primary-600"
      >
        {t("backToSignIn")}
      </Link>
    </div>
  );
}

export default function MagicLinkPage() {
  // `useSearchParams` needs a Suspense boundary to keep the route statically
  // renderable — same shape as /reset-password and /verify-email.
  return (
    <Suspense fallback={null}>
      <MagicLinkContent />
    </Suspense>
  );
}
