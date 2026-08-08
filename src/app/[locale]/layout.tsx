import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import "../globals.css";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n-provider";
import { AuthProvider } from "@/lib/auth/useAuth";
import FloatingFaqButton from "@/components/layout/FloatingFaqButton";
import { SITE_URL } from "@/lib/site";
import { jakarta, jetbrainsMono } from "@/lib/fonts";
import { isLocale, localeDir, localePath, LOCALE_CODES, type Locale } from "@/i18n/routing";

/** OG wants an underscored territory tag; these are the closest match per locale. */
const OG_LOCALE: Record<Locale, string> = {
  en: "en_US",
  fr: "fr_FR",
  pt: "pt_PT",
  es: "es_ES",
  ar: "ar_AR",
};

/** Prerender all five locales rather than resolving them per request. */
export function generateStaticParams() {
  return LOCALE_CODES.map((locale) => ({ locale }));
}

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
      "WiMall",
    ],
    openGraph: {
      title: t("title"),
      description: t("shareDescription"),
      type: "website",
      siteName: "WiMall",
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
    applicationName: "WiMall",
    appleWebApp: { capable: true, title: "WiMall", statusBarStyle: "default" },
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
        {/* Prevent FOUC: apply stored theme class before first paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('wimall-theme');if(t==='dark'||(t==null&&window.matchMedia('(prefers-color-scheme:dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
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
