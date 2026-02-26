"use client";
import { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
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
  const isInView = useInView(ref, { once: true, amount: threshold });
  const shouldReduce = useReducedMotion();

  const directionVariants = {
    up: {
      hidden: { opacity: 0, y: shouldReduce ? 0 : 32 },
      visible: { opacity: 1, y: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1], delay } },
    },
    left: {
      hidden: { opacity: 0, x: shouldReduce ? 0 : -32 },
      visible: { opacity: 1, x: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1], delay } },
    },
    right: {
      hidden: { opacity: 0, x: shouldReduce ? 0 : 32 },
      visible: { opacity: 1, x: 0, transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1], delay } },
    },
    none: {
      hidden: { opacity: 0 },
      visible: { opacity: 1, transition: { duration: 0.45, delay } },
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
