// ─── Brand ──────────────────────────────────────────────────────────────────
export const BRAND = {
    name: "Wi-Mall",
    tagline: "Commerce runs on conversation.",
    description:
        "AI-powered ecommerce infrastructure for WhatsApp-first businesses. No storefront needed — just upload products and let AI sell for you.",
    whatsappNumber: "+2340000000000", // Placeholder
    email: "hello@wi-mall.com",
};

// ─── Outward destinations ───────────────────────────────────────────────────
/**
 * Everything this app links to that it does not host.
 *
 * All three are env-overridable so the real values can land without a code
 * change, and every consumer must treat an empty string as "not published yet"
 * and render the affected control disabled rather than shipping a dead link.
 *
 * NOTE: `BRAND.whatsappNumber` is still a placeholder with a Nigerian prefix,
 * while the product runs on Cameroon/FCFA. Until NEXT_PUBLIC_WHATSAPP_NUMBER is
 * set to the real business line, every wa.me link reaches nobody.
 */
export const EXTERNAL_LINKS = {
    /** WhatsApp bot number, E.164. */
    whatsappNumber: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? BRAND.whatsappNumber,
    /**
     * Telegram bot username, without the leading `@`.
     *
     * The API knows this (`TELEGRAM_BOT_NAME`) but **serves it only on
     * `GET /api/me/connections`, which requires a session** — useless on a
     * sign-in page, where by definition there is none. So the storefront keeps
     * its own copy; api-doc/auth/customer-auth.md § "The deep links" says to.
     * Empty means "not published yet": show the command as text, not a link.
     */
    telegramBotName: process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME ?? "",
    /** Agent app on Google Play. Empty until the listing is live. */
    agentAndroidUrl: process.env.NEXT_PUBLIC_AGENT_APP_ANDROID_URL ?? "",
    /** Agent app on the App Store. Empty until the listing is live. */
    agentIosUrl: process.env.NEXT_PUBLIC_AGENT_APP_IOS_URL ?? "",
};

