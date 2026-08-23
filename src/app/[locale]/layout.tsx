import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import "../globals.css";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n-provider";
import { AuthProvider } from "@/lib/auth/useAuth";
import FloatingFaqButton from "@/components/layout/FloatingFaqButton";
import { NativeShell } from "@/components/native/NativeShell";
import { AppLoading } from "@/components/native/AppLoading";
import { IS_NATIVE_BUILD } from "@/lib/platform";
import { SITE_URL } from "@/lib/site";
import { jakarta, jetbrainsMono } from "@/lib/fonts";
import {
  isLocale,
  localeDir,
  localePath,
  LOCALE_CODES,
  SHIPPED_LOCALES,
  type Locale,
} from "@/i18n/routing";

/** OG wants an underscored territory tag; these are the closest match per locale. */
const OG_LOCALE: Record<Locale, string> = {
  en: "en_US",
  fr: "fr_FR",
  pt: "pt_PT",
  es: "es_ES",
  ar: "ar_AR",
};

/**
 * Prerender a tree per locale rather than resolving them per request.
 *
 * `SHIPPED_LOCALES`, not `LOCALE_CODES`: this is the list that decides what the
 * static export actually writes to disk, so it is the one an app build narrows
 * to keep four unread languages out of the APK. On the web the two are equal and
 * all five are still prerendered. See the note in `i18n/routing.ts`.
 */
export function generateStaticParams() {
  return SHIPPED_LOCALES.map((locale) => ({ locale }));
}

/**
 * `viewport-fit=cover` is what makes `env(safe-area-inset-*)` resolve to
 * anything but zero.
 *
 * The shop shell has depended on those insets since it became an app shell —
 * the tab bar's bottom padding, the sticky buy bar, the toast — but without
 * this the page is laid out inside the safe area and every inset reads `0px`,
 * so a phone with a home indicator draws the tab bar behind it. Set for both
 * targets: it is equally correct for the installed PWA, and inert in a browser
 * tab.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

type LayoutProps = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

// icon.svg, favicon.ico, apple-icon.png, opengraph-image.png and
// twitter-image.png sit in app/; Next picks them up by convention and emits the
// tags. Regenerate them from AppIcons/ with `npm run gen:app-icons`.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = await getTranslations({ locale, namespace: "meta" });

  return {
    metadataBase: new URL(SITE_URL),
    title: t("title"),
    description: t("description"),
    keywords: [
      "WhatsApp ecommerce",
      "AI commerce",
      "sell on WhatsApp",
      "mobile commerce",
      "ecommerce platform",
      "Wi-Mall",
    ],
    openGraph: {
      title: t("title"),
      description: t("shareDescription"),
      type: "website",
      siteName: "Wi-Mall",
      url: localePath(locale, "/"),
      locale: OG_LOCALE[locale],
      alternateLocale: LOCALE_CODES.filter((code) => code !== locale).map(
        (code) => OG_LOCALE[code]
      ),
    },
    twitter: {
      card: "summary_large_image",
      title: t("title"),
      description: t("shareDescription"),
    },
    // NOTE: deliberately no `alternates` here. Metadata is inherited, so a
    // canonical or hreflang set on this layout would be emitted by every route —
    // which told crawlers that /shop, every product and every store page were
    // really the homepage. Each indexable route declares its own via
    // localeAlternates().
    applicationName: "Wi-Mall",
    appleWebApp: { capable: true, title: "Wi-Mall", statusBarStyle: "default" },
    robots: { index: true, follow: true },
  };
}

export default async function RootLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  // Opts this tree into static rendering; without it every page that reads a
  // translation falls back to dynamic rendering.
  setRequestLocale(locale);

  // Resolved on the server from the URL, so the page renders in the right
  // language before any JavaScript runs. This is what makes the non-English
  // locales visible to crawlers at all.
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      dir={localeDir(locale)}
      className={`${jakarta.variable} ${jetbrainsMono.variable} scroll-smooth`}
      suppressHydrationWarning
    >
      <head>
        {/*
          Put the URL back to what the app thinks it is, before anything reads it.

          Capacitor's local server cannot serve an extension-less path to its own
          file — `html5mode` routes every one of them to the root `index.html`
          instead (see scripts/build-native.mjs). So the bootstrap navigates to
          `/en/shop/index.html`, the real file, and this strips the `/index.html`
          straight back off.

          It has to run here, in `<head>`, ahead of Next's own scripts: the client
          router reads `location` as it hydrates, and `usePathname` feeds the tab
          bar's active state and the back button's "am I at the shop root?" check.
          Both would be wrong for the whole session if this ran late.

          `replaceState` rather than a navigation — no request is made, and the
          bootstrap does not become a back destination.

          Native build only; on the web no URL ever ends this way.
        */}
        {IS_NATIVE_BUILD && (
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){try{var p=location.pathname;if(p.slice(-11)==='/index.html'){history.replaceState(null,'',p.slice(0,-10)+location.search+location.hash)}}catch(e){}})()`,
            }}
          />
        )}
        {/* Prevent FOUC: apply stored theme class before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('wi-mall-theme')||localStorage.getItem('wimall-theme');if(t==='dark'||(t==null&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
        {/* The lang/dir bootstrap script that used to sit here is gone: the URL
            now carries the locale, so both attributes are correct in the served
            HTML instead of being patched in after load. */}
        {/* No font <link> here: next/font self-hosts both families and injects
            their @font-face + preload tags. See lib/fonts.ts. */}
        <meta name="theme-color" content="#068554" />
        {/* Framer's entrance animations serialise their "before" state as inline
            style (opacity:0 plus a transform) and only resolve it once the
            component hydrates. The copy is in the HTML either way — crawlers
            read it — but with no JS that state is final, so a person would get
            a blank page. This hands those elements back.

            Scoped away from aria-hidden nodes: the aurora and grain layers also
            start at opacity:0 and have nothing to reveal. */}
        <noscript>
          <style>{`[style*="opacity:0"]:not([aria-hidden="true"]){opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <I18nProvider locale={locale} messages={messages}>
            <AuthProvider>
              {/* Renders nothing. Wires the hardware back button, the status
                  bar, the splash and deep links on a device, and compiles away
                  entirely in the web build. Inside AuthProvider and
                  ThemeProvider because it reads both. */}
              <NativeShell />
              {/* A 3px progress line, covering the one gap between the
                  native splash leaving (now a 200ms timer) and the session
                  being known. Not the catalogue — that has the shop's own
                  skeletons. Native build only: the web has no splash to hand
                  over from, and a server-rendered page arrives with its session
                  already resolved. Rendered here so its markup is in the
                  exported HTML and lands on the first frame; see the component
                  for how it leaves even when the bundle never runs. */}
              {IS_NATIVE_BUILD && <AppLoading />}
              {children}
              {/* Sitewide, after the page content so it is last in the tab
                  order rather than ahead of the page a visitor came to read. */}
              <FloatingFaqButton />
            </AuthProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
