"use client";

import type { CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { LegalLink } from "@/components/legal/LegalLink";

/**
 * Wi-Mall Protection, before there is an order: one line on the product page
 * and at checkout, linked to the Returns & Refunds Policy.
 *
 * ⚠ It names no number of days, on purpose. The length of the window is the
 * backend's setting and reaches this app only as `protection.days` on an order
 * or a booking that already exists — nothing public carries it. So the line
 * states the rule and the policy states the length, rather than this file
 * hard-coding a figure that has already changed once. If a public read ever
 * carries the window, the backend changelog's wording ("{days} days after
 * delivery to report a problem") belongs here.
 *
 * A service has no delivery: its window opens when the seller marks the service
 * completed, so it gets its own sentence.
 */
export function ProtectionLine({
  service = false,
  className,
  style,
}: {
  service?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const t = useTranslations("shop.protection");

  return (
    <p className={className} style={style}>
      {t.rich(service ? "line.service" : "line.delivery", {
        link: (chunks) => (
          <LegalLink
            doc="returns-refunds-policy"
            style={{
              color: "var(--brand)",
              fontWeight: 600,
              textDecoration: "underline",
              textUnderlineOffset: 2,
            }}
          >
            {chunks}
          </LegalLink>
        ),
      })}
    </p>
  );
}
