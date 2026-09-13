/**
 * schema.org graph builders.
 *
 * `aggregateRating` is emitted on `Product` **if and only if** the API sent a
 * non-null `rating`. The backend never sends a zero-count summary — a product
 * nobody has reviewed carries `rating: null` — so there is no branch to get
 * wrong and no way to publish an invented review count, which is a Google
 * review-snippet spam-policy violation that earns a manual action.
 *
 * No `review` nodes anywhere: the public review route publishes no author
 * identity, and a `Review` without an `author` is not worth emitting.
 * `sales` on Product/Vendor is still a fixture and stays out.
 */
import { BRAND } from "@/lib/constants";
import { absoluteUrl, SITE_URL } from "@/lib/site";
import { localePath, type Locale } from "@/i18n/routing";
import type { Product, Store } from "@/lib/shop/shop.types";
import { publicUrl } from "@/lib/shop/shop.types";
import { productPath, storePath } from "@/lib/shop/shop.routes";

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
 * AboutPage for /about.
 *
 * Points at the existing Organization by `@id` instead of restating it, so the
 * page describes the same entity the homepage already declared rather than
 * introducing a second one. No `founder`, `foundingDate`, `numberOfEmployees` or
 * `address`: none of those are known facts here, and the About page's whole
 * argument is that this project does not overstate itself.
 */
export function aboutPageJsonLd(locale: Locale, path: string, description: string): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "AboutPage",
    "@id": `${localeUrl(locale, path)}#about`,
    url: localeUrl(locale, path),
    name: BRAND.name,
    description,
    mainEntity: { "@id": ORG_ID },
    inLanguage: locale,
  };
}

/**
 * ContactPage for /contact.
 *
 * The email is the one already published on the Organization node, so the two
 * agree. No `telephone`: `BRAND.whatsappNumber` is still a placeholder, and a
 * phone number in structured data is a number Google will happily show to
 * someone who then reaches nobody.
 */
export function contactPageJsonLd(locale: Locale, path: string, description: string): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    "@id": `${localeUrl(locale, path)}#contact`,
    url: localeUrl(locale, path),
    name: BRAND.name,
    description,
    mainEntity: { "@id": ORG_ID },
    inLanguage: locale,
  };
}

/**
 * A single open role, for /careers.
 *
 * **Only ever called when `HIRING_OPEN` is true** (see lib/marketing/careers.ts).
 * A JobPosting is a promise that an application leads somewhere; emitting one
 * for a role nobody can currently be hired into is fabricated structured data,
 * the same class of problem as the invented review counts this file refuses at
 * the top. Google also expires and penalises stale postings, so the flag is
 * what keeps the markup honest — not a stylistic preference.
 *
 * `datePosted` is passed in rather than derived from `new Date()`: a build-time
 * clock would restamp every posting on every deploy, which is exactly the
 * "fresh" signal that should not be faked.
 */
export function jobPostingJsonLd(
  locale: Locale,
  path: string,
  job: {
    id: string;
    title: string;
    description: string;
    employmentType: string;
    datePosted: string;
  }
): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    "@id": `${localeUrl(locale, path)}#${job.id}`,
    title: job.title,
    description: job.description,
    employmentType: job.employmentType,
    datePosted: job.datePosted,
    hiringOrganization: { "@id": ORG_ID },
    jobLocationType: "TELECOMMUTE",
    applicantLocationRequirements: { "@type": "Country", name: "Cameroon" },
    directApply: false,
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

/* ─── Blog ────────────────────────────────────────────────────────────────── */

/**
 * One article.
 *
 * `author` takes its `@type` from the author record rather than defaulting to
 * Person: a house byline is an Organization, and marking it as a Person asserts
 * that a human by that name exists. Same rule as the omitted ratings above.
 *
 * No `aggregateRating`, no `commentCount`, no `interactionStatistic` — there is
 * no comment system and no engagement data, and BlogPosting is exactly the kind
 * of node where those get invented.
 */
export function blogPostingJsonLd(
  locale: Locale,
  article: {
    path: string;
    title: string;
    excerpt: string;
    publishedAt: string;
    updatedAt?: string;
    wordCount: number;
    section: string;
    author: { name: string; type: "Person" | "Organization" };
    cover?: { url: string };
  }
): JsonLdNode {
  const url = localeUrl(locale, article.path);

  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "@id": `${url}#article`,
    // Google ignores headlines past ~110 characters. Every title here is well
    // inside that; a longer one should be shortened in the CMS, not truncated
    // here, so the page and its markup keep saying the same thing.
    headline: article.title,
    description: article.excerpt,
    url,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    datePublished: article.publishedAt,
    // Falls back to the publish date: `dateModified` is a ranking-relevant
    // freshness signal, and omitting it entirely is better than emitting today's
    // build date, which would claim every article was revised on every deploy.
    dateModified: article.updatedAt ?? article.publishedAt,
    inLanguage: locale,
    articleSection: article.section,
    wordCount: article.wordCount,
    isAccessibleForFree: true,
    author: { "@type": article.author.type, name: article.author.name },
    publisher: { "@id": ORG_ID },
    image: article.cover?.url ?? absoluteUrl("/opengraph-image.png"),
  };
}

