# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Serving four roles on one platform. Acquisition priority (confirmed): **customers first, then vendors, then agencies, then agents.**

- **Customers (primary target):** shoppers in Francophone Central Africa (Cameroon first) on mobile-dominant, often low-bandwidth connections. They buy by chatting on WhatsApp with an AI assistant — no app download, no account, no website to navigate.
- **Vendors:** small businesses and sellers who want to sell without a website, app, or tech team. They upload a catalog and let the AI sell for them.
- **Agencies:** delivery operators who coordinate a network of agents and earn commission on every successful delivery.
- **Agents:** individuals who deliver orders from their phone and get paid per delivery.

## Product Purpose

Jovi Mall is WhatsApp-first, AI-powered ecommerce infrastructure. Customers shop by chatting on WhatsApp; an AI assistant understands intent, recommends products, and creates orders inside the chat. Vendors upload a catalog and the AI sells on their behalf — with no storefront, website, or app on either side. Agencies and agents fulfill delivery and earn on each order. Success is a transaction completed end-to-end — chat → recommendation → order → payment → delivery → payout — with value flowing to all actors. Tagline: *"Commerce runs on conversation."*

## Positioning

WhatsApp-native, AI-run commerce built from the ground up for mobile-dominant, WhatsApp-native, data-conscious African markets — deliberately *not* a Western storefront model repackaged. The differentiating mechanism a neighboring product could not truthfully copy: neither side needs a storefront, website, or app — the AI assistant *is* the store, operating inside WhatsApp where users already spend their day; and a single platform connects four actors so one transaction pays vendor, agency, agent, and platform together ("multi-actor shared economy"). Engineered to work on 2G/3G and spotty connections and on entry-level devices.

## Operating Context

- Commerce happens inside WhatsApp chat threads on mobile phones (entry-level to flagship), frequently on constrained data and unreliable networks.
- Multi-role platform with distinct surfaces: Vendor dashboard, Agency dashboard, Agent app, and a Customer portal — though customers transact primarily through WhatsApp rather than a web account. Accounts support multiple roles, role switching, and a WhatsApp verification gate before dashboard access.
- Order lifecycle: customer chats → AI recommends → order created and paid within WhatsApp → agency assigns the nearest agent → agent delivers with real-time tracking → revenue/payout distributed across actors.
- Multi-language product: English, French, Portuguese, Spanish, and Arabic (RTL supported); light/dark theming.
- This repository is the landing/marketing site plus the customer-facing shop and auth flows (Next.js web frontend).

## Capabilities and Constraints

- **Confirmed functionality (from code):** AI product recommendation over WhatsApp; vendor catalog upload; multi-role auth (register / login / add-role / switch-role) with WhatsApp verification; a shop experience (product detail, cart, checkout, saved items, vendor stores, account); local mobile payment methods; delivery dispatch to agents with tracking.
- **Stack (existing — do not swap frameworks):** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, next-intl for i18n, framer-motion, react-hook-form + zod. Backend API base is configurable via `NEXT_PUBLIC_API_URL`.
- **Terminology:** Vendor, Agency, Agent, Customer; "roles"; the AI assistant is "Jovi AI".
- **Constraints to honor:** low-data / low-bandwidth performance, entry-level device support, RTL for Arabic, and WhatsApp as the primary customer channel.
- **Open / not yet settled:** the primary market is Cameroon / Francophone Central Africa, but current demo copy is English-led and prices in Naira (₦, Nigeria). Currency and default language for the real market are **not yet aligned** — treat Naira pricing and English-only demo copy as placeholder, not settled product truth (real market likely points to FCFA / XAF and French-first). The WhatsApp business number (`+2340000000000`) is a placeholder; `hello@jovimall.com` is unconfirmed as a live contact.

## Brand Commitments

- **Name:** Jovi Mall. (The repo folder `wi-mall` is legacy; the product name is Jovi Mall throughout the code and metadata.)
- **Tagline:** "Commerce runs on conversation."
- **Voice:** confident, plain-spoken, benefit-led, and optimistic — commerce made effortless and human through chat, with an explicit Africa-first framing ("Built for how you actually shop").
- **Identity anchor:** WhatsApp-native conversational commerce and the AI assistant persona ("Jovi AI").
- Visual identity (palette, typography, components) is intentionally left to DESIGN.md, not recorded here.

## Evidence on Hand

- **Real:** a functioning multi-role web app in this repo — auth, shop, checkout, and full internationalization across five languages — plus a comprehensive backend error-code catalog that evidences the breadth of the product surface.
- **Stage: Early live.** Real users and orders exist but are small in number. Present real proof only where it genuinely exists.
- **NOT real — must not be presented as current fact:** the trust stats (10K+ vendors, 500+ delivery agencies, 2M+ orders, 15+ cities) are explicitly first-year *goals* in the code, not counts; there are no real testimonials, customer logos, or press on hand yet; the WhatsApp number and contact details are placeholders. Future work must not fabricate any of these.

## Product Principles

1. **Meet people inside WhatsApp.** No storefront, app, or account should stand between a customer and a purchase.
2. **The AI is the salesperson.** Discovery, recommendation, and ordering happen through conversation, not navigation.
3. **Every transaction pays all four sides.** Vendor, agency, agent, and platform value must move together.
4. **Africa-first engineering.** Assume mobile-dominant, entry-level devices and unreliable, low-data networks as the default case, not the edge case.
5. **Don't overstate traction.** As an early-live product, present real proof honestly and keep scale figures as clearly stated goals.

## Accessibility & Inclusion

Internationalization including RTL (Arabic) is a first-class requirement, as are low-bandwidth performance and entry-level device support. The codebase already reflects accessibility care (reduced-motion handling, ARIA labelling, semantic landmarks). No formal conformance standard (e.g. WCAG AA) has been confirmed as a binding target yet — recommended, pending confirmation.
