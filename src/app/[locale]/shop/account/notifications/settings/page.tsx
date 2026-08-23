"use client";

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
  return (
    <AccountShell
      title="Notification settings"
      description="Choose what we tell you about, and where it arrives."
    >
      <NotificationPreferences />
    </AccountShell>
  );
}
