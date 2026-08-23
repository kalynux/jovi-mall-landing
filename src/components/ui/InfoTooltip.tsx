"use client";
/**
 * InfoTooltip — the small "(i)" that carries a field's description.
 *
 * Helper text used to sit permanently under the input, which cost a line of
 * vertical rhythm on every field that had one and pushed six-field forms past
 * the fold. The description now lives behind this trigger instead: hover on a
 * pointer, tap on touch, and read on focus for anyone using a screen reader.
 *
 * The bubble is always in the DOM and only fades, so `aria-describedby` from
 * both the trigger and the field it annotates stays resolvable — a tooltip
 * that unmounts when closed describes nothing.
 */
import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export interface InfoTooltipProps {
  /** The description shown inside the bubble. */
  content: string;
  /**
   * Id for the bubble, so the annotated input can point its own
   * `aria-describedby` at it. Falls back to a generated one.
   */
  id?: string;
  /** Accessible name for the trigger. Defaults to the shared auth string. */
  label?: string;
  /**
   * Which edge of the trigger the bubble hangs from. "end" (default) grows it
   * back across the field it sits in; "start" grows it away from a label.
   */
  align?: "start" | "end";
  className?: string;
}

export default function InfoTooltip({
  content,
  id,
  label,
  align = "end",
  className,
}: InfoTooltipProps) {
  const t = useTranslations("auth");
  const autoId = useId();
  const tipId = id ?? `tip-${autoId}`;

  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);

  // One opener per input modality, and no two of them overlapping — which is
  // the whole difficulty here. A tap fires emulated hover *and* focus *and*
  // click, so a trigger that answered all three would open on the hover and
  // close again on the click, reading as a dead button.
  //
  //   mouse    — pointerenter/leave only, ignoring anything not a mouse
  //   keyboard — :focus-visible, which a tap never satisfies
  //   touch    — the click, ignoring the mouse clicks hover already covers
  const isMouse = (event: React.PointerEvent) => event.pointerType === "mouse";

  // Touch dismisses by tapping elsewhere; Escape does the same for keyboards
  // without moving focus off the trigger. Both listeners only exist while the
  // bubble is up.
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span
      ref={wrapRef}
      className={cn("relative inline-flex", className)}
      onPointerEnter={(e) => isMouse(e) && setOpen(true)}
      onPointerLeave={(e) => isMouse(e) && setOpen(false)}
    >
      <button
        type="button"
        aria-label={label ?? t("fieldInfoAria")}
        aria-describedby={tipId}
        onClick={(e) => {
          // Touch and pen only. A mouse click is already covered by hover, and
          // an Enter/Space activation (pointerType "") by focus — letting
          // either through would toggle the bubble straight back shut.
          const { pointerType } = e.nativeEvent as PointerEvent;
          if (pointerType === "touch" || pointerType === "pen") {
            setOpen((v) => !v);
          }
        }}
        onFocus={(e) => {
          if (e.currentTarget.matches(":focus-visible")) setOpen(true);
        }}
        onBlur={() => setOpen(false)}
        className={cn(
          "inline-flex h-5 w-5 items-center justify-center rounded-full",
          "text-[var(--text-subtle)] transition-colors duration-150",
          "hover:text-primary-600",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
        )}
      >
        <Info className="h-4 w-4" aria-hidden="true" />
      </button>

      {/* Hangs below the trigger: the card that holds these forms clips its
          overflow, and there is always form left underneath but not always
          room above. `pointer-events-none` keeps it from swallowing the click
          that would close it. */}
      <span
        id={tipId}
        role="tooltip"
        className={cn(
          "pointer-events-none absolute top-full z-30 mt-2 w-max max-w-[15rem]",
          "rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2",
          "text-start text-xs font-normal normal-case leading-relaxed",
          "text-[var(--text-muted)] shadow-[var(--shadow-lg)]",
          "transition-opacity duration-150",
          align === "end" ? "end-0" : "start-0",
          open ? "opacity-100" : "opacity-0"
        )}
      >
        {content}
      </span>
    </span>
  );
}
