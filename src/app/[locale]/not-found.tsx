"use client";
import ErrorScreen from "@/components/errors/ErrorScreen";

/**
 * Every `notFound()` in the app lands here — a mistyped URL, a retired blog
 * slug, a city that is not in the catalog.
 *
 * A client component so it can read the message bundle through
 * `NextIntlClientProvider`. The server equivalent would need the locale, and a
 * not-found page is not handed one: Next renders it without the segment's
 * params, so `setRequestLocale` has nothing to receive.
 *
 * No `reset` is passed — re-rendering the same missing URL cannot succeed, so
 * the screen offers the way home instead of a button that does nothing.
 */
export default function LocaleNotFound() {
  return <ErrorScreen variant="notFound" />;
}
