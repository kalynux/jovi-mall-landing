"use client";

import { useId, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Button, Icon, Select } from "@/components/shop/ds";
import { regionOptions } from "@/lib/shop/address-region";
import type { AddressRegionInvalidDetails } from "@/lib/shop/customer.types";

/**
 * "Which region is this address in?" — the answer to `400 ADDRESS_REGION_INVALID`.
 *
 * The server refuses an address whose `geo` names no region of its country, by
 * region or by city, and lists the country's regions in `details.allowedRegions`.
 * This picks one and hands its **key** to `onConfirm`, which resends the same
 * request with `geo.components.region` set to it. See `lib/shop/address-region`.
 *
 * `children` sits beside the button — checkout puts its "edit the address" link
 * there, because at checkout the culprit is a saved address.
 */
export function RegionPicker({
  details,
  confirmLabel,
  busy,
  onConfirm,
  children,
}: {
  details: AddressRegionInvalidDetails;
  confirmLabel: string;
  busy: boolean;
  onConfirm: (regionKey: string) => void;
  children?: ReactNode;
}) {
  const t = useTranslations("shop.regionPicker");
  const tCommon = useTranslations("shop.common");
  const locale = useLocale();
  const [picked, setPicked] = useState("");
  const titleId = useId();
  // What the shopper's address said, quoted back. Isolated (FSI…PDI) so a Latin
  // place name cannot reorder the Arabic sentence around it.
  const sent = details.region || details.city;
  const place = sent ? `⁨${sent}⁩` : null;

  return (
    <div
      role="group"
      aria-labelledby={titleId}
      style={{
        border: "1px solid var(--warning-border)",
        background: "var(--warning-bg)",
        borderRadius: "var(--radius-md)",
        padding: "11px 13px",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
        <Icon name="map-pin" size={17} style={{ color: "var(--warning)", flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p id={titleId} style={{ fontSize: 13, fontWeight: 700, color: "var(--text-strong)", margin: 0 }}>
            {t("title")}
          </p>
          <p style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-body)", margin: "3px 0 10px" }}>
            {place ? t("body", { place }) : t("bodyNoPlace")}
          </p>
          <Select
            value={picked}
            onChange={(e) => setPicked(e.target.value)}
            aria-label={t("label")}
            leadingIcon="map-pin"
            options={[{ value: "", label: t("placeholder") }, ...regionOptions(details.allowedRegions, locale)]}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginTop: 10 }}>
            <Button size="sm" disabled={!picked || busy} onClick={() => onConfirm(picked)}>
              {busy ? tCommon("saving") : confirmLabel}
            </Button>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
