"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useSectionNav } from "@/components/scroll/SectionNavProvider";

/**
 * Vertical dot rail (desktop + mobile) that reflects and drives the full-page
 * scroll. State comes from SectionNavProvider — no own scroll listener.
 */
export default function SectionProgressIndicator() {
  const { sections, activeId, scrollToId } = useSectionNav();

  return (
    <nav
      className="fixed right-3 sm:right-5 top-1/2 z-40 flex -translate-y-1/2 flex-col gap-2"
      aria-label="Page progress"
    >
      {sections.map(({ id, label }) => {
        const isActive = id === activeId;
        return (
          <button
            key={id}
            onClick={() => scrollToId(id)}
            aria-label={`Go to ${label}`}
            aria-current={isActive ? "true" : undefined}
            title={label}
            className="group relative flex items-center justify-end gap-2 py-0.5"
          >
            {/* Label (reveals on hover) */}
            <span
              className={cn(
                "pointer-events-none whitespace-nowrap pr-1 text-[10px] font-display font-semibold",
                "translate-x-1 opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100",
                isActive ? "text-role" : "text-[var(--text-muted)]"
              )}
            >
              {label}
            </span>

            {/* Dot */}
            <motion.span
              animate={{ height: isActive ? 20 : 6 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                "w-1.5 flex-shrink-0 rounded-full",
                isActive
                  ? "bg-[var(--accent)] shadow-[0_0_10px_var(--accent-glow)]"
                  : "bg-[var(--accent-glow)] group-hover:bg-[var(--accent)]"
              )}
            />
          </button>
        );
      })}
    </nav>
  );
}
