"use client";
import { Link } from "@/i18n/navigation";
import { Twitter, Linkedin, Instagram } from "lucide-react";
import WiMallMark from "@/components/brand/WiMallMark.generated";
import { BRAND } from "@/lib/constants";
import { useTranslations } from "next-intl";
import { useOptionalSectionNav } from "@/components/scroll/SectionNavProvider";

export default function Footer() {
  const t = useTranslations("footer");
  const nav = useTranslations("navbar");
  // Optional: null when the Footer is rendered off the landing page (e.g. /shop).
  const sectionNav = useOptionalSectionNav();

  // Route in-page section anchors through the full-page scroller when present;
  // otherwise let the Link navigate (anchors resolve to the landing page).
  const handleLink = (e: React.MouseEvent, href: string) => {
    const id = href.startsWith("#") ? href.slice(1) : "";
    if (id && sectionNav && sectionNav.sections.some((s) => s.id === id)) {
      e.preventDefault();
      sectionNav.scrollToId(id);
    }
  };

  const resolveHref = (href: string) =>
    href === "#" || !href.startsWith("#") || sectionNav ? href : `/${href}`;

  // The role entries point at the standalone pages rather than at landing
  // anchors. The header keeps the anchors because they drive the landing's
  // full-page scroller; the footer is on every page, so it is where the real
  // URLs belong — and sitewide links are what let those pages rank at all.
  const footerLinks = [
    {
      label: t("platform"),
      links: [
        { label: nav("shop"), href: "/shop" },
        { label: nav("vendors"), href: "/vendors" },
        { label: nav("agencies"), href: "/agencies" },
        { label: nav("agents"), href: "/agents" },
        { label: nav("customers"), href: "/customers" },
      ],
    },
    {
      label: t("learn"),
      links: [
        { label: nav("blog"), href: "/blog" },
        { label: nav("pricing"), href: "/pricing" },
        { label: nav("faq"), href: "/faq" },
        { label: nav("cameroon"), href: "/cameroon" },
      ],
    },
    {
      // The blog moved up into "Learn" and became a real href. It sat here as a
      // dead "#" beside About/Careers/Contact, which is the wrong company: it is
      // something to read, and a sitewide link is what lets its articles rank.
      //
      // These three were dead "#" stubs until the pages behind them existed.
      // They are also in the header's "Company" dropdown now, but the footer
      // link stays: it is what puts them in front of a crawler on every page.
      label: t("company"),
      links: [
        { label: t("about"), href: "/about" },
        { label: t("careers"), href: "/careers" },
        { label: t("contact"), href: "/contact" },
      ],
    },
    {
      label: t("legal"),
      links: [
        { label: t("privacy"), href: "#" },
        { label: t("terms"), href: "#" },
        { label: t("cookies"), href: "#" },
      ],
    },
  ];

  return (
    <footer className="bg-[var(--bg-subtle)] border-t border-[var(--border-medium)] pt-16 pb-8">
      <div className="container-xl px-4 sm:px-6 lg:px-8">
        {/* Brand block spans two, then one column per link group. */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-10 pb-12 border-b border-[var(--border)]">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4 group" aria-label={t("logoAriaLabel")}>
              <WiMallMark className="w-8 h-8 group-hover:scale-110 transition-transform duration-200" />
              <span className="font-display font-bold text-lg text-[var(--text-primary)]">{BRAND.name}</span>
            </Link>
            <p className="text-[var(--text-muted)] text-sm leading-relaxed max-w-xs">
              {BRAND.description}
            </p>
            <div className="flex gap-3 mt-6">
              {[Twitter, Linkedin, Instagram].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-8 h-8 rounded-lg border border-[var(--border-medium)] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:border-primary-400/50 hover:bg-[var(--accent-light)] transition-all duration-200"
                  aria-label={t("socialAriaLabel")}
                >
                  <Icon className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Link groups */}
          {footerLinks.map((group) => (
            <div key={group.label}>
              <h3 className="font-display font-semibold text-xs text-[var(--text-muted)] mb-4 uppercase tracking-widest">
                {group.label}
              </h3>
              <ul className="flex flex-col gap-2">
                {group.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={resolveHref(link.href)}
                      onClick={(e) => handleLink(e, link.href)}
                      className="text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:text-primary-600 transition-colors duration-200"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-[var(--text-muted)] text-xs">
          <p>© {new Date().getFullYear()} {BRAND.name}. {t("copyright")}</p>
          <p>{t("builtFor")}</p>
        </div>
      </div>
    </footer>
  );
}
