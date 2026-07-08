"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { NextIntlClientProvider } from "next-intl";

export type Locale = "en" | "fr" | "pt" | "es" | "ar";

const FALLBACK_LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
  pt: "Português",
  es: "Español",
  ar: "العربية",
};

export const LOCALES: { code: Locale; label: string; dir: "ltr" | "rtl" }[] = [
  { code: "en", label: FALLBACK_LOCALE_LABELS.en, dir: "ltr" },
  { code: "fr", label: FALLBACK_LOCALE_LABELS.fr, dir: "ltr" },
  { code: "pt", label: FALLBACK_LOCALE_LABELS.pt, dir: "ltr" },
  { code: "es", label: FALLBACK_LOCALE_LABELS.es, dir: "ltr" },
  { code: "ar", label: FALLBACK_LOCALE_LABELS.ar, dir: "rtl" },
];

const STORAGE_KEY = "jovi-lang";

type MessageBundle = Record<string, unknown> & {
  meta?: {
    langName?: string;
    langCode?: string;
  };
};

const I18nContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
  localeLabels: Record<Locale, string>;
}>({ locale: "en", setLocale: () => {}, localeLabels: FALLBACK_LOCALE_LABELS });

export function useLocale() {
  return useContext(I18nContext);
}

async function loadMessages(locale: Locale) {
  try {
    const messages = await import(`../../messages/${locale}.json`);
    return messages.default as MessageBundle;
  } catch {
    const fallback = await import(`../../messages/en.json`);
    return fallback.default as MessageBundle;
  }
}

function getLocaleLabel(locale: Locale, messages: MessageBundle | null | undefined) {
  return messages?.meta?.langName ?? FALLBACK_LOCALE_LABELS[locale];
}

async function loadLocaleLabels() {
  const labels = await Promise.all(
    LOCALES.map(async (localeConfig) => {
      const messages = await loadMessages(localeConfig.code);
      return [localeConfig.code, getLocaleLabel(localeConfig.code, messages)] as const;
    })
  );

  return Object.fromEntries(labels) as Record<Locale, string>;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [messages, setMessages] = useState<MessageBundle | null>(null);
  const [localeLabels, setLocaleLabels] = useState<Record<Locale, string>>(FALLBACK_LOCALE_LABELS);

  const applyLocale = useCallback(async (newLocale: Locale) => {
    const msgs = await loadMessages(newLocale);
    const localeConfig = LOCALES.find((l) => l.code === newLocale)!;
    const dir = localeConfig.dir;

    // Apply dir + lang to <html>
    document.documentElement.setAttribute("lang", newLocale);
    document.documentElement.setAttribute("dir", dir);

    setLocaleLabels((prev) => ({ ...prev, [newLocale]: getLocaleLabel(newLocale, msgs) }));
    setLocaleState(newLocale);
    setMessages(msgs);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function initializeLocale() {
      const labels = await loadLocaleLabels();
      if (!ignore) {
        setLocaleLabels(labels);
      }

      const stored = (localStorage.getItem(STORAGE_KEY) as Locale) || "en";
      const valid = LOCALES.some((l) => l.code === stored) ? stored : "en";
      queueMicrotask(() => {
        void applyLocale(valid);
      });
    }

    void initializeLocale();

    return () => {
      ignore = true;
    };
  }, [applyLocale]);

  function setLocale(newLocale: Locale) {
    localStorage.setItem(STORAGE_KEY, newLocale);
    void applyLocale(newLocale);
  }

  // Don't render until initial locale resolved
  if (!messages) {
    return null;
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, localeLabels }}>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Africa/Lagos">
        {children}
      </NextIntlClientProvider>
    </I18nContext.Provider>
  );
}
