"use client";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface SectionLabelProps {
  children: React.ReactNode;
  variant?: "primary" | "wa" | "muted" | "role";
  className?: string;
}

/**
 * The site's one badge. Every variant is `.tag` (squared, solid ink fill,
 * uppercase) — the variant only chooses which `--role` the fill is mixed from,
 * so the shape never drifts between sections.
 *
 * Do NOT re-add `tracking-*` here: `.tag` owns the letter-spacing and the
 * unlayered `:lang(ar)` reset in globals.css undoes it for Arabic. A utility
 * class would outrank that reset and break Arabic letter joining.
 */
export default function SectionLabel({ children, variant = "primary", className }: SectionLabelProps) {
  return (
    <motion.span
      className={cn(
        "tag",
        // `role` deliberately adds nothing: it inherits whatever --role the
        // nearest SectionShell set. `primary` pins it back to the brand accent
        // so it stays brand-coloured even inside a role-tinted section.
        variant === "primary" && "role-accent",
        variant === "wa" && "tag-wa",
        variant === "muted" && "tag-muted",
        className
      )}
    >
      {children}
    </motion.span>
  );
}
