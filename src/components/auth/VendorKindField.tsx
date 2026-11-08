"use client";

import { useId } from "react";
import type { UseFormRegisterReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Lock, Megaphone, Store } from "lucide-react";
import type { VendorKind } from "@/lib/auth/auth.types";
import { cn } from "@/lib/utils";

/**
 * "What will you do on Wi-Mall?", the first question of a vendor sign-up
 * (api-doc/customer/FRONTEND-CHANGELOG-service-listings.md § 3b).
 *
 * A **seller** sells products and services through orders and pays a
 * commission. A **provider** advertises a service business: customers unlock
 * its contacts and it pays per contact in credits. The answer goes to the API
 * as `vendorKind`, and **it cannot be changed afterwards**, which is why the
 * card says so rather than a footnote.
 *
 * Native radio inputs inside label cards: arrow keys, form reset and
 * react-hook-form's `register` all work with no extra wiring. Seller is the
 * default (absent means seller on the wire too).
 */
const KINDS: { kind: VendorKind; Icon: typeof Store }[] = [
  { kind: "seller", Icon: Store },
  { kind: "provider", Icon: Megaphone },
];

export default function VendorKindField({
  registration,
  value,
  error,
}: {
  registration: UseFormRegisterReturn<"vendorKind">;
  /** The current choice, so the selected card can be drawn as selected. */
  value: VendorKind | undefined;
  error?: string;
}) {
  const t = useTranslations("auth.vendorKind");
  const groupId = useId();
  const current = value ?? "seller";

  return (
    <fieldset className="m-0 min-w-0 border-0 p-0" aria-describedby={`${groupId}-note`}>
      <legend className="mb-2 font-display text-sm font-semibold text-[var(--text-primary)]">{t("question")}</legend>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {KINDS.map(({ kind, Icon }) => {
          const selected = current === kind;
          return (
            <label
              key={kind}
              className={cn(
                "relative flex cursor-pointer gap-3 rounded-2xl border-2 p-3.5 transition-colors",
                "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary-500",
                selected
                  ? "border-primary-500 bg-[var(--accent-light)]"
                  : "border-[var(--border)] bg-[var(--surface)] hover:border-primary-300"
              )}
            >
              {/* `checked` follows the watched value. Left to react-hook-form's
                  default alone, a radio that mounts late (inside the animated
                  form step) rendered with neither option checked while the
                  card above it looked selected. */}
              <input type="radio" value={kind} className="sr-only" checked={selected} {...registration} />
              <span
                aria-hidden="true"
                className={cn(
                  "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl",
                  selected ? "bg-primary-500 text-white" : "bg-[var(--bg-subtle)] text-[var(--text-muted)]"
                )}
              >
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold leading-snug text-[var(--text-primary)]">
                  {t(`${kind}.title`)}
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-[var(--text-muted)]">
                  {t(`${kind}.body`)}
                </span>
              </span>
            </label>
          );
        })}
      </div>

      <p id={`${groupId}-note`} className="mt-2 flex items-start gap-1.5 text-xs leading-relaxed text-[var(--text-muted)]">
        <Lock className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
        <span>{t("permanent")}</span>
      </p>
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  );
}
