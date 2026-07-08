"use client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface SectionLabelProps {
  children: React.ReactNode;
  variant?: "primary" | "wa" | "muted" | "role";
  className?: string;
}

export default function SectionLabel({ children, variant = "primary", className }: SectionLabelProps) {
  return (
    <motion.span
      className={cn(
        "inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-widest font-display border",
        variant === "primary" && "bg-[var(--accent-light)] border-primary-400/30 text-primary-600",
        variant === "wa" && "border-wa/30 text-wa-dark dark:text-wa",
        variant === "muted" && "bg-[var(--bg-muted)] border-[var(--border)] text-[var(--text-muted)]",
        // Inherits the nearest SectionShell's --role tint
        variant === "role" && "bg-role-soft border-role-soft text-role",
        className
      )}
    >
      {children}
    </motion.span>
  );
}
