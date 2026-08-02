// ─── Brand ──────────────────────────────────────────────────────────────────
export const BRAND = {
    name: "Jovi Mall",
    tagline: "Commerce runs on conversation.",
    description:
        "AI-powered ecommerce infrastructure for WhatsApp-first businesses. No storefront needed — just upload products and let AI sell for you.",
    whatsappNumber: "+2340000000000", // Placeholder
    email: "hello@jovimall.com",
};

// ─── Navigation ─────────────────────────────────────────────────────────────
export const NAV_LINKS = [
    { label: "How It Works", href: "#how-it-works" },
    { label: "For Vendors", href: "#vendors" },
    { label: "For Agencies", href: "#agencies" },
    { label: "For Agents", href: "#agents" },
];

// ─── Section IDs (for progress indicator) ───────────────────────────────────
export const SECTION_IDS = [
    { id: "hero", label: "Home" },
    { id: "how-it-works", label: "Platform" },
    { id: "vendors", label: "Vendors" },
    { id: "agencies", label: "Agencies" },
    { id: "agents", label: "Agents" },
    { id: "customers", label: "Customers" },
    { id: "why-jovi", label: "Built For You" },
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
    "why-jovi": "role-accent",
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

/** WhatsApp deep-link for the customer role registration callout */
export const WHATSAPP_CUSTOMER_LINK = `https://wa.me/${BRAND.whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent("Hi, I want to shop on Jovi Mall!")}`;
