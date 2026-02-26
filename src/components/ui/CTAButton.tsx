"use client";
import { forwardRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

interface CTAButtonProps {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  href?: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
  showArrow?: boolean;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  ariaLabel?: string;
}

const sizeClasses = {
  sm: "px-4 py-2 text-sm gap-1.5 rounded-xl",
  md: "px-6 py-3 text-base gap-2 rounded-xl",
  lg: "px-8 py-4 text-lg gap-2.5 rounded-2xl",
};

const CTAButton = forwardRef<HTMLButtonElement | HTMLAnchorElement, CTAButtonProps>(
  function CTAButton(
    { variant = "primary", size = "md", href, onClick, children, className, showArrow = false, disabled, type = "button", ariaLabel },
    ref
  ) {
    const baseClass = cn(
      "relative inline-flex items-center justify-center font-display font-semibold",
      "transition-all duration-200 will-change-transform",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
      "disabled:opacity-50 disabled:pointer-events-none",
      sizeClasses[size],
      variant === "primary" && [
        "text-white",
        "bg-gradient-to-r from-primary-600 to-primary-500",
        "shadow-[0_0_20px_rgba(124,58,237,0.3)]",
        "hover:shadow-[0_0_30px_rgba(124,58,237,0.5)]",
        "hover:scale-[1.02] active:scale-[0.98]",
      ],
      variant === "secondary" && [
        "text-[var(--text-primary)]",
        "border border-[var(--border)]",
        "bg-[var(--surface-glass)] backdrop-blur-sm",
        "hover:bg-[var(--accent-light)] hover:border-primary-400",
        "hover:scale-[1.02] active:scale-[0.98]",
      ],
      variant === "ghost" && [
        "text-[var(--text-secondary)]",
        "hover:text-[var(--text-primary)]",
        "hover:bg-[var(--accent-light)]",
      ],
      className
    );

    const content = (
      <>
        {children}
        {showArrow && <ArrowRight className="w-4 h-4" />}
      </>
    );

    if (href) {
      return (
        <motion.a
          href={href}
          className={baseClass}
          aria-label={ariaLabel}
          whileTap={{ scale: 0.97 }}
        >
          {content}
        </motion.a>
      );
    }

    return (
      <motion.button
        type={type}
        onClick={onClick}
        disabled={disabled}
        className={baseClass}
        aria-label={ariaLabel}
        whileTap={{ scale: 0.97 }}
        ref={ref as React.Ref<HTMLButtonElement>}
      >
        {content}
      </motion.button>
    );
  }
);

export default CTAButton;
