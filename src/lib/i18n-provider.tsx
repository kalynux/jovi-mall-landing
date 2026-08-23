"use client";
import { useCallback, useTransition, type ReactNode } from "react";
import {
  NextIntlClientProvider,
  useLocale as useActiveLocale,
  type AbstractIntlMessages,
} from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { SHIPPED_LOCALES, localeDir, type Locale } from "@/i18n/routing";
import { IS_NATIVE_BUILD } from "@/lib/platform";

/**
 * Where the app remembers the shopper's language.
 *
 * ⚠ Mirrored in `scripts/build-native.mjs`, which reads this exact key from the
 * locale bootstrap (`out/index.html`). Renaming it here alone would not fail
 * anything — the app would just silently forget the language on every launch,
 * which is the bug this constant was added to fix.
 */
const STORED_LOCALE_KEY = "wi-mall-locale";

export type { Locale };

/**
 * Each language's own name. Static rather than read from the message bundles:
 * a language's endonym does not change, and the old implementation fetched all
 * five bundles on every page load purely to fill this list.
 */
const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  pt: "Português",
  es: "Español",
  ar: "العربية",
};

/**
 * The languages to offer, in every picker — the shop's LanguageSheet, the auth
 * screens' control, and the marketing navbar.
 *
 * `SHIPPED_LOCALES` rather than `LOCALE_CODES` so an app build that ships a
 * subset offers a subset. On a device the difference is not cosmetic: the export
 * writes no tree for an unshipped locale, and there is no server to 404 the
 * request, so offering one would be a row that navigates the WebView to a file
 * that does not exist. On the web every locale ships and this is all five.
 */
export const LOCALES: { code: Locale; label: string; dir: "ltr" | "rtl" }[] =
  SHIPPED_LOCALES.map((code) => ({
    code,
    label: LOCALE_LABELS[code],
    dir: localeDir(code),
  }));

/**
 * The locale now lives in the URL, so this is a thin pass-through: the server
 * layout has already resolved both the locale and its messages from the route.
 * It used to own that resolution, fetching a bundle in an effect and rendering
 * `null` until it arrived — which is why every page served an empty body.
 */
export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: AbstractIntlMessages;
  children: ReactNode;
}) {
  return (
    // Africa/Douala, matching the backend's own default and the market the
    // platform charges in. Same UTC offset as the Africa/Lagos this replaced, so
    // nothing renders differently — it just no longer names the wrong country.
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Africa/Douala">
      {children}
    </NextIntlClientProvider>
  );
}

/**
 * Reads the active locale and switches it. Same shape the Navbar and
 * AuthPageControls already consume; `setLocale` is now a navigation to the same
 * route in another language rather than a localStorage write, so the address bar
 * and the page always agree — and so a shared link carries its language.
 *
 * `pending` is true while the new locale's route loads, which callers can use to
 * disable the picker mid-switch.
 */
export function useLocale() {
  const locale = useActiveLocale() as Locale;
  const router = useRouter();
  // Locale-stripped: "/fr/shop" reads back as "/shop", which is what the router
  // wants when re-issuing the same route under a different locale.
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const setLocale = useCallback(
    (next: Locale) => {
      if (next === locale) return;

      /**
       * ── Remember it, on the app only ───────────────────────────────────────
       *
       * On the web the locale IS the URL and the middleware resolves it on every
       * request, so there is nothing to remember and this branch is compiled
       * out entirely.
       *
       * The app has no middleware and no persisted URL: Capacitor cold-starts at
       * the bundle root every time, and `out/index.html` decides the language
       * from this key, falling back to `navigator.language`. Without the write,
       * that read never found anything and a shopper who chose French was back
       * in English on the next launch.
       *
       * `localStorage` and not `platform/storage` — which would be Capacitor
       * Preferences on a device — because the bootstrap is a bare HTML page that
       * runs before any plugin exists and can only read the WebView's own
       * storage synchronously. A language preference is also not session-grade
       * data: losing it to a storage sweep costs one tap.
       */
      if (IS_NATIVE_BUILD) {
        try {
          localStorage.setItem(STORED_LOCALE_KEY, next);
        } catch {
          // Private mode, a full quota, storage disabled. The switch below still
          // works; only the memory of it is lost.
        }
      }

      startTransition(() => {
        router.replace(pathname, { locale: next });
      });
    },
    [locale, pathname, router]
  );

  return { locale, setLocale, localeLabels: LOCALE_LABELS, pending };
}
