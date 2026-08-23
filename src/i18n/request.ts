import { getRequestConfig } from "next-intl/server";
import { BUILD_DEFAULT_LOCALE, isShippedLocale } from "./routing";

/**
 * Resolves the request's messages on the server. This is what lets a page
 * render fully in its own language before any JavaScript runs — the whole point
 * of moving locales into the URL.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  // `isShippedLocale`, not `isLocale`: a build that ships a subset has no message
  // bundle route for the others, so an unshipped code falls back rather than
  // failing the dynamic import below.
  const locale = isShippedLocale(requested) ? requested : BUILD_DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "Africa/Douala",
  };
});
