"use client";
import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SECTION_IDS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export default function SectionProgressIndicator() {
  const [activeSection, setActiveSection] = useState<string>("hero");
  const [visible, setVisible] = useState(false);

  const getActiveSection = useCallback(() => {
    const scrollY = window.scrollY;
    const windowHeight = window.innerHeight;

    // Show indicator after scrolling past hero
    setVisible(scrollY > windowHeight * 0.5);

    let current = SECTION_IDS[0].id;
    for (const { id } of SECTION_IDS) {
      const el = document.getElementById(id);
      if (!el) continue;
      const top = el.getBoundingClientRect().top;
      if (top <= windowHeight * 0.35) {
        current = id;
      }
    }
    setActiveSection(current);
  }, []);

  useEffect(() => {
    window.addEventListener("scroll", getActiveSection, { passive: true });
    getActiveSection();
    return () => window.removeEventListener("scroll", getActiveSection);
  }, [getActiveSection]);

  const activeIndex = SECTION_IDS.findIndex((s) => s.id === activeSection);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ duration: 0.3 }}
          className="fixed right-3 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-1.5 md:hidden"
          role="navigation"
          aria-label="Page progress"
        >
          {SECTION_IDS.map(({ id, label }, i) => {
            const isActive = id === activeSection;
            return (
              <button
                key={id}
                onClick={() => {
                  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
                }}
                aria-label={`Go to ${label}`}
                title={label}
                className="relative flex items-center justify-end gap-1.5 group"
              >
                {/* Label (shows on hover) */}
                <span className={cn(
                  "text-[9px] font-display font-semibold whitespace-nowrap",
                  "opacity-0 group-hover:opacity-100 pointer-events-none",
                  "transition-opacity duration-200 pr-1",
                  isActive ? "text-primary-600" : "text-[var(--text-muted)]"
                )}>
                  {label}
                </span>

                {/* Dot */}
                <motion.div
                  animate={{
                    width: isActive ? 18 : 6,
                    backgroundColor: isActive ? "#7c3aed" : "rgba(124,58,237,0.25)",
                  }}
                  transition={{ duration: 0.25 }}
                  className="h-1.5 rounded-full flex-shrink-0"
                />
              </button>
            );
          })}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
