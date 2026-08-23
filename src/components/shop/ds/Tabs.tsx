"use client";

import { useEffect, useId, useRef } from "react";
import { motion } from "framer-motion";
import { useReducedMotionSafe } from "@/lib/reduced-motion";

export interface TabItem {
  value: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  value: string;
  onChange: (value: string) => void;
  tabs: TabItem[];
  variant?: "underline" | "pill";
}

const SPRING = { type: "spring", stiffness: 520, damping: 40, mass: 0.8 } as const;

export function Tabs({ value, onChange, tabs, variant = "underline" }: TabsProps) {
  const uid = useId();
  const shouldReduce = useReducedMotionSafe();
  const transition = shouldReduce ? { duration: 0 } : SPRING;
  const railRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // The rail scrolls, so the selected tab can sit off-screen after a change.
  useEffect(() => {
    const rail = railRef.current;
    const btn = activeRef.current;
    if (!rail || !btn) return;
    if (rail.scrollWidth <= rail.clientWidth) return;
    const railBox = rail.getBoundingClientRect();
    const btnBox = btn.getBoundingClientRect();
    const delta = btnBox.left - railBox.left - (rail.clientWidth - btnBox.width) / 2;
    rail.scrollTo({ left: rail.scrollLeft + delta, behavior: shouldReduce ? "auto" : "smooth" });
  }, [value, shouldReduce]);

  if (variant === "pill") {
    return (
      <div
        ref={railRef}
        className="tab-rail"
        style={{
          display: "inline-flex",
          maxWidth: "100%",
          gap: 4,
          background: "var(--surface-2)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--radius-pill)",
          padding: 4,
          flexWrap: "nowrap",
        }}
      >
        {tabs.map((t) => {
          const active = t.value === value;
          return (
            <button
              key={t.value}
              ref={active ? activeRef : undefined}
              type="button"
              onClick={() => onChange(t.value)}
              style={{
                position: "relative",
                flex: "0 0 auto",
                whiteSpace: "nowrap",
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-sans)",
                fontSize: 13,
                fontWeight: 700,
                padding: "7px 14px",
                borderRadius: 999,
                background: "transparent",
                color: active ? "var(--brand-hover)" : "var(--text-muted)",
                transition: "color var(--dur-fast) var(--ease-out)",
              }}
            >
              {active && (
                <motion.span
                  layoutId={`${uid}-pill`}
                  transition={transition}
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "var(--surface)",
                    borderRadius: 999,
                    boxShadow: "var(--shadow-xs)",
                    zIndex: 0,
                  }}
                />
              )}
              <span style={{ position: "relative", zIndex: 1 }}>{t.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      ref={railRef}
      className="tab-rail"
      style={{
        display: "flex",
        gap: 4,
        borderBottom: "1px solid var(--border)",
      }}
    >
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            ref={active ? activeRef : undefined}
            type="button"
            onClick={() => onChange(t.value)}
            style={{
              position: "relative",
              flex: "0 0 auto",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              fontWeight: 700,
              padding: "10px 12px 12px",
              color: active ? "var(--text-strong)" : "var(--text-muted)",
              marginBottom: -1,
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              transition: "color var(--dur-fast) var(--ease-out)",
            }}
          >
            {t.label}
            {typeof t.count === "number" && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: active ? "var(--brand-hover)" : "var(--text-subtle)",
                  background: active ? "var(--brand-subtle)" : "var(--surface-2)",
                  borderRadius: 999,
                  padding: "1px 7px",
                  transition: "var(--transition-colors)",
                }}
              >
                {t.count}
              </span>
            )}
            {active && (
              <motion.span
                layoutId={`${uid}-underline`}
                transition={transition}
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: 8,
                  right: 8,
                  bottom: 0,
                  height: 2,
                  background: "var(--brand)",
                  borderRadius: 2,
                }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
