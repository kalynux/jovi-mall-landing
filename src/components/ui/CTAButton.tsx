"use client";
import { forwardRef, useRef } from "react";
import { cn } from "@/lib/utils";
import { motion, useMotionValue, useSpring, type MotionValue } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useReducedMotionSafe } from "@/lib/reduced-motion";

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
  /** Opt-in magnetic pull toward the pointer (spring). Ignored on touch / reduced-motion. */
  magnetic?: boolean;
}

const sizeClasses = {
  sm: "px-4 py-2 text-sm gap-1.5 rounded-xl",
  md: "px-6 py-3 text-base gap-2 rounded-xl",
  lg: "px-8 py-4 text-lg gap-2.5 rounded-2xl",
};

const SPRING = { stiffness: 260, damping: 18, mass: 0.5 };
// How far the whole control follows the pointer, and how much further the label leads.
const PULL = 0.35;
const MAX_PULL = 16;

const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v));

const CTAButton = forwardRef<HTMLButtonElement | HTMLAnchorElement, CTAButtonProps>(
  function CTAButton(
    { variant = "primary", size = "md", href, onClick, children, className, showArrow = false, disabled, type = "button", ariaLabel, magnetic = false },
    ref
  ) {
    const shouldReduce = useReducedMotionSafe();
    const localRef = useRef<HTMLElement | null>(null);
    const active = magnetic && !shouldReduce;

    // Button follows the pointer; the label leads it slightly for depth.
    const mx = useMotionValue(0);
    const my = useMotionValue(0);
    const x = useSpring(mx, SPRING);
    const y = useSpring(my, SPRING);
    const lx = useSpring(mx, { stiffness: 220, damping: 16, mass: 0.5 }) as MotionValue<number>;
    const ly = useSpring(my, { stiffness: 220, damping: 16, mass: 0.5 }) as MotionValue<number>;

    const handleMove = (e: React.PointerEvent) => {
      if (!active || e.pointerType === "touch") return;
      const el = localRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      mx.set(clamp((e.clientX - (r.left + r.width / 2)) * PULL, MAX_PULL));
      my.set(clamp((e.clientY - (r.top + r.height / 2)) * PULL, MAX_PULL));
    };
    const reset = () => {
      mx.set(0);
      my.set(0);
    };

    const setRef = (node: HTMLButtonElement | HTMLAnchorElement | null) => {
      localRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = node;
    };

    const baseClass = cn(
      "relative inline-flex items-center justify-center font-display font-semibold",
      "transition-[box-shadow,background-color,border-color] duration-200 will-change-transform",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2",
      "disabled:opacity-50 disabled:pointer-events-none",
      sizeClasses[size],
      variant === "primary" && [
        "text-white",
        "bg-gradient-to-r from-primary-700 to-primary-500",
        "shadow-[0_0_20px_rgba(13,160,107,0.35)]",
        "hover:shadow-[0_0_34px_rgba(13,160,107,0.6)]",
      ],
      variant === "secondary" && [
        "text-[var(--text-primary)]",
        "border border-[var(--border)]",
        "bg-[var(--surface-glass)]",
        "hover:bg-[var(--accent-light)] hover:border-primary-400",
      ],
      variant === "ghost" && [
        "text-[var(--text-secondary)]",
        "hover:text-[var(--text-primary)]",
        "hover:bg-[var(--accent-light)]",
      ],
      className
    );

    const content = (
      <motion.span
        className="inline-flex items-center justify-center gap-2"
        style={active ? { x: lx, y: ly } : undefined}
      >
        {children}
        {showArrow && <ArrowRight className="w-4 h-4" />}
      </motion.span>
    );

    const motionProps = {
      className: baseClass,
      "aria-label": ariaLabel,
      style: active ? { x, y } : undefined,
      whileHover: shouldReduce ? undefined : { scale: 1.03 },
      whileTap: shouldReduce ? undefined : { scale: 0.97 },
      onPointerMove: active ? handleMove : undefined,
      onPointerLeave: active ? reset : undefined,
    };

    if (href) {
      return (
        <motion.a href={href} ref={setRef as React.Ref<HTMLAnchorElement>} {...motionProps}>
          {content}
        </motion.a>
      );
    }

    return (
      <motion.button
        type={type}
        onClick={onClick}
        disabled={disabled}
        ref={setRef as React.Ref<HTMLButtonElement>}
        {...motionProps}
      >
        {content}
      </motion.button>
    );
  }
);

export default CTAButton;
