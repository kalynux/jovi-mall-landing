"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { Button, EmptyState } from "@/components/shop/ds";
import { SHOP_ROOT } from "@/lib/shop/shop.routes";

/**
 * "Your shopping account is closed" — the page behind `ACCOUNT_CLOSED_PATH`.
 *
 * Two readings, chosen by `?all=1`:
 *
 *   - **only the shopping account closed** — the person may still hold a shop,
 *     an agency or a delivery account, which is unaffected, so sign-in is
 *     offered. This is also the reading for a bare `AUTH_ROLE_CLOSED`, where
 *     the client cannot know whether other roles remain; offering a sign-in
 *     that turns out to lead nowhere is the lesser wrong.
 *   - **the whole account closed** — there is nothing to sign in to, and a
 *     sign-in button would be a promise the backend refuses.
 *
 * The session is already over by the time this renders (`logout` brought the
 * visitor here), so it reads nothing from the API. Browsing the shop as a
 * guest still works, which is why that is the other way out.
 */
export function AccountClosedNotice() {
  return (
    <Suspense fallback={null}>
      <Notice />
    </Suspense>
  );
}

function Notice() {
  const t = useTranslations("shop.accountClosed");
  const router = useRouter();
  const all = useSearchParams().get("all") === "1";

  return (
    <div className="mx-auto max-w-[600px] px-4 py-6 sm:px-6">
      <EmptyState
        icon="user-x"
        title={all ? t("allTitle") : t("title")}
        description={all ? t("allBody") : t("body")}
      />
      {!all && (
        <p
          className="muted"
          style={{ fontSize: 13.5, lineHeight: 1.5, textAlign: "center", margin: "0 0 18px" }}
        >
          {t("business")}
        </p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 360, margin: "0 auto" }}>
        {!all && (
          <Button size="lg" block onClick={() => router.push("/login")}>
            {t("signIn")}
          </Button>
        )}
        <Button
          variant={all ? "primary" : "secondary"}
          size="lg"
          block
          onClick={() => router.replace(SHOP_ROOT)}
        >
          {t("browse")}
        </Button>
      </div>
    </div>
  );
}
