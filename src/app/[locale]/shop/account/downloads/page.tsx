"use client";

import { useCallback, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import {
  AccountCard,
  AccountShell,
  ResourceView,
} from "@/components/shop/account/AccountShell";
import { Badge, Button, EmptyState, Icon } from "@/components/shop/ds";
import { useToast } from "@/components/shop/providers";
import { translateError } from "@/lib/auth/error-translator";
import { createDownloadLink, getMyDigitalProducts } from "@/lib/shop/digital.api";
import { startDownload } from "@/lib/native/download";
import { useApiResource } from "@/lib/shop/useApiResource";
import type { DigitalEntitlement } from "@/lib/shop/customer.types";

export default function DownloadsPage() {
  const library = useApiResource<DigitalEntitlement[]>(() => getMyDigitalProducts());
  const t = useTranslations("shop.downloads");
  const tKey = useTranslations();

  return (
    <AccountShell
      title={tKey("shop.nav.titles.downloads")}
      description={t("description")}
    >
      <ResourceView
        status={library.status}
        error={library.error}
        data={library.data}
        onRetry={library.reload}
        errorFallback={t("loadFailed")}
      >
        {(items) =>
          items.length === 0 ? (
            <EmptyState
              icon="download"
              title={t("emptyTitle")}
              description={t("emptyDescription")}
            />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {items.map((item) => (
                <DownloadRow key={item.id} item={item} onUsed={library.reload} />
              ))}
            </div>
          )
        }
      </ResourceView>
    </AccountShell>
  );
}

function DownloadRow({
  item,
  onUsed,
}: {
  item: DigitalEntitlement;
  onUsed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const { flashError } = useToast();
  const format = useFormatter();
  const t = useTranslations("shop.downloads");
  const tCommon = useTranslations("shop.common");
  const tError = useTranslations("errors");

  const download = useCallback(async () => {
    setBusy(true);
    try {
      // The link is single-use: the token in it is the authentication and is
      // consumed on first use. Minting one per click is the contract, not a
      // fallback — a cached URL is already spent.
      const link = await createDownloadLink(item.id);
      // NOT `window.location.href`. In a WebView that navigates the app itself
      // to the file — off its own origin, out of the bundle, with no way back —
      // and the single-use token is spent either way, so one tap cost the
      // shopper both the download and the app. `startDownload` hands the URL to
      // the platform's download manager instead.
      await startDownload(link.url);
      // The counter moved server-side; re-read so the remaining count on screen
      // is not one behind.
      onUsed();
    } catch (err) {
      flashError(translateError(tError, err, t("startFailed")));
    } finally {
      setBusy(false);
    }
  }, [item.id, flashError, onUsed, t, tError]);

  const expired = item.expiresAt != null && new Date(item.expiresAt).getTime() < Date.now();
  const remaining = item.downloadsRemaining;

  return (
    <AccountCard>
      <div style={{ display: "flex", gap: 11 }}>
        <Icon name="file-down" size={20} style={{ color: "var(--brand)", marginTop: 2, flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-strong)" }}>
            {item.productTitle ?? item.fileName ?? t("untitled")}
          </div>
          {item.variantName && (
            <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
              {item.variantName}
            </div>
          )}

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
            {item.revoked ? (
              <Badge size="sm" tone="danger" icon="circle-x">
                {t("revoked")}
              </Badge>
            ) : expired ? (
              <Badge size="sm" tone="warning" icon="clock">
                {t("expired")}
              </Badge>
            ) : (
              <Badge size="sm" tone="success" icon="circle-check-big">
                {t("available")}
              </Badge>
            )}

            {/* `null` means unlimited, which is not the same as zero — printing
                "0 left" for an unlimited entitlement would read as spent. */}
            {remaining != null && (
              <Badge size="sm" tone={remaining > 0 ? "neutral" : "danger"}>
                {t("remaining", { n: remaining })}
              </Badge>
            )}

            {item.expiresAt && !expired && (
              <span className="muted" style={{ fontSize: 11.5, alignSelf: "center" }}>
                {t("until", {
                  date: format.dateTime(new Date(item.expiresAt), {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }),
                })}
              </span>
            )}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          marginTop: 10,
          paddingTop: 9,
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ flex: 1 }} />
        <Button
          size="sm"
          leadingIcon="download"
          disabled={!item.canDownload || busy}
          title={item.canDownload ? undefined : t("unavailable")}
          onClick={download}
        >
          {busy ? t("preparing") : tCommon("download")}
        </Button>
      </div>
    </AccountCard>
  );
}
