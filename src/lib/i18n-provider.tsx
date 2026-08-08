"use client";
import { useCallback, useTransition, type ReactNode } from "react";
import {
  NextIntlClientProvider,
  useLocale as useActiveLocale,
  type AbstractIntlMessages,
} from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { LOCALE_CODES, localeDir, type Locale } from "@/i18n/routing";

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

export const LOCALES: { code: Locale; label: string; dir: "ltr" | "rtl" }[] =
  LOCALE_CODES.map((code) => ({
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
      startTransition(() => {
        router.replace(pathname, { locale: next });
      });
    },
    [locale, pathname, router]
  );

  return { locale, setLocale, localeLabels: LOCALE_LABELS, pending };
}
