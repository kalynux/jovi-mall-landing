"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { NextIntlClientProvider } from "next-intl";

export type Locale = "en" | "fr" | "pt" | "es" | "ar";

export const LOCALES: { code: Locale; label: string; dir: "ltr" | "rtl" }[] = [
  { code: "en", label: "English", dir: "ltr" },
  { code: "fr", label: "Français", dir: "ltr" },
  { code: "pt", label: "Português", dir: "ltr" },
  { code: "es", label: "Español", dir: "ltr" },
  { code: "ar", label: "العربية", dir: "rtl" },
];

const STORAGE_KEY = "jovi-lang";

const I18nContext = createContext<{
  locale: Locale;
  setLocale: (l: Locale) => void;
}>({ locale: "en", setLocale: () => {} });

export function useLocale() {
  return useContext(I18nContext);
}

async function loadMessages(locale: Locale) {
  try {
    const messages = await import(`../../messages/${locale}.json`);
    return messages.default;
  } catch {
    const fallback = await import(`../../messages/en.json`);
    return fallback.default;
  }
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [messages, setMessages] = useState<Record<string, unknown> | null>(null);

  // Read stored locale on mount
  useEffect(() => {
    const stored = (localStorage.getItem(STORAGE_KEY) as Locale) || "en";
    const valid = LOCALES.some((l) => l.code === stored) ? stored : "en";
    applyLocale(valid);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function applyLocale(newLocale: Locale) {
    const msgs = await loadMessages(newLocale);
    const localeConfig = LOCALES.find((l) => l.code === newLocale)!;
    const dir = localeConfig.dir;

    // Apply dir + lang to <html>
    document.documentElement.setAttribute("lang", newLocale);
    document.documentElement.setAttribute("dir", dir);

    setLocaleState(newLocale);
    setMessages(msgs);
  }

  function setLocale(newLocale: Locale) {
    localStorage.setItem(STORAGE_KEY, newLocale);
    applyLocale(newLocale);
  }

  // Don't render until initial locale resolved
  if (!messages) {
    return null;
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale }}>
      <NextIntlClientProvider locale={locale} messages={messages} timeZone="Africa/Lagos">
        {children}
      </NextIntlClientProvider>
    </I18nContext.Provider>
  );
}
