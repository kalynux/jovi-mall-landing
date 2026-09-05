"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { confirmEmailChange } from "@/lib/me/contact.api";
import { errorCodeOf } from "@/lib/auth/error-translator";
import { ORIGIN_PARAM, parseOriginRole } from "@/lib/me/confirm-origin";
import TokenOutcome, { ReturnCta } from "@/components/auth/TokenOutcome";

type Status = "confirming" | "success" | "error";

/**
 * The landing page for the "confirm your new email address" link.
 *
 * ── Why this route lives here, and why the URL must not move ─────────────────
 *
 * The backend builds the link as
 * `{STOREFRONT_URL}/account/confirm-email?token=…&app={role}`
 * (`contact-change.service.ts`), from a single environment variable with no role
 * branch — so a vendor, an agency and an agent all arrive at this page. It is in
 * the `(auth)` route group purely for the chrome and the `noindex` that group's
 * layout carries; a route group is not a path segment, so the URL is still
 * exactly `/account/confirm-email` and still matches the link as sent. With
 * `localePrefix: "as-needed"`, the unprefixed path is the English route.
 *
 * ── One page for four apps is correct, not a compromise ──────────────────────
 *
 * `POST /api/auth/email-change/confirm` reads no `req.auth` and takes no actor.
 * It resolves the account from the SHA-256 of the token, moves `login_email`,
 * and syncs the new address onto **every** role profile the account holds. The
 * confirmation is genuinely role-free. The only role-aware thing on this screen
 * is the way back out — see `lib/me/confirm-origin.ts`.
 *
 * ── 🔴 It POSTs the token; it must never GET it ──────────────────────────────
 *
 * Unauthenticated because the link is opened in a mail client, which is
 * routinely not the browser that started the change and often not the same
 * device — requiring a session would break the flow for exactly the people it is
 * for, and the token is itself the credential.
 *
 * A POST because a `GET` that mutates is spent by whatever prefetches the mail:
 * link scanners, corporate relays, the mail client's own preview. So the page
 * loads, reads `?token=`, and makes the call itself.
 *
 * The failure codes are kept apart on purpose — "start again", "check the link
 * you clicked" and "somebody else took that address" are three different
 * instructions, and collapsing them is the thing the contract asks us not to do.
 */
function ConfirmEmailContent() {
    const t = useTranslations("confirmEmail");
    const tRole = useTranslations("roleCta");
    const searchParams = useSearchParams();
    const token = searchParams.get("token");
    const origin = parseOriginRole(searchParams.get(ORIGIN_PARAM));

    // A link with no token is knowable at render time, so it is the initial
    // state rather than something an effect discovers and then re-renders to
    // report.
    const [status, setStatus] = useState<Status>(token ? "confirming" : "error");
    const [message, setMessage] = useState<string | null>(
        token ? null : t("missingToken")
    );
    /** The address that is now the sign-in, straight from the confirm response. */
    const [email, setEmail] = useState<string | null>(null);

    // The token is single-use, so a StrictMode double-invoke would spend it and
    // then report the second call's "invalid" as the outcome.
    const startedRef = useRef(false);

    useEffect(() => {
        if (!token || startedRef.current) return;
        startedRef.current = true;

        let cancelled = false;
        confirmEmailChange(token)
            .then((result) => {
                if (cancelled) return;
                setEmail(result.email);
                setStatus("success");
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                /**
                 * ⚠ `CONTACT_CHANGE_IDENTIFIER_TAKEN` belongs here, not only on
                 * the request form: the address was free when the change was
                 * opened and somebody claimed it in the hour since. It is the
                 * one failure on this screen the person cannot fix by finding a
                 * better link.
                 *
                 * ⚠ `RATE_LIMIT_EXCEEDED` needs its own copy because the generic
                 * fallback says "please try again" — the one instruction that
                 * makes a 429 worse. This route is in the strict credential
                 * bucket (20/min/**IP**), so behind a shared NAT the person
                 * being throttled is usually not the one who spent the budget,
                 * and a retry loop takes the whole address down with them.
                 * Nothing here retries: the client rotates only on a 401.
                 */
                const code = errorCodeOf(err);
                const key =
                    code === "CONTACT_CHANGE_EXPIRED"
                        ? "expired"
                        : code === "CONTACT_CHANGE_TOKEN_INVALID"
                          ? "invalid"
                          : code === "CONTACT_CHANGE_NOT_PENDING"
                            ? "notPending"
                            : code === "CONTACT_CHANGE_IDENTIFIER_TAKEN"
                              ? "taken"
                              : code === "RATE_LIMIT_EXCEEDED"
                                ? "rateLimited"
                                : code === "NETWORK_ERROR"
                                  ? "network"
                                  : "generic";
                setMessage(t(key));
                setStatus("error");
            });

        return () => {
            cancelled = true;
        };
        // `token` is read once on mount; the translator is stable for this flow.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [token]);

    if (status === "confirming") {
        return <TokenOutcome title={t("title")} tone="pending" message={t("confirming")} />;
    }

    /**
     * A contact change deliberately does not stamp `password_changed_at`, so it
     * signs nobody out — there is a session to go back to, on whichever app
     * started this.
     */
    const cta = (
        <ReturnCta
            origin={origin}
            customerHref="/shop/account/security"
            customerLabel={t("backToAccount")}
            appLabel={
                origin === "vendor"
                    ? tRole("dashboardVendor")
                    : origin === "agency"
                      ? tRole("dashboardAgency")
                      : tRole("dashboardAgent")
            }
            className={
                status === "success"
                    ? "btn-primary w-full text-center"
                    : "btn-secondary w-full text-center"
            }
        />
    );

    if (status === "success") {
        return (
            <TokenOutcome
                title={t("title")}
                tone="success"
                heading={t("successTitle")}
                message={email ? t("successBody", { email }) : t("successBodyGeneric")}
            >
                {cta}
            </TokenOutcome>
        );
    }

    return (
        <TokenOutcome
            title={t("title")}
            tone="error"
            heading={t("errorTitle")}
            message={message ?? t("generic")}
        >
            {cta}
        </TokenOutcome>
    );
}

export default function ConfirmEmailPage() {
    return (
        <Suspense
            fallback={
                <div className="flex justify-center p-8">
                    <Loader2 className="w-8 h-8 animate-spin text-[var(--text-muted)]" />
                </div>
            }
        >
            <ConfirmEmailContent />
        </Suspense>
    );
}
