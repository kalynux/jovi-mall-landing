"use client";

import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import { BottomSheet } from "@/components/shop/ds/BottomSheet";
import { Button } from "@/components/shop/ds/Button";
import { openApp } from "@/lib/native/links";
import { tapFeedback } from "@/lib/native/haptics";
import {
  bargainTelegramUrl,
  bargainWhatsAppUrl,
  isBargainTarget,
  type BargainTarget,
} from "@/lib/shop/bargain";

interface Props extends BargainTarget {
  /**
   * What the courtesy line names — the product title, plus the variant when
   * there is a choice. Read by the shopper before they press send; the bot
   * ignores it and reads the ids on the line above.
   */
  itemLabel: string;
}

/** The hook also runs before a product card has looked its variant up. */
type HookProps = Omit<Props, "variantId"> & { variantId: string | undefined };

/**
 * Bargain on a negotiable variant: ask which chat, then open the bot there with
 * the product already named. The message format lives in `lib/shop/bargain.ts`;
 * this only decides where to go.
 *
 * With no Telegram bot configured there is nothing to choose, so the press goes
 * straight to WhatsApp rather than opening a sheet with one option in it.
 *
 * `openApp`, not `openExternal`: both URLs belong to an installed app, and a
 * Custom Tab would open WhatsApp Web inside ours instead.
 *
 * Shared by the product page's button and the product card's corner menu.
 * `start` is null with no variant yet or a malformed id; the caller then
 * offers nothing to press.
 */
export function useBargain({ productId, variantId, itemLabel }: HookProps): {
  start: (() => void) | null;
  sheet: ReactNode;
} {
  const t = useTranslations("shop.product.bargain");
  const [open, setOpen] = useState(false);

  if (!variantId || !isBargainTarget({ productId, variantId })) return { start: null, sheet: null };

  const target = { productId, variantId };
  const whatsappUrl = bargainWhatsAppUrl(target, t("message", { item: itemLabel }));
  const telegramUrl = bargainTelegramUrl(target);

  const go = (url: string) => {
    setOpen(false);
    void openApp(url);
  };

  const start = () => {
    void tapFeedback();
    if (telegramUrl) setOpen(true);
    else go(whatsappUrl);
  };

  const sheet = telegramUrl && (
    // The sheet is portalled to <body>, but React still bubbles its clicks
    // through the component tree — and on a product card that tree runs through
    // the card's <Link>, so every tap in here would also open the product.
    <span style={{ display: "contents" }} onClick={(e) => e.stopPropagation()}>
      <BottomSheet open={open} onClose={() => setOpen(false)} title={t("sheetTitle")}>
        <p className="muted" style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 16 }}>
          {t("sheetBody")}
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <Button block variant="whatsapp" size="lg" leadingIcon="message-circle" onClick={() => go(whatsappUrl)}>
              {t("whatsapp")}
            </Button>
            <p className="muted" style={{ fontSize: 12, marginTop: 6, textAlign: "center" }}>
              {t("whatsappNote")}
            </p>
          </div>
          <div>
            <Button block variant="secondary" size="lg" leadingIcon="send" onClick={() => go(telegramUrl)}>
              {t("telegram")}
            </Button>
            <p className="muted" style={{ fontSize: 12, marginTop: 6, textAlign: "center" }}>
              {t("telegramNote")}
            </p>
          </div>
        </div>
      </BottomSheet>
    </span>
  );

  return { start, sheet };
}

export function BargainButton(props: Props) {
  const t = useTranslations("shop.product.bargain");
  const { start, sheet } = useBargain(props);

  if (!start) return null;

  return (
    <>
      <Button block variant="secondary" size="lg" leadingIcon="handshake" onClick={start}>
        {t("cta")}
      </Button>
      {sheet}
    </>
  );
}
