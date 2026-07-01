"use client";

/**
 * WhatsAppVerificationModal
 *
 * Blocking modal gate that must be completed before the user can access
 * their role dashboard. Cannot be closed without verifying or logging out.
 *
 * State machine:
 *   pre_checking → idle → requesting → code_generated → checking → polling
 *               ↘ success (onSuccess called)
 *               ↘ expired  (countdown reached 0)
 *               ↘ error    (unrecoverable network failure)
 */

import {
    useEffect,
    useRef,
    useState,
    useCallback,
    useId,
    type KeyboardEvent,
} from "react";
import {
    MessageCircle,
    Copy,
    ExternalLink,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Clock,
    RefreshCw,
} from "lucide-react";
import { useTranslations } from "next-intl";
import * as api from "@/lib/auth/auth.api";
import type { AuthRoleEntity, WaVerificationCodeResponse } from "@/lib/auth/auth.types";

// ─── State Machine ────────────────────────────────────────────────────────────

type VerificationState =
    | "pre_checking"    // mount: GET /link/status before showing any UI
    | "idle"            // not linked → show checkbox + "Request Verification Code"
    | "requesting"      // POSTing /auth/request-wa-verification
    | "code_generated"  // code/command/wa_link displayed; countdown running
    | "checking"        // first GET /link/status after "I Have Sent the Code"
    | "polling"         // setInterval running (up to 3 × 5 s)
    | "success"         // linked=true → calling onSuccess()
    | "expired"         // countdown hit 0
    | "failed"          // polling max attempts reached
    | "error";          // unrecoverable network error

const MAX_POLL_ATTEMPTS = 5;
const POLL_INTERVAL_MS = 5_000;

// ─── Props ────────────────────────────────────────────────────────────────────

interface WhatsAppVerificationModalProps {
    roleEntity: AuthRoleEntity;
    /** Called once the WA number is confirmed linked. Triggers redirect. */
    onSuccess: () => void;
    /** Optional logout escape hatch. Modal has no other close path. */
    onLogout?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WhatsAppVerificationModal({
    roleEntity,
    onSuccess,
    onLogout,
}: WhatsAppVerificationModalProps) {
    const t = useTranslations("waVerification");

    // Accessibility IDs
    const titleId = useId();
    const descId = useId();

    // ── Core state ──────────────────────────────────────────────────────────
    const [verState, setVerState] = useState<VerificationState>("pre_checking");
    const [updateOtherRoles, setUpdateOtherRoles] = useState(false);
    const [codeData, setCodeData] = useState<WaVerificationCodeResponse | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    /** Seconds remaining on the current code. Derived from expiresAt ref. */
    const [secondsLeft, setSecondsLeft] = useState<number>(0);

    // ── Refs for interval handles (never stale) ──────────────────────────────
    const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollAttemptsRef = useRef(0);
    const expiresAtRef = useRef<number>(0);

    // Focus trap ref
    const dialogRef = useRef<HTMLDivElement>(null);

    // ── Cleanup helpers ──────────────────────────────────────────────────────
    const clearPollInterval = useCallback(() => {
        if (pollIntervalRef.current !== null) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    }, []);

    const clearCountdownInterval = useCallback(() => {
        if (countdownIntervalRef.current !== null) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
        }
    }, []);

    // Full cleanup (called on unmount too)
    useEffect(() => {
        return () => {
            clearPollInterval();
            clearCountdownInterval();
        };
    }, [clearPollInterval, clearCountdownInterval]);

