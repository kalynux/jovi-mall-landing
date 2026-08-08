/**
 * schema.org graph builders.
 *
 * One deliberate omission throughout: no `aggregateRating` or `review` nodes.
 * `rating`, `reviews` and `sales` on Product/Vendor are fixture values (see the
 * MOCK markers in shop.types.ts), and publishing invented review counts as
 * structured data is a Google spam-policy violation that earns a manual action.
 * Wire them in when the review data is real.
 */
import { BRAND } from "@/lib/constants";
import { absoluteUrl, SITE_URL } from "@/lib/site";
import { localePath, type Locale } from "@/i18n/routing";
import type { Product, Vendor } from "@/lib/shop/shop.types";

export type JsonLdNode = Record<string, unknown>;

const CURRENCY = "XAF";

/**
 * Every URL a node emits is the current locale's, so the structured data agrees
 * with the page's own canonical instead of pointing the French page at English
 * URLs. The Organization keeps one stable @id across all five — it is the same
 * organization, not five of them.
 */
function localeUrl(locale: Locale, path: string): string {
  return absoluteUrl(localePath(locale, path));
}

/** Stable @id so the other nodes can point at the publisher instead of copying it. */
const ORG_ID = `${SITE_URL}/#organization`;

export function organizationJsonLd(): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    name: BRAND.name,
    url: absoluteUrl("/"),
    logo: absoluteUrl("/icon.svg"),
    image: absoluteUrl("/opengraph-image.png"),
    description: BRAND.description,
    email: BRAND.email,
    areaServed: "Africa",
  };
}

export function webSiteJsonLd(): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: BRAND.name,
    url: absoluteUrl("/"),
    description: BRAND.description,
    publisher: { "@id": ORG_ID },
    inLanguage: ["en", "fr", "pt", "es", "ar"],
    // No `potentialAction`/SearchAction: the shop's search is client-side state
    // with no URL to hand a crawler. Add it once /shop reads a ?q= param.
  };
}

/** Breadcrumbs matching the URL path, so the SERP shows a trail, not a raw URL. */
export function breadcrumbJsonLd(
  locale: Locale,
  trail: { name: string; path: string }[]
): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: localeUrl(locale, crumb.path),
    })),
  };
}

/**
 * FAQPage for /faq.
 *
 * Emitted on that URL only. The same questions marked up on the role pages that
 * quote a few of them would put four FAQPage entities on the site claiming the
 * same answers, which reads as duplication rather than coverage.
 */
export function faqPageJsonLd(
  locale: Locale,
  path: string,
  items: { question: string; answer: string }[]
): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${localeUrl(locale, path)}#faq`,
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}

/**
 * The plan catalog, attached to the existing Organization node by `@id` rather
 * than emitted as a second organization. Prices come off the public catalog at
 * build time (see lib/marketing/plans.api.ts) — a tier the catalog will not sell
 * is left out entirely rather than listed with an availability we would fake.
 */
export function offerCatalogJsonLd(
  locale: Locale,
  path: string,
  offers: {
    name: string;
    description: string;
    price: number;
    /** Per-offer, from the catalog — the plan model carries its own currency. */
    currency: string;
    category: string;
  }[]
): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORG_ID,
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: BRAND.name,
      url: localeUrl(locale, path),
      itemListElement: offers.map((offer) => ({
        "@type": "Offer",
        name: offer.name,
        description: offer.description,
        price: offer.price,
        priceCurrency: offer.currency,
        category: offer.category,
        url: localeUrl(locale, path),
        seller: { "@id": ORG_ID },
      })),
    },
  };
}

/**
 * The service offered in one place, for the city and country pages.
 *
 * `areaServed` is a City/Country node rather than a string so the page states
 * *where* rather than merely mentioning a place name. No `aggregateRating` here
 * either, for the reason in this file's header.
 */
export function serviceAreaJsonLd(
  locale: Locale,
  path: string,
  area: { type: "City" | "Country"; name: string; containedIn?: string },
  service: { name: string; description: string }
): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    "@id": `${localeUrl(locale, path)}#service`,
    name: service.name,
    description: service.description,
    serviceType: "WhatsApp commerce and delivery platform",
    provider: { "@id": ORG_ID },
    url: localeUrl(locale, path),
    areaServed: {
      "@type": area.type,
      name: area.name,
      ...(area.containedIn
        ? { containedInPlace: { "@type": "AdministrativeArea", name: area.containedIn } }
        : {}),
    },
  };
}

export function productJsonLd(locale: Locale, product: Product, vendor: Vendor): JsonLdNode {
  const url = localeUrl(locale, `/shop/products/${product.slug}`);
  const availability = product.inStock
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";
  const seller = { "@type": "Organization", name: vendor.name };

  // Variants carry the real prices, so a product with more than one is a price
  // range rather than a single offer — claiming one price for all of them is
  // the kind of mismatch that gets rich results suppressed.
  const prices = product.variants.map((v) => v.price).filter((p) => Number.isFinite(p));
  const offers =
    prices.length > 1 && Math.min(...prices) !== Math.max(...prices)
      ? {
          "@type": "AggregateOffer",
          url,
          priceCurrency: CURRENCY,
          lowPrice: Math.min(...prices),
          highPrice: Math.max(...prices),
          offerCount: product.variants.length,
          availability,
          seller,
        }
      : {
          "@type": "Offer",
          url,
          priceCurrency: CURRENCY,
          price: prices[0] ?? product.price,
          availability,
          itemCondition: "https://schema.org/NewCondition",
          seller,
        };

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.title,
    description: product.desc,
    image: product.images,
    category: product.category,
    ...(product.variants[0]?.sku ? { sku: product.variants[0].sku } : {}),
    brand: { "@type": "Brand", name: vendor.name },
    offers,
  };
}

export function storeJsonLd(locale: Locale, vendor: Vendor): JsonLdNode {
  const url = localeUrl(locale, `/shop/stores/${vendor.slug}`);

  return {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": `${url}#store`,
    name: vendor.name,
    description: vendor.desc,
    url,
    image: vendor.banner,
    telephone: vendor.whatsapp,
    address: {
      "@type": "PostalAddress",
      addressLocality: vendor.city,
      addressCountry: vendor.country,
    },
    parentOrganization: { "@id": ORG_ID },
  };
}