/** Builds a wa.me deep link to the bot with `text` prefilled. */
export function buildWhatsAppUrl(text: string): string {
    const digits = EXTERNAL_LINKS.whatsappNumber.replace(/\D/g, "");
    return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/**
 * Opens the Telegram bot, or `null` when no bot name is configured.
 *
 * Telegram **cannot pre-fill a message** the way `wa.me?text=` can, so the
 * command has to be shown next to the button either way — which is also what
 * makes an unconfigured bot name survivable: the user can still type it.
 */
export function buildTelegramUrl(): string | null {
    const handle = EXTERNAL_LINKS.telegramBotName.replace(/^@/, "");
    return handle ? `https://t.me/${handle}` : null;
}

// ─── Bot commands ────────────────────────────────────────────────────────────
/**
 * The two commands a visitor is ever told to send, and they are **not
 * localised**. The bot's own replies are English-only until the sender is a
 * known account with a language on file (the platform will not guess one from a
 * phone prefix), and the command strings themselves are matched literally
 * server-side — a translated `/connexion` reaches no handler.
 */
export const BOT_COMMANDS = {
    /** Mints a customer's magic link + 8-character sign-in code. */
    login: "/login",
    /** Mints a 6-character code that connects the chat to an account. */
    connect: "/connect",
} as const;

// NOTE: `NAV_LINKS` used to live here — a third nav declaration with hardcoded
// English labels that nothing imported. The header's menu is `MAIN_MENU` in
// src/lib/nav/menu.ts, which is the only one now.

// ─── Section IDs (for progress indicator) ───────────────────────────────────
/**
 * Landing sections **in the order LandingPage renders them**. That ordering is
 * load-bearing, not decorative: the rail numbers the dots from it, and
 * SectionNavProvider resolves a rail click or a footer anchor to `list[index]`.
 *
 * It had drifted — `customers` sat sixth here while rendering second — which
 * put the rail's dots in one order and the page in another, and (while the
 * provider still snapped per gesture) sent "the next section" to whichever
 * section happened to be next in this array rather than next on screen.
 *
 * Keep in sync with components/LandingPage.tsx.
 */
export const SECTION_IDS = [
    { id: "hero", label: "Home" },
    { id: "customers", label: "Customers" },
    { id: "how-it-works", label: "Platform" },
    { id: "vendors", label: "Vendors" },
    { id: "agencies", label: "Agencies" },
    { id: "agents", label: "Agents" },
    { id: "why-wi-mall", label: "Built For You" },
    { id: "trust", label: "Trust" },
    { id: "cta", label: "Get Started" },
];

/** Maps each section id to its role-accent utility class (see globals.css `.role-*`).
 *  Sections without a specific actor fall back to the global brand-green accent. */
export const SECTION_ROLE_ACCENT: Record<string, string> = {
    hero: "role-accent",
    "how-it-works": "role-accent",
    vendors: "role-vendor",
    agencies: "role-agency",
    agents: "role-agent",
    customers: "role-customer",
    "why-wi-mall": "role-accent",
    trust: "role-accent",
    cta: "role-customer",
};

// ─── Platform Flow Steps ─────────────────────────────────────────────────────
export const FLOW_STEPS = [
    {
        step: 1,
        icon: "MessageCircle",
        title: "Customer chats on WhatsApp",
        description: "No app download. No account creation. Just a chat.",
        color: "wa",
    },
    {
        step: 2,
        icon: "Sparkles",
        title: "AI recommends products",
        description: "Our engine understands intent and suggests the perfect match.",
        color: "primary",
    },
    {
        step: 3,
        icon: "ShoppingCart",
        title: "Order is created",
        description: "Customer confirms and pays — all within WhatsApp.",
        color: "primary",
    },
    {
        step: 4,
        icon: "Building2",
        title: "Agency assigns a delivery agent",
        description: "Smart dispatch routes the order to the nearest agent.",
        color: "primary",
    },
    {
        step: 5,
        icon: "Bike",
        title: "Agent delivers",
        description: "Real-time tracking. Confirmed delivery. Happy customer.",
        color: "primary",
    },
    {
        step: 6,
        icon: "Banknote",
        title: "Revenue flows to everyone",
        description: "Vendor earns. Agency earns. Agent earns. Instantly.",
        color: "wa",
    },
];

// ─── Actor Roles ─────────────────────────────────────────────────────────────
export const ROLES = [
    {
        id: "vendor",
        label: "Vendor",
        icon: "Store",
        headline: "I want to sell products",
        description: "Upload your catalog and let AI sell for you on WhatsApp",
        href: "#vendors",
        color: "primary",
    },
    {
        id: "agency",
        label: "Agency",
        icon: "Building2",
        headline: "I manage deliveries",
        description: "Coordinate agents and earn commission on every delivery",
        href: "#agencies",
        color: "primary",
    },
    {
        id: "agent",
        label: "Agent",
        icon: "Bike",
        headline: "I deliver orders",
        description: "Pick up assignments and earn per successful delivery",
        href: "#agents",
        color: "primary",
    },
    {
        id: "customer",
        label: "Customer",
        icon: "MessageCircle",
        headline: "I want to shop",
        description: "Just WhatsApp us — browse, buy, and get it delivered",
        href: "#customers",
        color: "wa",
    },
] as const;

export type RoleId = (typeof ROLES)[number]["id"];

// ─── Trust stats ─────────────────────────────────────────────────────────────
/** First-year targets — presented as goals we're building toward, not current counts. */
export const TRUST_STATS = [
    { value: "10K+", label: "Vendors" },
    { value: "500+", label: "Delivery Agencies" },
    { value: "2M+", label: "Orders" },
    { value: "15+", label: "Cities" },
];

// NOTE: the customer chat script used to live here as CHAT_MESSAGES. It moved
// into the message catalogs (`customer.chat.*`) when WhatsAppChat was
// localised — the thread is copy, and copy belongs with the other copy.

// ─── Auth ─────────────────────────────────────────────────────────────────────
export const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8022";

// NOTE: `ROLE_SUBDOMAIN_MAP` and `ALLOWED_RETURN_HOSTS` intentionally live in
// a single source of truth — src/lib/auth/auth.redirect.ts. They used to be
// duplicated here with divergent dev-port lists; import them from there instead.

// NOTE: `WHATSAPP_CUSTOMER_LINK` used to live here — an unimported second
// wa.me builder with hardcoded English copy. Use `buildWhatsAppUrl()` above
// with a translated message instead.
