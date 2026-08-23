"use client";

import type { ReactNode } from "react";
import { BottomSheet } from "./BottomSheet";
import { Button } from "./Button";
import { Icon } from "./Icon";

/**
 * A confirmation the shopper is asked *inside* the shop.
 *
 * This exists because `window.confirm` was doing this job: a Chrome-chrome grey
 * box, headed "localhost:3000 says", in the browser's font, with OK/Cancel
 * labels that cannot be renamed to say what OK does. It also blocks the main
 * thread, is unstyleable, cannot be dismissed by the same gestures as everything
 * else here, and on mobile Safari can be suppressed entirely — a destructive
 * action whose confirmation the browser may decline to show is not confirmed.
 *
 * Built on `BottomSheet`, so it is a sheet on mobile and a centred modal on
 * `sm+`, exactly like the filter sheet — one dialog surface, not two.
 *
 * The confirm label should name the action ("Empty cart & buy now"), not agree
 * with the question ("OK"), because that label is the last thing read before
 * something is destroyed.
 */

type Tone = "brand" | "warning" | "danger";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Colours the icon chip and, for `danger`, the confirm button. */
  tone?: Tone;
  /** Icon name for the chip beside the body. Omit for a plain dialog. */
  icon?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** True while the confirmed action is in flight — both buttons lock. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** The body copy: what happens, and what is lost. */
  children: ReactNode;
  /** An optional third way out, rendered under the body as a quiet link. */
  alternative?: { label: string; icon?: string; onClick: () => void };
}

const CHIP: Record<Tone, { fg: string; bg: string; border: string }> = {
  brand: { fg: "var(--brand)", bg: "var(--brand-subtle)", border: "var(--success-border)" },
  warning: { fg: "var(--warning)", bg: "var(--warning-bg)", border: "var(--warning-border)" },
  danger: { fg: "var(--danger)", bg: "var(--danger-bg)", border: "var(--danger-border)" },
};

export function ConfirmDialog({
  open,
  title,
  tone = "warning",
  icon,
  confirmLabel,
  cancelLabel = "Cancel",
  busy,
  onConfirm,
  onCancel,
  children,
  alternative,
}: ConfirmDialogProps) {
  const chip = CHIP[tone];

  return (
    <BottomSheet
      open={open}
      // Closing by scrim, Escape or the × is a "no" — the same answer as Cancel.
      onClose={busy ? () => undefined : onCancel}
      title={title}
      footer={
        <div style={{ display: "flex", gap: 10 }}>
          <Button block variant="secondary" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button
            block
            elevated
            variant={tone === "danger" ? "danger" : "primary"}
            disabled={busy}
            onClick={onConfirm}
          >
            {busy ? "Working…" : confirmLabel}
          </Button>
        </div>
      }
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        {icon && (
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              width: 38,
              height: 38,
              borderRadius: "50%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: chip.bg,
              border: `1px solid ${chip.border}`,
              color: chip.fg,
            }}
          >
            <Icon name={icon} size={19} />
          </span>
        )}
        <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-body)" }}>{children}</div>
      </div>

      {alternative && (
        <div style={{ marginTop: 14 }}>
          <Button
            block
            variant="ghost"
            size="sm"
            leadingIcon={alternative.icon}
            disabled={busy}
            onClick={alternative.onClick}
          >
            {alternative.label}
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}