    // ── Trap focus inside modal ──────────────────────────────────────────────
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        // Focus first focusable element
        const firstFocusable = dialog.querySelector<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        firstFocusable?.focus();
    }, [verState]);

    const handleFocusTrap = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== "Tab") return;
        const dialog = dialogRef.current;
        if (!dialog) return;

        const focusable = Array.from(
            dialog.querySelectorAll<HTMLElement>(
                'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )
        );
        if (focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    };

    // ── Status check (shared between pre_checking and polling) ───────────────
    const checkStatus = useCallback(async (): Promise<boolean> => {
        try {
            const status = await api.getWaLinkStatus();
            return status.linked && Boolean(status.wa_phone_id);
        } catch {
            return false;
        }
    }, []);

    // ── Start countdown timer ────────────────────────────────────────────────
    const startCountdown = useCallback(
        (expiresInSeconds: number) => {
            clearCountdownInterval();
            expiresAtRef.current = Date.now() + expiresInSeconds * 1000;
            setSecondsLeft(expiresInSeconds);

            countdownIntervalRef.current = setInterval(() => {
                const remaining = Math.ceil(
                    (expiresAtRef.current - Date.now()) / 1000
                );

                if (remaining <= 0) {
                    clearCountdownInterval();
                    clearPollInterval();
                    setSecondsLeft(0);
                    setVerState("expired");
                } else {
                    setSecondsLeft(remaining);
                }
            }, 1000);
        },
        [clearCountdownInterval, clearPollInterval]
    );

    // ── Start polling (after first status check returns false) ───────────────
    const startPolling = useCallback(() => {
        clearPollInterval();
        pollAttemptsRef.current = 0;
        setVerState("polling");

        pollIntervalRef.current = setInterval(async () => {
            pollAttemptsRef.current += 1;
            const linked = await checkStatus();

            if (linked) {
                clearPollInterval();
                clearCountdownInterval();
                setVerState("success");
                onSuccess();
                return;
            }

            if (pollAttemptsRef.current >= MAX_POLL_ATTEMPTS) {
                clearPollInterval();
                clearCountdownInterval();
                setSecondsLeft(0);
                setVerState("failed");
            }
        }, POLL_INTERVAL_MS);
    }, [checkStatus, clearPollInterval, clearCountdownInterval, onSuccess]);

    // ── Mount: pre_checking ──────────────────────────────────────────────────
    useEffect(() => {
        let alive = true;

        (async () => {
            const linked = await checkStatus();
            if (!alive) return;

            if (linked) {
                setVerState("success");
                onSuccess();
            } else {
                setVerState("idle");
            }
        })();

        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // intentionally runs once on mount only

    // ── Request verification code ────────────────────────────────────────────
    const handleRequestCode = async () => {
        setVerState("requesting");
        setErrorMessage(null);
        clearPollInterval();
        clearCountdownInterval();

        try {
            const data = await api.requestWaVerification(updateOtherRoles);
            setCodeData(data);
            setVerState("code_generated");
            startCountdown(data.expires_in_seconds);
        } catch (err) {
            const msg =
                err instanceof Error ? err.message : t("genericError");
            setErrorMessage(msg);
            setVerState("error");
        }
    };

    // ── "I Have Sent the Code" ────────────────────────────────────────────────
    const handleSentCode = async () => {
        setVerState("checking");

        const linked = await checkStatus();

        if (linked) {
            clearPollInterval();
            clearCountdownInterval();
            setVerState("success");
            onSuccess();
            return;
        }

        startPolling();
    };

    // ── Retry from expired / failed state ───────────────────────────────────
    const handleRetry = () => {
        clearPollInterval();
        clearCountdownInterval();
        setCodeData(null);
        setErrorMessage(null);
        pollAttemptsRef.current = 0;
        setVerState("idle");
    };

    // ── Copy command to clipboard ────────────────────────────────────────────
    const handleCopy = async () => {
        if (!codeData?.command) return;
        try {
            await navigator.clipboard.writeText(codeData.command);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard not available — silent fail
        }
    };

    // ── Copy command to clipboard ────────────────────────────────────────────
    const handleCopyBotNumber = async () => {
        if (!codeData?.bot_number) return;
        try {
            await navigator.clipboard.writeText(codeData.bot_number);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard not available — silent fail
        }
    };

    // ── Format countdown ────────────────────────────────────────────────────
    const formatCountdown = (secs: number) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${String(s).padStart(2, "0")}`;
    };

    // ── Derived display flags ────────────────────────────────────────────────
    const isLoading =
        verState === "pre_checking" ||
        verState === "requesting" ||
        verState === "checking";

    const showCodeUI =
        verState === "code_generated" ||
        verState === "polling" ||
        verState === "checking";

    const canSendCode = verState === "code_generated";
    const isPolling = verState === "polling";
    const isExpired = verState === "expired";
    const isFailed = verState === "failed";
    const isError = verState === "error";

    // ─────────────────────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────────────────────

    return (
        /* ── Overlay ── */
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)" }}
            aria-hidden="false"
        >
            {/* ── Dialog card ── */}
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                aria-describedby={descId}
                onKeyDown={handleFocusTrap}
                className="relative w-full max-w-md rounded-2xl shadow-2xl overflow-hidden bg-[var(--bg)] border border-[var(--border,rgba(0,0,0,0.1))]"
            >
                {/* ── Header ── */}
                <div className="flex flex-col items-center gap-4 px-6 pt-8 pb-2 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-wa/10 flex items-center justify-center">
                        <MessageCircle className="w-8 h-8 text-wa-dark dark:text-wa" aria-hidden="true" />
                    </div>
                    <div className="space-y-1">
                        <h2
                            id={titleId}
                            className="font-display font-semibold text-lg text-[var(--text-primary,#111)] leading-tight"
                        >
                            {t("title")}
                        </h2>
                        <p className="text-sm text-[var(--text-muted,#888)]">
                            {t("subtitle")}
                        </p>
                    </div>
                </div>

                {/* ── Body ── */}
                <div className="px-6 pb-6 pt-2 flex flex-col gap-5">

                    {/* ── Pre-checking / loading spinner ── */}
                    {isLoading && verState !== "checking" && (
                        <div
                            className="flex flex-col items-center gap-3 py-6"
                            aria-live="polite"
                        >
                            <Loader2 className="w-8 h-8 animate-spin text-primary-500" aria-hidden="true" />
                            <p
                                id={descId}
                                className="text-sm text-[var(--text-secondary,#666)]"
                            >
                                {t("checking")}
                            </p>
                        </div>
                    )}

                    {/* ── Idle: checkbox + request button ── */}
                    {verState === "idle" && (
                        <>
                            <p
                                id={descId}
                                className="text-sm text-center text-[var(--text-secondary,#666)] leading-relaxed"
                            >
                                {t("description")}
                            </p>

                            {/* Global toggle checkbox */}
                            <label className="flex items-start gap-3 cursor-pointer group">
                                <div className="relative mt-0.5 flex-shrink-0">
                                    <input
                                        type="checkbox"
                                        checked={updateOtherRoles}
                                        onChange={(e) => setUpdateOtherRoles(e.target.checked)}
                                        className="sr-only"
                                        aria-describedby="wa-update-roles-desc"
                                    />
                                    <div
                                        className={[
                                            "w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-150",
                                            updateOtherRoles
                                                ? "bg-primary-500 border-primary-500"
                                                : "border-[var(--border,rgba(0,0,0,0.2))] group-hover:border-primary-500",
                                        ].join(" ")}
                                        onClick={() => setUpdateOtherRoles((v) => !v)}
                                        aria-hidden="true"
                                    >
                                        {updateOtherRoles && (
                                            <svg
                                                className="w-3 h-3 text-white"
                                                viewBox="0 0 12 12"
                                                fill="none"
                                                aria-hidden="true"
                                            >
                                                <path
                                                    d="M2 6l3 3 5-5"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                />
                                            </svg>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <span className="text-sm font-medium text-[var(--text-primary,#111)]">
                                        {t("updateOtherRolesLabel")}
                                    </span>
                                    <p
                                        id="wa-update-roles-desc"
                                        className="text-xs text-[var(--text-muted,#888)] mt-0.5"
                                    >
                                        {t("updateOtherRolesDesc")}
                                    </p>
                                </div>
                            </label>

                            <button
                                type="button"
                                onClick={handleRequestCode}
                                className="btn-primary w-full flex items-center justify-center gap-2"
                            >
                                <MessageCircle className="w-4 h-4" aria-hidden="true" />
                                {t("requestCodeBtn")}
                            </button>
                        </>
                    )}

                    {/* ── Code generated / checking / polling ── */}
                    {showCodeUI && codeData && (
                        <>
                            {/* Instructions */}
                            <div className="rounded-xl p-4 text-sm text-[var(--text-secondary,#666)] bg-[var(--bg-subtle)] border border-[var(--border,rgba(0,0,0,0.08))]">
                                <p className="font-medium text-[var(--text-primary,#111)] mb-1">
                                    {t("instructionsHeader")}
                                </p>
                                <div className="leading-relaxed whitespace-pre-line">
                                    {t("commandInstructionPart1")}
                                    <span className="font-semibold text-[var(--text-primary,#111)]">▪</span>
                                    <a
                                        href={codeData.wa_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary-600 hover:text-primary-700 underline underline-offset-2 mx-1"
                                    >
                                        {t("commandInstructionLinkText")}
                                    </a>
                                    <span className="font-semibold text-[var(--text-primary,#111)]">▪</span>
                                    {t("commandInstructionPart2")}
                                    <span className="font-semibold text-[var(--text-primary,#111)]">▪</span>
                                    <button
                                        type="button"
                                        onClick={handleCopyBotNumber}
                                        className="text-primary-600 hover:text-primary-700 underline underline-offset-2 transition-colors cursor-pointer mx-1"
                                        title={t("copyAriaLabel")}
                                    >
                                        {codeData.bot_number || "..."}
                                    </button>
                                    <span className="font-semibold text-[var(--text-primary,#111)]">▪</span>
                                    {t("commandInstructionPart3")}
                                    {copied && (
                                        <span className="text-green-600 dark:text-green-400"> ✓ </span>
                                    )}
                                </div>
                            </div>

                            {/* Combined Link + Copy Command Container */}
                            <div>
                                <p className="text-xs font-medium text-[var(--text-muted,#888)] uppercase tracking-wide mb-2">
                                    {t("commandLabel")}
                                </p>
                                <div className="flex bg-[var(--bg-subtle)] border border-[var(--border,rgba(0,0,0,0.08))] rounded-xl overflow-hidden h-14 relative group">

                                    {/* Action Area: Copy Command (Right) */}
                                    <button
                                        type="button"
                                        onClick={handleCopy}
                                        className="flex-1 px-4 flex items-center justify-between hover:bg-[var(--surface-hover,rgba(0,0,0,0.02))] dark:hover:bg-[var(--surface-hover,rgba(255,255,255,0.02))] transition-colors text-left"
                                        aria-label={t("copyAriaLabel")}
                                    >
                                        <code className={[
                                            "text-sm font-mono font-semibold truncate transition-colors duration-150",
                                            copied ? "text-green-600 dark:text-green-400" : "text-[var(--text-primary,#111)]"
                                        ].join(" ")}>
                                            {codeData.command}
                                        </code>

                                        <div className={[
                                            "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all duration-150 opacity-0 group-hover:opacity-100 sm:opacity-100",
                                            copied
                                                ? "bg-green-500/10 text-green-600 dark:text-green-400"
                                                : "bg-transparent text-[var(--text-muted)]"
                                        ].join(" ")}>
                                            {copied ? (
                                                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />
                                            ) : (
                                                <>
                                                    <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                                                    <span className="hidden sm:inline">{t("copyBtn")}</span>
                                                </>
                                            )}
                                        </div>
                                    </button>
                                    {/* Action Box: WhatsApp Link (Left) */}
                                    <a
                                        href={codeData.wa_link}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="h-full px-5 flex items-center justify-center bg-[var(--accent-light)] text-primary-600 hover:bg-primary-500/10 transition-colors border-r border-[var(--border,rgba(0,0,0,0.08))]"
                                        aria-label={t("openWhatsApp")}
                                        title={t("openWhatsApp")}
                                    >
                                        <ExternalLink className="w-5 h-5" aria-hidden="true" />
                                    </a>
                                </div>
                            </div>

                            {/* Countdown timer */}
                            {secondsLeft > 0 && (
                                <div className="flex items-center justify-center gap-2 text-xs text-[var(--text-muted,#888)]">
                                    <Clock className="w-3.5 h-3.5" aria-hidden="true" />
                                    <span aria-live="polite" aria-atomic="true">
                                        {t("expiresIn", { time: formatCountdown(secondsLeft) })}
                                    </span>
                                </div>
                            )}

                            {/* "I Have Sent the Code" */}
                            <button
                                type="button"
                                onClick={handleSentCode}
                                disabled={!canSendCode}
                                aria-busy={verState === "checking" || isPolling}
                                className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                {(verState === "checking" || isPolling) && (
                                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                                )}
                                {verState === "checking"
                                    ? t("checkingStatus")
                                    : isPolling
                                        ? t("pollingStatus")
                                        : t("sentCodeBtn")}
                            </button>

                            {/* Polling attempt indicator */}
                            {isPolling && (
                                <p
                                    className="text-xs text-center text-[var(--text-muted,#888)]"
                                    aria-live="polite"
                                >
                                    {t("pollingAttempt", {
                                        current: pollAttemptsRef.current,
                                        max: MAX_POLL_ATTEMPTS,
                                    })}
                                </p>
                            )}
                        </>
                    )}

                    {/* ── Expired ── */}
                    {isExpired && (
                        <div className="flex flex-col items-center gap-4 py-2 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                                <Clock className="w-7 h-7 text-amber-500" aria-hidden="true" />
                            </div>
                            <div>
                                <p className="font-semibold text-[var(--text-primary,#111)]">
                                    {t("expiredTitle")}
                                </p>
                                <p className="text-sm text-[var(--text-secondary,#666)] mt-1">
                                    {t("expiredDesc")}
                                </p>
                            </div>
                            <button
                                type="button"
                                // onClick={handleRetry}
                                onClick={handleRequestCode}
                                className="btn-primary w-full flex items-center justify-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                                {t("requestNewCodeBtn")}
                            </button>
                        </div>
                    )}

                    {/* ── Failed ── */}
                    {isFailed && (
                        <div className="flex flex-col items-center gap-4 py-2 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
                                <AlertCircle className="w-7 h-7 text-red-500" aria-hidden="true" />
                            </div>
                            <div>
                                <p className="font-semibold text-[var(--text-primary,#111)]">
                                    {t("failedTitle")}
                                </p>
                                <p className="text-sm text-[var(--text-secondary,#666)] mt-1">
                                    {t("failedDesc")}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleRequestCode}
                                className="btn-primary w-full flex items-center justify-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                                {t("requestNewCodeBtn")}
                            </button>
                        </div>
                    )}

                    {/* ── Error ── */}
                    {isError && (
                        <div className="flex flex-col items-center gap-4 py-2 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
                                <AlertCircle className="w-7 h-7 text-red-500" aria-hidden="true" />
                            </div>
                            <div>
                                <p className="font-semibold text-[var(--text-primary,#111)]">
                                    {t("errorTitle")}
                                </p>
                                {errorMessage && (
                                    <p className="text-sm text-red-600 dark:text-red-400 mt-1">{errorMessage}</p>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={handleRetry}
                                className="btn-primary w-full flex items-center justify-center gap-2"
                            >
                                <RefreshCw className="w-4 h-4" aria-hidden="true" />
                                {t("tryAgain")}
                            </button>
                        </div>
                    )}

                    {/* ── Success (brief flash before onSuccess fires) ── */}
                    {verState === "success" && (
                        <div className="flex flex-col items-center gap-3 py-4 text-center">
                            <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center">
                                <CheckCircle2 className="w-7 h-7 text-green-500" aria-hidden="true" />
                            </div>
                            <p className="font-semibold text-[var(--text-primary,#111)]">
                                {t("successTitle")}
                            </p>
                            <Loader2 className="w-5 h-5 animate-spin text-[var(--text-muted,#888)]" aria-hidden="true" />
                        </div>
                    )}
                </div>

                {/* ── Footer: logout escape hatch ── */}
                {onLogout && (
                    <div
                        className="px-6 py-4 flex justify-center"
                        style={{
                            borderTop: "1px solid var(--border, rgba(0,0,0,0.08))",
                        }}
                    >
                        <button
                            type="button"
                            onClick={onLogout}
                            className="text-xs text-[var(--text-muted,#888)] hover:text-red-500 transition-colors"
                        >
                            {t("logoutLink")}
                        </button>
                    </div>
                )}
            </div>
        </div >
    );
}
