"use client";
import { useRef } from "react";
import { motion, useInView } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/reduced-motion";
import { cn } from "@/lib/utils";
import { staggerContainer, fadeInUp } from "@/lib/utils";

interface AnimatedSectionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  stagger?: boolean;
  direction?: "up" | "left" | "right" | "none";
  threshold?: number;
  as?: "div" | "section" | "article";
}

/**
 * Starts the entrance before the block is on screen.
 *
 * The observer root is grown by this much past the bottom of the viewport, so a
 * block begins moving while it is still below the fold and has substantially
 * settled by the time it is actually being read. Without it the sequence is
 * back to front — you arrive at a section, and only then does it begin to
 * assemble itself.
 */
const ENTER_EARLY = "0px 0px 140px 0px";

/** Entrance travel and duration. Short enough to be over before it is watched. */
const TRAVEL = 20;
const DURATION = 0.5;
const EASE = [0.22, 1, 0.36, 1] as const;

export default function AnimatedSection({
  children,
  className,
  delay = 0,
  stagger = false,
  direction = "up",
  threshold = 0.15,
  as: Tag = "div",
}: AnimatedSectionProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, {
    once: true,
    amount: threshold,
    margin: ENTER_EARLY,
  });
  const shouldReduce = useReducedMotionSafe();

  const directionVariants = {
    up: {
      hidden: { opacity: 0, y: shouldReduce ? 0 : TRAVEL },
      visible: { opacity: 1, y: 0, transition: { duration: DURATION, ease: EASE, delay } },
    },
    left: {
      hidden: { opacity: 0, x: shouldReduce ? 0 : -TRAVEL },
      visible: { opacity: 1, x: 0, transition: { duration: DURATION, ease: EASE, delay } },
    },
    right: {
      hidden: { opacity: 0, x: shouldReduce ? 0 : TRAVEL },
      visible: { opacity: 1, x: 0, transition: { duration: DURATION, ease: EASE, delay } },
    },
    none: {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.4, delay } },
    },
  };

  const variants = stagger ? staggerContainer : directionVariants[direction];
  const childVariants = stagger ? fadeInUp : undefined;

  return (
    <motion.div
      ref={ref}
      className={cn(className)}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={variants}
    >
      {stagger && childVariants
        ? (
          <div data-stagger-children>
            {children}
          </div>
        )
        : children}
    </motion.div>
  );
}
