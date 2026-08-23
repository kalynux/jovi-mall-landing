"use client";
import { useRef } from "react";
import { IDENTIFIER_TYPES, type IdentifierType } from "@/lib/auth/auth.schemas";

/**
 * Picks which kind of identifier is being entered.
 *
 * Both ways into an account take one `identifier` that may be a phone number or
 * an email — `POST /auth/login` for the three password roles, and
 * `POST /auth/magic/code` for customers. The two need different inputs (a phone
 * needs the country selector and E.164 normalisation, an email must not get
 * either), so asking up front is what lets both be handled properly instead of
 * guessing from the typed characters.
 *
 * Radio semantics with a roving tabindex: one tab stop for the group, arrows
 * move between the options, which is what a segmented control should do. Each
 * option owns half the full-width track.
 */
export default function IdentifierTypeToggle({
  value,
  onChange,
  labels,
  groupLabel,
}: {
  value: IdentifierType;
  onChange: (next: IdentifierType) => void;
  labels: Record<IdentifierType, string>;
  groupLabel: string;
}) {
  const refs = useRef<Partial<Record<IdentifierType, HTMLButtonElement | null>>>({});

  const move = (delta: number) => {
    const index = IDENTIFIER_TYPES.indexOf(value);
    const next =
      IDENTIFIER_TYPES[
        (index + delta + IDENTIFIER_TYPES.length) % IDENTIFIER_TYPES.length
      ];
    onChange(next);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={groupLabel}
      className="flex w-full rounded-full bg-[var(--bg-subtle)] p-0.5"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      {IDENTIFIER_TYPES.map((type) => {
        const selected = type === value;
        return (
          <button
            key={type}
            ref={(node) => {
              refs.current[type] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(type)}
            className={[
              // Each option owns half the track, its label centred in it.
              "flex-1 rounded-full px-3.5 py-1.5 text-center text-xs font-semibold",
              "transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500",
              selected
                ? "bg-[var(--surface)] text-primary-600 shadow-[var(--shadow-sm)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
            ].join(" ")}
          >
            {labels[type]}
          </button>
        );
      })}
    </div>
  );
}
