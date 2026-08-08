import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, isLocale } from "./routing";

/**
 * Resolves the request's messages on the server. This is what lets a page
 * render fully in its own language before any JavaScript runs — the whole point
 * of moving locales into the URL.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = isLocale(requested) ? requested : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Africa/Douala",
  };
});
