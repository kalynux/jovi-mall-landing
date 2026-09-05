"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { verifyEmail } from "@/lib/auth/auth.api";
import { errorCodeOf, translateError } from "@/lib/auth/error-translator";
import { ORIGIN_PARAM, parseOriginRole } from "@/lib/me/confirm-origin";
import TokenOutcome, { ReturnCta } from "@/components/auth/TokenOutcome";

type Status = "verifying" | "success" | "error";

/**
 * Registration email verification — the *other* emailed token, and a different
 * flow from `/account/confirm-email` despite the family resemblance.
 *
 * This one marks `email_verified` on the role profile. It mints no session and
 * signs nobody in, which is why the way out is a sign-in link rather than a
 * link into an account screen: the person reading the mail is very often not
 * signed in anywhere.
 *
 * ── Role-free for the same reason its sibling is ─────────────────────────────
 *
 * The token names the account *and* the role — the backend stored both against
 * it when the mail was sent — so this page needs to know neither. Customers,
 * vendors, agencies and agents all land here, and the only role-aware thing on
 * the screen is which app the success button points at (`?app=`, see
 * `lib/me/confirm-origin.ts`). An absent hint is normal and falls back to
 * sign-in on this site.
 *
 * ⚠ **`verifyEmail` POSTs, and prefers POST for a reason** — a `GET` that
 * mutates is spent by mail-client and scanner prefetch before the person taps
 * it. It falls back to the legacy `GET` only on a 404/405, so links minted by an
 * older backend keep working. See the note on `verifyEmail` itself.
 */
function VerifyEmailContent() {
    const t = useTranslations("verifyEmail");
    const tErrors = useTranslations("errors");
    const tRole = useTranslations("roleCta");
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const origin = parseOriginRole(searchParams.get(ORIGIN_PARAM));

    // A link with no token is knowable at render time — not something an effect
    // discovers and then re-renders to report.
    const [status, setStatus] = useState<Status>(token ? "verifying" : "error");
    const [message, setMessage] = useState<string | null>(
        token ? null : t("missingToken")
    );

    // The token is single-use, so a StrictMode double-invoke would spend it and
    // then report the second call's "invalid" as the outcome.
    const startedRef = useRef(false);

    useEffect(() => {
        if (!token || startedRef.current) return;
        startedRef.current = true;

        let cancelled = false;
        verifyEmail(token)
            .then(() => {
                if (!cancelled) setStatus("success");
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                /**
                 * Two codes get page-specific copy; everything else goes through
                 * the shared ladder.
                 *
                 * ⚠ `AUTH_VERIFY_TOKEN_INVALID` is **one code for three
                 * situations** — unknown, expired, and *already spent*. The
                 * shared `errors.` string says "invalid or has expired", which
                 * is a dead end for what is very often the ordinary case: a
                 * reopened link on an address that is already verified. So the
                 * copy here leaves room for that and names the way to check.
                 *
                 * ⚠ `RATE_LIMIT_EXCEEDED` — this route is in the strict
                 * credential bucket (20/min/**IP**), so behind a shared NAT the
                 * person throttled is usually not the one who spent the budget.
                 * Never retry it: the client rotates only on a 401, and nothing
                 * on this page loops.
                 */
                const code = errorCodeOf(err);
                setMessage(
                    code === "AUTH_VERIFY_TOKEN_INVALID"
                        ? t("tokenSpent")
                        : code === "RATE_LIMIT_EXCEEDED"
                          ? t("rateLimited")
                          : translateError(tErrors, err, t("errorBody"))
                );
                setStatus("error");
            });

        return () => {
            cancelled = true;
        };
        // `token` is read once on mount; translators are stable for this flow.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    if (status === "verifying") {
        return <TokenOutcome title={t("title")} tone="pending" message={t("verifying")} />;
    }

    const appLabel =
        origin === "vendor"
            ? tRole("dashboardVendor")
            : origin === "agency"
              ? tRole("dashboardAgency")
              : tRole("dashboardAgent");

    if (status === "success") {
        return (
            <TokenOutcome
                title={t("title")}
                tone="success"
                heading={t("successTitle")}
                message={t("successBody")}
            >
                <ReturnCta
                    origin={origin}
                    customerHref="/login"
                    customerLabel={t("goToLogin")}
                    appLabel={appLabel}
                />
            </TokenOutcome>
        );
    }

    return (
        <TokenOutcome
            title={t("title")}
            tone="error"
            heading={t("errorTitle")}
            message={message ?? t("errorBody")}
        >
            <ReturnCta
                origin={origin}
                customerHref="/login"
                customerLabel={t("backToLogin")}
                appLabel={appLabel}
                className="btn-secondary w-full text-center"
            />
        </TokenOutcome>
    );
}

export default function VerifyEmailPage() {
    return (
        <Suspense
            fallback={
                <div className="flex justify-center p-8">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" />
                </div>
            }
        >
            <VerifyEmailContent />
        </Suspense>
    );
}
