/**
 * The question registry behind /faq and the "common questions" blocks on the
 * role, pricing and country pages.
 *
 * One id → one answer, wherever it is shown. Role pages surface a four-question
 * subset and link through, so a visitor who lands on /vendors from search gets
 * the answers that matter there without us maintaining a second, drifting copy
 * of the same text.
 *
 * The copy lives in the message catalog at `pages.faq.q.<id>.{q,a}`. Only /faq
 * emits FAQPage structured data — the same questions marked up on four
 * different URLs is a duplicate-entity signal, not four chances to rank.
 */

export const FAQ_IDS = [
  // General
  "whatIsWimall",
  "howShopping",
  "needApp",
  "whereAvailable",
  "languages",
  "shopperCost",
  // Selling
  "vendorStart",
  "vendorWebsite",
  "vendorCost",
  "vendorProductLimit",
  "vendorDigital",
  "vendorDelivery",
  "vendorPayout",
  // Delivering
  "agencyEarn",
  "agencyCoverage",
  "agencySoftCap",
  "agentEarn",
  "agentJoin",
  "agentCapacity",
  // Money
  "paymentMethods",
  "cashOnDelivery",
  "credits",
  "renewal",
  "downgrade",
] as const;

export type FaqId = (typeof FAQ_IDS)[number];

/** Display order and grouping on /faq. Group keys resolve to `pages.faq.groups.<key>`. */
export const FAQ_GROUPS: { key: string; items: readonly FaqId[] }[] = [
  {
    key: "general",
    items: ["whatIsWimall", "howShopping", "needApp", "whereAvailable", "languages", "shopperCost"],
  },
  {
    key: "selling",
    items: [
      "vendorStart",
      "vendorWebsite",
      "vendorCost",
      "vendorProductLimit",
      "vendorDigital",
      "vendorDelivery",
      "vendorPayout",
    ],
  },
  {
    key: "delivering",
    items: ["agencyEarn", "agencyCoverage", "agencySoftCap", "agentEarn", "agentJoin", "agentCapacity"],
  },
  {
    key: "money",
    items: ["paymentMethods", "cashOnDelivery", "credits", "renewal", "downgrade"],
  },
];

/** The four questions each role page answers inline before linking to /faq. */
export const VENDOR_FAQ: readonly FaqId[] = [
  "vendorWebsite",
  "vendorCost",
  "vendorDelivery",
  "vendorPayout",
];

export const AGENCY_FAQ: readonly FaqId[] = [
  "agencyEarn",
  "agencyCoverage",
  "agencySoftCap",
  "cashOnDelivery",
];

export const AGENT_FAQ: readonly FaqId[] = ["agentEarn", "agentJoin", "agentCapacity", "vendorPayout"];

export const PRICING_FAQ: readonly FaqId[] = ["renewal", "downgrade", "credits", "vendorProductLimit"];

export const COUNTRY_FAQ: readonly FaqId[] = [
  "whereAvailable",
  "paymentMethods",
  "cashOnDelivery",
  "languages",
];
