"use client";

import { useTranslations } from "next-intl";
import { AccountShell } from "@/components/shop/account/AccountShell";
import { NotificationPreferences } from "@/components/shop/account/NotificationPreferences";

/**
 * `/shop/account/notifications/settings` — what gets sent, and where.
 *
 * Reached from the gear in the inbox's header bar. A static route, so the app's
 * `output: "export"` build writes it like any other screen; the back arrow
 * returns to the inbox rather than to the account list, which is where it came
 * from. See `shop.pages.ts`.
 */
export default function NotificationSettingsPage() {
  const t = useTranslations("shop.notifications.prefs");
  // The header bar already resolves this screen's title from the route; passing
  // the same key keeps the shell's heading in step with it instead of
  // overriding it. See `shop.pages.ts`.
  const tKey = useTranslations();

  return (
    <AccountShell
      title={tKey("shop.nav.titles.notificationSettings")}
      description={t("description")}
    >
      <NotificationPreferences />
    </AccountShell>
  );
}
