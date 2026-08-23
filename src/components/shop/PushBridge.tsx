"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { IS_NATIVE_BUILD } from "@/lib/platform";
import { startPushListeners } from "@/lib/native/push";
import { resolvePushDestination } from "@/lib/shop/push-routing";
import { useNotifications } from "./providers";

/**
 * Binds the push listeners, inside the shop's providers.
 *
 * ── Why here and not in `NativeShell` ────────────────────────────────────────
 *
 * Every other native concern is bound in `NativeShell`, and this one cannot be:
 * it sits in `[locale]/layout.tsx`, which is **outside** `ShopProviders`, and a
 * foreground push has to refresh the unread badge that `NotificationsProvider`
 * owns. Mounting this inside the shop layout is the smaller of the two
 * compromises — the alternative is a module-level event bus whose only job is
 * to carry one integer across a provider boundary.
 *
 * Renders nothing. It is a mount point, not UI.
 *
 * ── Timing ──────────────────────────────────────────────────────────────────
 *
 * A notification tapped while the app was killed delivers its event during
 * startup. The shop layout is the first thing the app mounts, which is early
 * enough; a listener bound any later would never hear it and the tap would open
 * the shop root instead of the order it named.
 */
export function PushBridge() {
  const router = useRouter();
  const { refresh } = useNotifications();

  useEffect(() => {
    if (!IS_NATIVE_BUILD) return;

    void startPushListeners({
      // The badge does not poll — protecting the rate limit is the whole reason
      // push exists here — so this is the only thing that moves it while the
      // shopper is looking at the screen.
      onReceived: () => {
        void refresh();
      },

      onOpen: (data) => {
        void (async () => {
          const target = await resolvePushDestination(data);
          router.push(target);
          // The tapped message is now read, or about to be: refresh so the
          // badge does not keep counting something the shopper just opened.
          void refresh();
        })();
      },
    });
  }, [router, refresh]);

  return null;
}