/** The blog itself, for /blog and the category hubs. */
export function blogJsonLd(
  locale: Locale,
  path: string,
  blog: { name: string; description: string },
  posts: { path: string; title: string; publishedAt: string }[]
): JsonLdNode {
  const url = localeUrl(locale, path);

  return {
    "@context": "https://schema.org",
    "@type": "Blog",
    "@id": `${url}#blog`,
    name: blog.name,
    description: blog.description,
    url,
    inLanguage: locale,
    publisher: { "@id": ORG_ID },
    blogPost: posts.map((post) => ({
      "@type": "BlogPosting",
      "@id": `${localeUrl(locale, post.path)}#article`,
      headline: post.title,
      url: localeUrl(locale, post.path),
      datePublished: post.publishedAt,
    })),
  };
}

/**
 * `Product` structured data.
 *
 * The seller is `product.store` — there is no separate vendor object any more,
 * and there is no `vendorId` on the public API at all: a store is addressed by
 * slug so an internal id never becomes a public identifier.
 *
 * `aggregateRating` is emitted only when `product.rating` is non-null. That
 * null is the entire guard: the backend never sends `{ average: 0, count: 0 }`,
 * so an unreviewed product is indistinguishable from one with no rating data and
 * there is nothing to synthesise a zero from. Do not add one.
 *
 * `review` nodes stay absent — the public route publishes no author identity, and
 * schema.org wants an `author` on each.
 */
export function productJsonLd(locale: Locale, product: Product): JsonLdNode {
  const url = localeUrl(locale, productPath(product.store.slug, product.slug));
  const seller = { "@type": "Organization", name: product.store.name };

  // Currency comes from the data rather than the module constant: XAF is the
  // platform default, not a guarantee, and mislabelling an amount is worse than
  // omitting the markup.
  const currency = product.variants[0]?.currency ?? CURRENCY;

  // Availability is per variant, so a product is in stock when *something* under
  // it is buyable — which is what the browse grid's own `inStock` means too.
  const availability = product.variants.some((v) => v.inStock)
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";

  /*
     The only place in this codebase that derives a price band client-side, so
     it is the one worth checking against the 2026-09-07 storefront flip.

     On a variant carrying a bargain window the shop now quotes
     `bargain.maxPrice` — the vendor's ask — under the ordinary `price` key, and
     `variant.price` became a floor that is never published on any public route.
     Nothing was renamed or retyped, so nothing here fails to compile and the
     only symptom of getting it wrong would be markup that disagrees with the
     page.

     This stays correct: the detail read's variants carry display prices, from
     the same `public-display-price.ts` that computes the browse rows and the
     `?minPrice=&maxPrice=` filter band, so min/max over them is the same pair
     the API would send as `priceRange`. What would NOT be safe is deriving a
     band from anything else — a cached price, or a "from" figure composed by
     hand. */
  const prices = product.variants.map((v) => v.price).filter((p) => Number.isFinite(p));
  const offers =
    prices.length > 1 && Math.min(...prices) !== Math.max(...prices)
      ? {
          "@type": "AggregateOffer",
          url,
          priceCurrency: currency,
          lowPrice: Math.min(...prices),
          highPrice: Math.max(...prices),
          offerCount: product.variants.length,
          availability,
          seller,
        }
      : {
          "@type": "Offer",
          url,
          priceCurrency: currency,
          price: prices[0] ?? 0,
          availability,
          itemCondition: "https://schema.org/NewCondition",
          seller,
        };

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${url}#product`,
    name: product.title,
    description: product.description,
    image: product.images
      .map((image) => publicUrl(image))
      .filter((url): url is string => url !== null),
    category: product.category,
    // `sku` is published per variant now, and is already globally unique and
    // already shown to the customer on cart and order lines — so it is safe to
    // emit, and `Offer` wants a stable identifier for rich results.
    ...(product.variants[0]?.sku ? { sku: product.variants[0].sku } : {}),
    brand: { "@type": "Brand", name: product.store.name },
    // Emitted if and only if the API sent an aggregate. `average` arrives at two
    // decimals and is passed through unrounded — it is the platform's number.
    ...(product.rating
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: product.rating.average,
            reviewCount: product.rating.count,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
    offers,
  };
}

export function storeJsonLd(locale: Locale, store: Store): JsonLdNode {
  const url = localeUrl(locale, storePath(store.slug));

  return {
    "@context": "https://schema.org",
    "@type": "Store",
    "@id": `${url}#store`,
    name: store.name,
    description: store.description,
    url,
    // Every one of these is nullable on the public DTO, so each is omitted
    // rather than emitted as null — `"telephone": null` is invalid markup.
    ...((() => {
      const image = publicUrl(store.banner) ?? publicUrl(store.logo);
      return image ? { image } : {};
    })()),
    ...(store.supportWhatsapp ? { telephone: store.supportWhatsapp } : {}),
    ...(store.city || store.country
      ? {
          address: {
            "@type": "PostalAddress",
            // City is the only address component the API publishes; the rest of
            // a vendor's addresses are the places they ship from.
            ...(store.city ? { addressLocality: store.city } : {}),
            ...(store.country ? { addressCountry: store.country } : {}),
          },
        }
      : {}),
    parentOrganization: { "@id": ORG_ID },
  };
}
