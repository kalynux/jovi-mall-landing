"use client";

import { useState, useEffect, useRef, useId, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import type { ErrorCode } from "@/lib/auth/backend-error-codes";
import type { ErrorCategory } from "@/lib/auth/error-categories";
import { shouldExposeRequestId } from "@/lib/auth/shouldExposeRequestId";

// ─── Public API ───────────────────────────────────────────────────────────────

export interface GlobalErrorProps {
    /**
     * Translated error message to display.
     * Pass `formState.errors.root?.message`.
     * Renders nothing when falsy — no layout shift.
     */
    message: string | undefined;
    /**
     * Support trace ID from the API response envelope.
     * Pass `parseRootType(errors.root?.type as string | undefined).requestId`
     * (we pack it into root.type to avoid extending RHF's types).
     */
    requestId?: string;
    /**
     * The backend error code that produced this error.
     * Pass `parseRootType(...).errorCode`.
     */
    errorCode?: ErrorCode;
    /**
     * The error envelope's nine-value category. Together with `errorCode` this
     * drives automatic vs. toggle-only requestId visibility — and it is the
     * authoritative half. Pass `parseRootType(...).category`.
     */
    category?: ErrorCategory;
    /**
     * The one thing that fixes this error, when there is one — a link or a
     * button, rendered inside the banner under the message.
     *
     * Inside rather than below, because it answers this message and no other:
     * a free-standing link under the banner reads as part of the form, and it
     * sits right above the form's own submit button, which is the one action
     * that will NOT help. Ignored when there is no message.
     */
    action?: ReactNode;
    /** Extra Tailwind classes for layout overrides. */
    className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Accessible global error banner for auth forms.
 *
 * Behaviour matrix:
 * ┌──────────────────────┬──────────────────────────────────────────────────┐
 * │ Condition            │ Result                                           │
 * ├──────────────────────┼──────────────────────────────────────────────────┤
 * │ No message           │ Renders nothing (zero layout shift)              │
 * │ System-level code    │ requestId shown inline, muted, no toggle needed  │
 * │ User-actionable code │ Chevron toggle top-right; requestId panel below  │
 * │   └ panel open       │ Fade-in 150ms; Esc closes; outside click closes  │
 * │ No requestId         │ No toggle button rendered at all                 │
 * └──────────────────────┴──────────────────────────────────────────────────┘
 *
 * Accessibility:
 *   - Error container: role="alert" + aria-live="polite" + aria-atomic="true"
 *   - Toggle button:   aria-expanded + aria-controls
 *   - requestId panel: plain <div> — NOT role=alert (avoids double announcement)
 */
export function GlobalError({
    message,
    requestId,
    errorCode,
    category,
    action,
    className = "",
}: GlobalErrorProps) {
    const tErrors = useTranslations("errors");

    // Unique IDs for aria-controls linkage
    const panelId = useId();

    // Is the requestId panel manually open?
    const [isOpen, setIsOpen] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);

    // Resolve display mode
    const autoShow = shouldExposeRequestId(errorCode, category);
    const hasToggle = Boolean(requestId) && !autoShow;

    // Close on Escape
    useEffect(() => {
        if (!isOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsOpen(false);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [isOpen]);

    // Close on outside click
    useEffect(() => {
        if (!isOpen) return;
        const onPointer = (e: PointerEvent) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener("pointerdown", onPointer);
        return () => document.removeEventListener("pointerdown", onPointer);
    }, [isOpen]);

    // Reset toggle when the error changes
    useEffect(() => {
        // Collapses the requestId panel when a DIFFERENT error arrives.
        //
        // ⚠ KNOWN EXCEPTION, NOT A DISMISSAL. React's preferred form is to adjust
        //   state during render on an identity change, or to let the parent pass a
        //   `key`. Both are small refactors of a live error banner. The effect is
        //   correct in the meantime: it runs once per error and the only state it
        //   touches is this component's own disclosure toggle.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsOpen(false);
    }, [message, requestId]);

    if (!message) return null;

    return (
        // Wrapper: position:relative allows the toggle button to be placed
        // absolute top-right WITHOUT affecting the layout flow of the banner.
        // The requestId panel sits OUTSIDE this wrapper so it cannot push the
        // banner's height.
        <div ref={containerRef} className="global-error-root">
            {/* ── Error banner ─────────────────────────────────────────────── */}
            <div
                role="alert"
                aria-live="polite"
                aria-atomic="true"
                className={[
                    "global-error-banner",
                    "relative",
                    "rounded-xl px-4 py-3",
                    "bg-red-500/10 border border-red-500/20",
                    "text-sm text-red-600 font-medium",
                    // Right padding extended when toggle button is present
                    // so text never overlaps the chevron
                    hasToggle ? "pr-10" : "",
                    className,
                ]
                    .filter(Boolean)
                    .join(" ")}
            >
                <p className="leading-snug">{message}</p>

                {action && <div className="mt-2.5">{action}</div>}

                {/* Auto-show requestId — inline, no toggle required */}
                {autoShow && requestId && (
                    <p className="mt-1 text-xs text-red-400 font-normal leading-snug">
                        {tErrors("request_id", { id: requestId })}
                    </p>
                )}

                {/* Toggle button — absolute top-right, zero layout impact */}
                {hasToggle && (
                    <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                        aria-label={isOpen ? "Hide support details" : "Show support details"}
                        onClick={() => setIsOpen((prev) => !prev)}
                        className={[
                            "global-error-toggle",
                            "absolute top-2.5 right-3",
                            "flex items-center justify-center",
                            "w-5 h-5 rounded-md",
                            "text-red-400 hover:text-red-600",
                            "hover:bg-red-500/10",
                            "transition-colors duration-100",
                            "focus-visible:outline-none focus-visible:ring-2",
                            "focus-visible:ring-red-500/40",
                        ].join(" ")}
                    >
                        <ChevronDown
                            className={[
                                "w-3.5 h-3.5",
                                "transition-transform duration-150",
                                isOpen ? "rotate-180" : "rotate-0",
                            ].join(" ")}
                            aria-hidden="true"
                        />
                    </button>
                )}
            </div>

            {/* ── RequestId panel — outside the banner, no layout push ──────── */}
            {/*
             * Rendered below the banner via the root's flex-col layout.
             * Positioned OUTSIDE the role=alert so screen readers don't
             * re-announce the whole error when the panel opens.
             * The opacity/max-height transition provides the fade-in without
             * any layout reflow.
             */}
            {hasToggle && requestId && (
                <div
                    id={panelId}
                    className={[
                        "global-error-panel",
                        "overflow-hidden transition-all duration-150 ease-out",
                        isOpen
                            ? "opacity-100 max-h-20 mt-1.5"
                            : "opacity-0 max-h-0 pointer-events-none",
                    ].join(" ")}
                    // Hidden from accessibility tree when closed
                    aria-hidden={!isOpen}
                >
                    <div
                        className={[
                            "px-3 py-2 rounded-lg",
                            "bg-[var(--surface-raised,#fff)]",
                            "border border-red-500/15",
                            "shadow-sm shadow-red-500/5",
                            "text-xs text-[var(--text-muted)]",
                            "font-mono tracking-tight",
                            "max-w-full",
                        ].join(" ")}
                    >
                        {tErrors("request_id", { id: requestId })}
                    </div>
                </div>
            )}
        </div>
    );
}
