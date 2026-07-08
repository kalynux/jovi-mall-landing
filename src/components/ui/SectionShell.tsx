"use client";
/**
 * SectionShell — the standard full-page section frame.
 *
 * Every landing section (except the bespoke Hero) renders inside one of these:
 *  • fills exactly one viewport (min-h-[100svh]) and vertically centres its
 *    content, so one scroll gesture maps to one section (see SectionNavProvider);
 *  • applies a per-role accent (`role-vendor` / `role-agency` / … via the
 *    `accent` prop) which sets the `--role` CSS var consumed by children
 *    (bg-role-soft, border-role-soft, shadow-role-glow, text-role, …);
 *  • paints a soft role-tinted radial glow behind the content.
 *
 * Entrance motion stays inside each section (AnimatedSection, once:true) — this
 * component is layout + tint only, keeping the animation logic centralised.
 */
import { cn } from "@/lib/utils";

interface SectionShellProps {
    id: string;
    /** Role-accent utility class, e.g. "role-vendor" (defaults to global accent). */
    accent?: string;
    className?: string;
    /** Extra classes for the inner centered container. */
    containerClassName?: string;
    /** Position of the role glow. */
    glow?: "top" | "center" | "none";
    children: React.ReactNode;
}

const GLOW: Record<"top" | "center", string> = {
    top: "radial-gradient(ellipse 70% 55% at 50% 0%, color-mix(in srgb, var(--role) 12%, transparent), transparent 70%)",
    center:
        "radial-gradient(ellipse 60% 50% at 50% 50%, color-mix(in srgb, var(--role) 10%, transparent), transparent 70%)",
};

export default function SectionShell({
    id,
    accent = "role-accent",
    className,
    containerClassName,
    glow = "top",
    children,
}: SectionShellProps) {
    return (
        <section
            id={id}
            className={cn(
                "relative flex min-h-[100svh] w-full items-center overflow-hidden section-padding",
                accent,
                className
            )}
        >
            {glow !== "none" && (
                <div
                    aria-hidden="true"
                    className="absolute inset-0 -z-0"
                    style={{ background: GLOW[glow] }}
                />
            )}
            <div className={cn("container-xl relative z-10", containerClassName)}>
                {children}
            </div>
        </section>
    );
}
