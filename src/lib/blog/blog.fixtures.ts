/**
 * ⚠️ **NOT WIRED. Nothing in this file renders.**
 *
 * The blog pages read the public API (`lib/blog/blog.api.ts`,
 * `api-doc/public/articles.md`). This file is what they read *before* that
 * existed, and it is kept for exactly one reason: it is five drafted articles
 * that nobody has decided about yet. None of it was imported into the CMS —
 * publishing it is a decision for whoever reads it, not a migration step.
 *
 * So there are three live outcomes, and this is the middle one:
 *
 * - **Import it** into the editor, article by article, once reviewed.
 * - **Leave it** here as drafts. Costs nothing but the file.
 * - **Delete it.** Recoverable with `git show`, like the api-docs before it.
 *
 * The prose is written to be *true* rather than plausible, because untrue
 * placeholder copy has a way of surviving to production. Every factual claim
 * is one already verified against the backend and recorded in
 * BACKEND-REQUIREMENTS.md §2 — how commission is taken, how the delivery fee
 * splits, what the payout timeline is, which gateways exist, which regions are
 * served.
 *
 * **Two rules that still apply, and now apply to the editor instead.**
 *
 * 1. **No prices in an article body.** Not a plan price, not a credit pack
 *    price, not a commission percentage. Those numbers live in the admin
 *    catalog and are fetched at build time; the marketing prose that does quote
 *    them is held to the catalog by `lib/marketing/copy-claims.ts`, and article
 *    bodies are not covered by that guard. A number written into one goes stale
 *    silently. Say "your plan's rate" and link to /pricing, which is live.
 * 2. **No invented metrics.** No "vendors see a 40% lift". The product is
 *    early; there is no measurement behind a figure like that, and inventing
 *    one on a page carrying Article structured data is the same category of
 *    problem as the invented review counts that `lib/seo/jsonld.ts` refuses to
 *    emit.
 *
 * `BLOG_CATEGORIES` moved to `blog.categories.ts` and `BLOG_IS_PLACEHOLDER` to
 * `blog.seo.ts` when this stopped being the content — both are live config and
 * do not belong in a file of drafts.
 */
import type { Article, Author, Block, InlineNode, RichText } from "./blog.types";

/* ─── Authoring helpers ───────────────────────────────────────────────────── */
/* Local conveniences, not part of the content contract — they exist so the
   articles below read as prose rather than as a syntax tree. */

const txt = (text: string): InlineNode => ({ type: "text", text });
const strong = (text: string): InlineNode => ({ type: "text", text, bold: true });
const link = (text: string, href: string): InlineNode => ({ type: "link", text, href });

const p = (...text: RichText): Block => ({ type: "paragraph", text });
const h2 = (id: string, text: string): Block => ({ type: "heading", level: 2, id, text });
const h3 = (id: string, text: string): Block => ({ type: "heading", level: 3, id, text });
const ul = (...items: RichText[]): Block => ({ type: "list", items });
const ol = (...items: RichText[]): Block => ({ type: "list", ordered: true, items });
const quote = (text: string, attribution?: string): Block => ({ type: "quote", text, attribution });
const note = (tone: "note" | "tip" | "warning", title: string, ...text: RichText): Block => ({
  type: "callout",
  tone,
  title,
  text,
});
const cta = (title: string, body: string, href: string, label: string): Block => ({
  type: "cta",
  title,
  body,
  href,
  label,
});
const faq = (...items: { question: string; answer: string }[]): Block => ({ type: "faq", items });

/* ─── Authors ─────────────────────────────────────────────────────────────── */

/**
 * Two house bylines rather than invented individuals with invented headshots.
 *
 * `Article` structured data wants an author, and a fabricated person with a
 * stock-photo face is a claim about a human being who does not exist. A named
 * editorial team is a true statement, it satisfies the schema, and it does not
 * have to be retracted when a real writer is hired.
 */
export const BLOG_AUTHORS: Author[] = [
  {
    id: "wimall-editorial",
    name: "The WiMall team",
    type: "Organization",
    translations: {
      en: {
        title: "Editorial",
        bio: "We build the tools Cameroonian vendors, agencies and agents use to run orders on WhatsApp — and write about what we learn doing it.",
      },
      fr: {
        title: "Rédaction",
        bio: "Nous construisons les outils que les vendeurs, agences et livreurs camerounais utilisent pour gérer leurs commandes sur WhatsApp — et nous écrivons sur ce que nous y apprenons.",
      },
    },
  },
  {
    id: "wimall-product",
    name: "WiMall Product",
    type: "Organization",
    translations: {
      en: {
        title: "Product team",
        bio: "The people who decide how the platform behaves, explaining the parts of it that are worth understanding before you rely on them.",
      },
      fr: {
        title: "Équipe produit",
        bio: "Celles et ceux qui décident du fonctionnement de la plateforme, expliquant ce qu'il vaut mieux comprendre avant de s'y fier.",
      },
    },
  },
];

/* ─── Articles ────────────────────────────────────────────────────────────── */

export const BLOG_ARTICLES: Article[] = [
  /* ═══ 1. Selling on WhatsApp without a website ══════════════════════════ */
  {
    id: "sell-on-whatsapp-without-a-website",
    categoryKey: "selling",
    authorId: "wimall-editorial",
    publishedAt: "2026-07-22T08:00:00.000Z",
    featured: true,
    translations: [
      {
        locale: "en",
        slug: "how-to-sell-on-whatsapp-without-a-website",
        title: "How to sell on WhatsApp without a website",
        metaTitle: "How to Sell on WhatsApp Without a Website (Cameroon Guide)",
        excerpt:
          "You do not need a storefront, a domain or a developer to take orders. You need a catalog someone can browse, a way to get paid, and a way to deliver. Here is how each of those works over a chat thread.",
        body: [
          p(
            txt(
              "Almost every small business in Douala that sells anything already sells it on WhatsApp. The order arrives as a voice note, the price is agreed in the thread, and a moto shows up with the parcel. It works. What it does not do is scale past the number of conversations one person can hold at once."
            )
          ),
          p(
            txt(
              "The instinct at that point is to build a website. It is almost always the wrong next step. A website asks a customer to leave the app they already have open, to trust a payment form they have never seen, and to type an address into a field. Each of those is a place to lose the sale — and none of them is the thing that was actually slowing you down."
            )
          ),
          p(
            txt(
              "What was slowing you down is that you were the catalog, the checkout and the dispatcher. Those three jobs can be handed off without moving the conversation anywhere."
            )
          ),

          h2("catalog", "Start with a catalog someone can actually browse"),
          p(
            txt(
              "The first bottleneck is not sales, it is answering "
            ),
            txt("what do you have?"),
            txt(
              " thirty times a day. A photo album in your status does not answer it — the customer has to scroll, and cannot ask a follow-up about the third item without describing it to you."
            )
          ),
          p(
            txt(
              "A catalog fixes this when it is structured: each product with its own price, its variants, and enough description that a question about it can be answered without you. That structure is what lets anything else — a search, an assistant, a shareable link — do the answering on your behalf."
            )
          ),
          note(
            "tip",
            "Write for the question, not the product",
            txt(
              "A description that says \"Samsung A15, 128GB, black\" is a label. One that says who it suits, what it comes with and what the warranty is answers the message the customer was about to send. That is the difference between a catalog that deflects questions and one that generates them. There is more on this in "
            ),
            link("our guide to writing product descriptions", "/blog/write-product-descriptions-ai-can-sell-from"),
            txt(".")
          ),

          h2("payment", "Decide how you get paid before you need to"),
          p(
            txt(
              "The second bottleneck is money, and it is the one most sellers postpone until a customer asks. Cameroon has a good answer to this and it is not cards: mobile money is what people actually have. MTN Mobile Money, Orange Money and Moov Money between them cover most of the market, and a customer paying from the wallet already on their phone is a customer who does not abandon the order."
            )
          ),
          p(
            txt("Cash on delivery still matters too, particularly for a first order from a seller the customer does not know yet. Treating it as a legitimate option rather than a nuisance is usually worth more than the collection friction costs. We go through the trade-offs in "),
            link("getting paid on WhatsApp in Cameroon", "/blog/getting-paid-on-whatsapp-in-cameroon"),
            txt(".")
          ),

          h2("delivery", "Deliver through someone whose job it is"),
          p(
            txt(
              "The third bottleneck is the one that quietly caps a business. Arranging a moto for each order is fine at three orders a day. At thirty it is a full-time job, and it is the job you are worst at, because you have no dispatcher's view of who is free and where they are."
            )
          ),
          p(
            txt(
              "Handing delivery to a registered agency changes the arithmetic in a way worth being precise about. On WiMall the delivery fee does not go to the platform at all — the agency keeps it, minus whatever cut it has contracted with the agent who actually rides. You are buying dispatch, not renting a middleman."
            )
          ),
          ul(
            [strong("You quote a fee, not a favour."), txt(" The customer sees a delivery price at checkout, the same way they see the product price.")],
            [strong("Coverage is registered per region."), txt(" An agency covering Littoral reaches Edéa and Nkongsamba as surely as it reaches Douala.")],
            [strong("Capacity is visible."), txt(" An agent already at their plan's limit cannot be handed another shipment — the assignment is rejected rather than quietly queued behind a rider who will not get to it.")]
          ),

          h2("what-changes", "What actually changes on the customer's side"),
          p(
            txt(
              "Nothing. That is the point, and it is the part sellers find hardest to believe. The customer opens the same thread with the same business and asks the same question. What changed is that the answer arrives immediately, the price is already agreed, the payment link works from the wallet they already use, and the delivery is somebody's actual job."
            )
          ),
          quote(
            "The store was never the thing customers wanted. They wanted an answer, a price and a delivery date — and a chat thread is a perfectly good place to get all three.",
            "WiMall product notes"
          ),

          h2("getting-started", "What it takes to start"),
          p(
            txt(
              "Less than sellers expect. Vendor onboarding asks for your country and your payout details — where money should land when an order completes — and that is the required set. You are not filling in a business plan before you can list a product."
            )
          ),
          ol(
            [txt("Create a vendor account and set your country and payout details.")],
            [txt("Upload your products with real prices and real variants.")],
            [txt("Pick how you want to be paid: mobile money, card, cash on delivery, or all three.")],
            [txt("Let a registered delivery agency handle the last mile.")]
          ),
          faq(
            {
              question: "Do I need a registered business to sell on WhatsApp?",
              answer:
                "To open a WiMall vendor account you need a country and payout details. Whether your trade needs to be registered with the authorities is a separate question and depends on what you sell and at what volume — it is not something the platform decides for you.",
            },
            {
              question: "Can I keep my existing WhatsApp number?",
              answer:
                "Yes. The number your customers already message is the one worth keeping — the point of this setup is that nobody has to learn a new way to reach you.",
            },
            {
              question: "What happens to orders that were already agreed in chat?",
              answer:
                "Nothing stops you closing a sale by hand. A structured catalog and a quoted delivery fee are there for the orders you do not want to negotiate individually, not to prevent the ones you do.",
            }
          ),
          cta(
            "Put your catalog somewhere it can answer for you",
            "Setting up as a vendor takes a country, your payout details and your products. The free tier is a real tier, not a trial.",
            "/register?role=vendor",
            "Start selling free"
          ),
        ],
      },
      {
        locale: "fr",
        slug: "comment-vendre-sur-whatsapp-sans-site-web",
        title: "Comment vendre sur WhatsApp sans site web",
        metaTitle: "Vendre sur WhatsApp sans site web : le guide (Cameroun)",
        excerpt:
          "Pas besoin de boutique en ligne, de nom de domaine ni de développeur pour prendre des commandes. Il vous faut un catalogue consultable, un moyen d'être payé et un moyen de livrer. Voici comment chacun fonctionne dans une conversation.",
        body: [
          p(
            txt(
              "À Douala, presque tous les petits commerces qui vendent quelque chose le vendent déjà sur WhatsApp. La commande arrive en note vocale, le prix se négocie dans la conversation, et un moto-taximan repart avec le colis. Ça marche. Ce que ça ne fait pas, c'est passer à l'échelle au-delà du nombre de conversations qu'une seule personne peut tenir à la fois."
            )
          ),
          p(
            txt(
              "Le réflexe, à ce moment-là, est de faire un site web. C'est presque toujours la mauvaise étape suivante. Un site demande au client de quitter l'application qu'il a déjà ouverte, de faire confiance à un formulaire de paiement qu'il n'a jamais vu, et de saisir une adresse dans un champ. Chacune de ces étapes est un endroit où la vente se perd — et aucune n'est ce qui vous ralentissait réellement."
            )
          ),
          p(
            txt(
              "Ce qui vous ralentissait, c'est que vous étiez à la fois le catalogue, la caisse et le dispatcheur. Ces trois métiers peuvent être délégués sans déplacer la conversation nulle part."
            )
          ),

          h2("catalogue", "Commencez par un catalogue réellement consultable"),
          p(
            txt(
              "Le premier goulot d'étranglement n'est pas la vente, c'est de répondre trente fois par jour à « vous avez quoi ? ». Un album photo dans votre statut ne répond pas à cette question : le client doit faire défiler, et il ne peut pas poser une question sur le troisième article sans vous le décrire."
            )
          ),
          p(
            txt(
              "Un catalogue règle ça quand il est structuré : chaque produit avec son prix, ses variantes, et une description assez complète pour qu'une question trouve sa réponse sans vous. C'est cette structure qui permet à autre chose — une recherche, un assistant, un lien partageable — de répondre à votre place."
            )
          ),
          note(
            "tip",
            "Écrivez pour la question, pas pour le produit",
            txt(
              "Une description qui dit « Samsung A15, 128 Go, noir » est une étiquette. Une qui dit à qui il convient, ce qu'il contient et quelle est la garantie répond au message que le client s'apprêtait à envoyer. C'est toute la différence entre un catalogue qui évite les questions et un catalogue qui en suscite."
            )
          ),

          h2("paiement", "Décidez comment vous êtes payé avant d'en avoir besoin"),
          p(
            txt(
              "Le deuxième goulot, c'est l'argent, et c'est celui que la plupart des vendeurs repoussent jusqu'à ce qu'un client pose la question. Le Cameroun a une bonne réponse, et ce ne sont pas les cartes bancaires : le mobile money est ce que les gens ont réellement. MTN Mobile Money, Orange Money et Moov Money couvrent ensemble l'essentiel du marché, et un client qui paie depuis le portefeuille déjà présent sur son téléphone est un client qui n'abandonne pas sa commande."
            )
          ),
          p(
            txt("Le paiement à la livraison compte aussi, en particulier pour une première commande chez un vendeur que le client ne connaît pas encore. Le traiter comme une option légitime plutôt que comme une contrainte vaut généralement plus que ce que coûte la collecte. Nous détaillons les arbitrages dans "),
            link("se faire payer sur WhatsApp au Cameroun", "/blog/se-faire-payer-sur-whatsapp-au-cameroun"),
            txt(".")
          ),

          h2("livraison", "Livrez par quelqu'un dont c'est le métier"),
          p(
            txt(
              "Le troisième goulot est celui qui plafonne discrètement une activité. Trouver un moto pour chaque commande va très bien à trois commandes par jour. À trente, c'est un emploi à plein temps — et c'est celui où vous êtes le moins bon, parce que vous n'avez pas la vue d'un dispatcheur sur qui est libre et où."
            )
          ),
          p(
            txt(
              "Confier la livraison à une agence enregistrée change le calcul d'une manière qu'il vaut la peine d'énoncer précisément. Sur WiMall, les frais de livraison ne vont pas du tout à la plateforme : l'agence les conserve, moins la part contractuelle du livreur qui roule effectivement. Vous achetez du dispatch, vous ne louez pas un intermédiaire."
            )
          ),
          ul(
            [strong("Vous annoncez un tarif, pas un service rendu."), txt(" Le client voit un prix de livraison au moment de commander, comme il voit le prix du produit.")],
            [strong("La couverture est enregistrée par région."), txt(" Une agence qui couvre le Littoral dessert Édéa et Nkongsamba aussi sûrement que Douala.")],
            [strong("La capacité est visible."), txt(" Un livreur déjà au plafond de son forfait ne peut pas recevoir une course de plus : l'affectation est refusée plutôt que mise en attente derrière quelqu'un qui n'y arrivera pas.")]
          ),

          h2("changement", "Ce qui change réellement côté client"),
          p(
            txt(
              "Rien. C'est tout l'intérêt, et c'est la partie que les vendeurs ont le plus de mal à croire. Le client ouvre la même conversation avec le même commerce et pose la même question. Ce qui a changé, c'est que la réponse arrive immédiatement, que le prix est déjà fixé, que le lien de paiement fonctionne depuis le portefeuille qu'il utilise déjà, et que la livraison est le métier de quelqu'un."
            )
          ),

          h2("demarrer", "Ce qu'il faut pour démarrer"),
          p(
            txt(
              "Moins que ce que les vendeurs imaginent. L'inscription vendeur demande votre pays et vos coordonnées de versement — où l'argent doit arriver quand une commande est terminée — et c'est tout ce qui est obligatoire. Vous ne remplissez pas un business plan avant de pouvoir publier un produit."
            )
          ),
          ol(
            [txt("Créez un compte vendeur et renseignez votre pays et vos coordonnées de versement.")],
            [txt("Publiez vos produits avec de vrais prix et de vraies variantes.")],
            [txt("Choisissez comment être payé : mobile money, carte, paiement à la livraison, ou les trois.")],
            [txt("Laissez une agence de livraison enregistrée s'occuper du dernier kilomètre.")]
          ),
          faq(
            {
              question: "Faut-il une entreprise enregistrée pour vendre sur WhatsApp ?",
              answer:
                "Pour ouvrir un compte vendeur WiMall, il faut un pays et des coordonnées de versement. Savoir si votre activité doit être déclarée auprès des autorités est une question distincte, qui dépend de ce que vous vendez et à quel volume — ce n'est pas la plateforme qui en décide.",
            },
            {
              question: "Puis-je garder mon numéro WhatsApp actuel ?",
              answer:
                "Oui. Le numéro que vos clients utilisent déjà est celui qu'il faut garder : l'intérêt de cette organisation est justement que personne n'ait à apprendre une nouvelle façon de vous joindre.",
            },
            {
              question: "Que deviennent les commandes déjà négociées dans la conversation ?",
              answer:
                "Rien ne vous empêche de conclure une vente à la main. Un catalogue structuré et des frais de livraison annoncés servent aux commandes que vous ne voulez pas négocier une par une, pas à empêcher celles que vous voulez encore négocier.",
            }
          ),
          cta(
            "Mettez votre catalogue là où il peut répondre pour vous",
            "S'inscrire comme vendeur demande un pays, vos coordonnées de versement et vos produits. L'offre gratuite est une vraie offre, pas une période d'essai.",
            "/register?role=vendor",
            "Commencer gratuitement"
          ),
        ],
      },
    ],
  },

  /* ═══ 2. Getting paid ═══════════════════════════════════════════════════ */
  {
    id: "getting-paid-on-whatsapp",
    categoryKey: "payments",
    authorId: "wimall-product",
    publishedAt: "2026-07-08T08:00:00.000Z",
    updatedAt: "2026-07-30T09:20:00.000Z",
    translations: [
      {
        locale: "en",
        slug: "getting-paid-on-whatsapp-in-cameroon",
        title: "Getting paid on WhatsApp in Cameroon: mobile money, cards and cash",
        metaTitle: "How to Get Paid on WhatsApp in Cameroon — MoMo, OM & Cash",
        excerpt:
          "Mobile money is what your customers actually carry, cards are what a small minority use, and cash on delivery is what earns a first-time buyer's trust. Here is how each behaves, and when the money reaches you.",
        body: [
          p(
            txt(
              "The payment question is the one that decides whether a WhatsApp conversation becomes an order. Everything before it is interest; everything after it is logistics. It is also the part where sellers most often copy a pattern from somewhere else — usually a card checkout designed for a market where everyone has a card — and then wonder why the order rate dropped."
            )
          ),
          p(txt("Here is what is actually available, and what each option costs you in friction.")),

          h2("mobile-money", "Mobile money: the default, not the alternative"),
          p(
            txt(
              "MTN Mobile Money, Orange Money and Moov Money are not a fallback for customers without a bank account. For most of the market they are the account. A customer paying by MoMo is paying from a wallet they already top up, with a PIN they already know, in an app flow they have used to pay for airtime that week."
            )
          ),
          p(
            txt(
              "On WiMall these are reached through NotchPay and MyCoolPay, which between them cover the three networks. From the seller's side the relevant thing is that this is a confirmed, instant payment — you know it succeeded before the parcel leaves."
            )
          ),
          note(
            "note",
            "The number matters more than the network",
            txt(
              "Customers routinely pay from a different number than the one they message you on. Ask for the paying number rather than assuming, or you will spend real time reconciling a payment against an order it does not obviously belong to."
            )
          ),

          h2("cards", "Cards: worth having, not worth designing around"),
          p(
            txt(
              "Card payment through Stripe exists and is worth leaving switched on. It matters for the diaspora — someone in Paris or Montréal paying for a delivery to family in Yaoundé is a real and reliably high-value order, and they are paying with a card because that is what they have."
            )
          ),
          p(
            txt(
              "What it is not is the primary flow. Building your checkout copy around a card form and treating mobile money as the secondary option inverts the actual distribution of your customers."
            )
          ),

          h2("cod", "Cash on delivery: the trust purchase"),
          p(
            txt(
              "Cash on delivery is the option sellers most want to remove and most often should not. A customer buying from you for the first time, with no prior relationship and no way to verify you exist, is making a bet. Cash on delivery is how they make that bet cheaply."
            )
          ),
          p(
            txt(
              "It costs you something real: the agent collects, reconciliation is a step, and a refused parcel is a wasted trip. The judgement is whether that cost is smaller than the first orders you would never have received. Early on it usually is."
            )
          ),
          quote(
            "A first-time customer is not choosing between paying now and paying on delivery. They are choosing between paying on delivery and not ordering.",
            "WiMall product notes"
          ),

          h2("when-money-arrives", "When the money actually reaches you"),
          p(
            txt(
              "This is the part worth understanding before you rely on it, because it is not instant and the reasons are good ones."
            )
          ),
          ol(
            [strong("Payment is taken and held."), txt(" The customer pays at order time and the funds sit in escrow. They are not yours yet, and they are not the platform's either.")],
            [strong("The order completes."), txt(" Either the customer confirms delivery, or it auto-confirms after seven days — so a customer who simply never taps anything does not strand your money indefinitely.")],
            [strong("A hold period runs."), txt(" Seven days after completion, which is the window in which a dispute would realistically surface.")],
            [strong("You request the payout."), txt(" The balance is then available to withdraw to the payout details you set during onboarding.")]
          ),
          p(
            txt(
              "Commission is taken at payment, not at payout — it is a percentage of the order's gross, set by your plan, and the amount that reaches escrow is already net of it. That means the balance you see is the balance you get, which is the property worth having."
            )
          ),
          note(
            "warning",
            "Plan for the gap, not against it",
            txt(
              "The practical consequence is that money from a sale today is requestable a couple of weeks out. If you are restocking from revenue, that gap is your working-capital requirement and it is better sized deliberately than discovered. Current rates and allowances are on "
            ),
            link("the pricing page", "/pricing"),
            txt(", which reads from the live catalog.")
          ),

          h2("delivery-fee", "One thing that is not a payment question"),
          p(
            txt(
              "The delivery fee is not part of what the platform takes. It goes to the agency that did the delivering, less the cut contracted with the agent who rode it. No share of it reaches WiMall. This confuses people who assume a marketplace takes a percentage of everything, so it is worth being explicit: commission is on the goods, and only on the goods."
            )
          ),
          faq(
            {
              question: "Which mobile money networks are supported?",
              answer:
                "MTN Mobile Money, Orange Money and Moov Money, reached through the NotchPay and MyCoolPay gateways. Card payments run through Stripe, and cash on delivery is available as well.",
            },
            {
              question: "How long until I can withdraw money from a sale?",
              answer:
                "Funds are held in escrow until the order completes — on customer confirmation, or automatically after seven days — and then held a further seven days before the balance becomes requestable.",
            },
            {
              question: "Is commission taken from the delivery fee too?",
              answer:
                "No. Commission is a percentage of the order's goods total, taken at payment. The delivery fee goes to the agency, which keeps it less the agent's contracted cut.",
            },
            {
              question: "What happens if a customer never confirms delivery?",
              answer:
                "The order auto-confirms seven days after delivery so that the payout timeline is not blocked by a customer who simply stops responding.",
            }
          ),
          cta(
            "See what a plan costs before you commit",
            "Rates, credit allowances and limits for every tier, read live from the catalog.",
            "/pricing",
            "See the plans"
          ),
        ],
      },
      {
        locale: "fr",
        slug: "se-faire-payer-sur-whatsapp-au-cameroun",
        title: "Se faire payer sur WhatsApp au Cameroun : mobile money, carte et espèces",
        metaTitle: "Se faire payer sur WhatsApp au Cameroun — MoMo, OM et espèces",
        excerpt:
          "Le mobile money est ce que vos clients ont réellement, la carte concerne une minorité, et le paiement à la livraison est ce qui gagne la confiance d'un premier acheteur. Voici comment chaque option se comporte, et quand l'argent vous parvient.",
        body: [
          p(
            txt(
              "La question du paiement est celle qui décide si une conversation WhatsApp devient une commande. Tout ce qui précède n'est que de l'intérêt ; tout ce qui suit n'est que de la logistique. C'est aussi le point où les vendeurs recopient le plus souvent un modèle venu d'ailleurs — en général un tunnel par carte conçu pour un marché où tout le monde a une carte — avant de s'étonner que le taux de commande baisse."
            )
          ),
          p(txt("Voici ce qui existe réellement, et ce que chaque option vous coûte en friction.")),

          h2("mobile-money", "Mobile money : la norme, pas l'alternative"),
          p(
            txt(
              "MTN Mobile Money, Orange Money et Moov Money ne sont pas une solution de repli pour les clients sans compte bancaire. Pour l'essentiel du marché, ils sont le compte. Un client qui paie par MoMo paie depuis un portefeuille qu'il recharge déjà, avec un code qu'il connaît déjà, dans un parcours qu'il a utilisé cette semaine pour acheter du crédit."
            )
          ),
          p(
            txt(
              "Sur WiMall, on y accède via NotchPay et MyCoolPay, qui couvrent à eux deux les trois réseaux. Du point de vue du vendeur, ce qui compte est qu'il s'agit d'un paiement confirmé et immédiat : vous savez qu'il a abouti avant que le colis ne parte."
            )
          ),
          note(
            "note",
            "Le numéro compte plus que le réseau",
            txt(
              "Les clients paient très souvent depuis un numéro différent de celui avec lequel ils vous écrivent. Demandez le numéro payeur plutôt que de le supposer, sinon vous passerez un temps réel à rapprocher un paiement d'une commande à laquelle rien ne le rattache visiblement."
            )
          ),

          h2("carte", "La carte : à garder, sans construire autour"),
          p(
            txt(
              "Le paiement par carte via Stripe existe et mérite de rester activé. Il compte pour la diaspora : quelqu'un à Paris ou à Montréal qui paie une livraison pour sa famille à Yaoundé, c'est une commande réelle et souvent d'un bon montant, et cette personne paie par carte parce que c'est ce qu'elle a."
            )
          ),
          p(
            txt(
              "Ce n'est en revanche pas le parcours principal. Rédiger votre page de paiement autour d'un formulaire de carte en reléguant le mobile money au second plan inverse la répartition réelle de vos clients."
            )
          ),

          h2("livraison-especes", "Paiement à la livraison : l'achat de confiance"),
          p(
            txt(
              "Le paiement à la livraison est l'option que les vendeurs veulent le plus supprimer et qu'ils devraient le plus souvent garder. Un client qui achète chez vous pour la première fois, sans relation préalable et sans moyen de vérifier que vous existez, fait un pari. Le paiement à la livraison est sa façon de faire ce pari à bas coût."
            )
          ),
          p(
            txt(
              "Cela vous coûte quelque chose de réel : le livreur encaisse, le rapprochement est une étape de plus, et un colis refusé est un déplacement perdu. Le jugement consiste à savoir si ce coût est inférieur aux premières commandes que vous n'auriez jamais reçues. Au début, c'est généralement le cas."
            )
          ),

          h2("quand-largent-arrive", "Quand l'argent vous parvient réellement"),
          p(
            txt(
              "C'est la partie à comprendre avant de s'y fier, car ce n'est pas immédiat — et les raisons sont bonnes."
            )
          ),
          ol(
            [strong("Le paiement est prélevé et conservé."), txt(" Le client paie au moment de la commande et les fonds sont placés sous séquestre. Ils ne sont pas encore à vous, ni à la plateforme.")],
            [strong("La commande se termine."), txt(" Soit le client confirme la livraison, soit elle se confirme automatiquement au bout de sept jours — un client qui ne clique jamais sur rien ne bloque donc pas votre argent indéfiniment.")],
            [strong("Une période de rétention court."), txt(" Sept jours après la clôture, ce qui correspond au délai pendant lequel un litige apparaîtrait réellement.")],
            [strong("Vous demandez le versement."), txt(" Le solde est alors disponible vers les coordonnées renseignées à l'inscription.")]
          ),
          p(
            txt(
              "La commission est prélevée au paiement, pas au versement : c'est un pourcentage du montant brut de la commande, fixé par votre forfait, et la somme qui arrive sous séquestre en est déjà nette. Le solde que vous voyez est donc le solde que vous recevez, ce qui est la propriété intéressante."
            )
          ),
          note(
            "warning",
            "Anticipez le décalage plutôt que de le subir",
            txt(
              "En pratique, l'argent d'une vente d'aujourd'hui est demandable une quinzaine de jours plus tard. Si vous réapprovisionnez sur votre chiffre d'affaires, ce décalage est votre besoin en fonds de roulement : mieux vaut le dimensionner que le découvrir. Les tarifs à jour sont sur "
            ),
            link("la page des tarifs", "/pricing"),
            txt(", alimentée par le catalogue en direct.")
          ),

          h2("frais-livraison", "Une chose qui n'est pas une question de paiement"),
          p(
            txt(
              "Les frais de livraison ne font pas partie de ce que prend la plateforme. Ils reviennent à l'agence qui a livré, moins la part contractuelle du livreur qui a roulé. Aucune fraction n'arrive à WiMall. Cela surprend ceux qui supposent qu'une place de marché prélève un pourcentage sur tout : la commission porte sur la marchandise, et uniquement sur elle."
            )
          ),
          faq(
            {
              question: "Quels réseaux de mobile money sont pris en charge ?",
              answer:
                "MTN Mobile Money, Orange Money et Moov Money, via les passerelles NotchPay et MyCoolPay. Les paiements par carte passent par Stripe, et le paiement à la livraison est également disponible.",
            },
            {
              question: "Sous combien de temps puis-je retirer l'argent d'une vente ?",
              answer:
                "Les fonds restent sous séquestre jusqu'à la clôture de la commande — sur confirmation du client, ou automatiquement au bout de sept jours — puis sept jours supplémentaires avant que le solde ne devienne demandable.",
            },
            {
              question: "La commission s'applique-t-elle aussi aux frais de livraison ?",
              answer:
                "Non. La commission est un pourcentage du montant des marchandises, prélevé au paiement. Les frais de livraison reviennent à l'agence, qui les conserve moins la part contractuelle du livreur.",
            }
          ),
          cta(
            "Voyez ce que coûte un forfait avant de vous engager",
            "Tarifs, dotations en crédits et limites de chaque offre, lus en direct depuis le catalogue.",
            "/pricing",
            "Voir les offres"
          ),
        ],
      },
    ],
  },

  /* ═══ 3. Starting a delivery agency ═════════════════════════════════════ */
  {
    id: "starting-a-delivery-agency",
    categoryKey: "delivery",
    authorId: "wimall-editorial",
    publishedAt: "2026-06-17T08:00:00.000Z",
    translations: [
      {
        locale: "en",
        slug: "starting-a-delivery-agency-in-cameroon",
        title: "Starting a delivery agency in Cameroon: what you need before the first order",
        metaTitle: "How to Start a Delivery Agency in Cameroon — Practical Guide",
        excerpt:
          "An agency is a dispatch business, not a riding business. What that means for the four things you have to decide before you can accept a single shipment.",
        body: [
          p(
            txt(
              "The delivery businesses that work in Cameroon are not the ones with the most riders. They are the ones that can answer, on demand, which rider is free, where they are, and what the trip will cost. That answer is the product. Everything else is riding, and riding is the part you can contract for."
            )
          ),
          p(txt("Four decisions have to exist before your first shipment. None of them is the motorbike.")),

          h2("coverage", "1. Where you actually cover"),
          p(
            txt(
              "Coverage is registered by region, and Cameroon has ten of them. This is more consequential than it sounds, because registering a region is a promise about the towns inside it, not just its capital. Cover Littoral and you have said you can reach Edéa, Nkongsamba, Mbanga, Loum, Penja and Yabassi — not only Douala."
            )
          ),
          p(
            txt(
              "The failure mode is claiming a region to look bigger and then declining the shipments that come from its edges. Register what you can actually service and expand deliberately."
            )
          ),
          note(
            "tip",
            "Narrow and reliable beats broad and selective",
            txt(
              "A vendor choosing an agency is choosing certainty. One that covers a single region and always accepts is worth more to them than one that covers five and refuses a third of what it is offered."
            )
          ),

          h2("agents", "2. What you pay your agents"),
          p(
            txt(
              "The agent cut is per-contract, not per-agency. It can be a percentage of the delivery fee or a flat amount, and it is quoted to the agent before they accept a shipment — so a rider always knows what a trip pays before they commit to it."
            )
          ),
          p(
            txt(
              "This is a real structural choice rather than a form field. Percentage keeps your margin proportional and makes long, expensive trips worth the rider's time on their own. Flat rates are predictable, which is what a rider budgeting a week actually wants, but they make cheap short hops your best business and long trips your worst."
            )
          ),
          p(
            txt(
              "Worth knowing: agents sign up independently of any agency and may hold contracts with several at once. Your riders are not captive, and the terms you offer are compared."
            )
          ),

          h2("capacity", "3. How much you can actually hold at once"),
          p(
            txt("Capacity is enforced at two levels, and they behave differently on purpose.")
          ),
          ul(
            [strong("The agency cap is soft."), txt(" Passing it raises an alert rather than blocking work — an agency having a good week should not be stopped mid-week.")],
            [strong("The agent cap is hard."), txt(" An agent already at their limit cannot be assigned another shipment; the assignment is refused outright.")]
          ),
          p(
            txt(
              "The hard cap is the one that protects your reputation. A rider silently holding nine parcels they cannot deliver today produces nine late deliveries and nine vendors who do not come back. Refusing the tenth is the system doing you a favour."
            )
          ),

          h2("economics", "4. The economics, stated plainly"),
          p(
            txt(
              "The delivery fee is yours. The platform takes no share of it. What leaves it is the agent's contracted cut, and the remainder is the agency's margin — which means your unit economics are a question between you and your riders, and nobody else is in the calculation."
            )
          ),
          quote(
            "The margin on a delivery is the fee minus the rider's cut. That is the whole formula, and there is no third party in it.",
            "WiMall product notes"
          ),

          h2("onboarding", "What onboarding asks for"),
          p(
            txt(
              "More than a vendor, and reasonably so — you are being trusted with other people's goods. The required set is your coverage areas, an HQ address, payout details, and your policies."
            )
          ),
          p(
            txt(
              "The policies matter more than they look. They are what a vendor reads when deciding whether to route orders to you, and a vague one reads as an unanswered question about who pays when a parcel is damaged."
            )
          ),
          faq(
            {
              question: "Do I need my own motorbikes to start an agency?",
              answer:
                "No. Agents sign up independently and contract with agencies; an agency is a dispatch operation. What you need is coverage you can service and terms riders will accept.",
            },
            {
              question: "Can one agent work for several agencies?",
              answer:
                "Yes. Agents hold agency contracts and may hold more than one at a time, which means the cut you offer is compared against what others offer.",
            },
            {
              question: "What happens if my agency exceeds its shipment cap?",
              answer:
                "The agency cap is soft — exceeding it raises an alert rather than blocking new work. The per-agent cap is hard, and an agent at capacity cannot be assigned a further shipment.",
            }
          ),
          cta(
            "Register your agency",
            "Coverage areas, an HQ address, payout details and your policies. That is the required set.",
            "/register?role=agency",
            "Register your agency"
          ),
        ],
      },
      {
        locale: "fr",
        slug: "creer-une-agence-de-livraison-au-cameroun",
        title: "Créer une agence de livraison au Cameroun : ce qu'il faut avant la première course",
        metaTitle: "Créer une agence de livraison au Cameroun — guide pratique",
        excerpt:
          "Une agence est une activité de dispatch, pas une activité de conduite. Ce que cela implique pour les quatre décisions à prendre avant d'accepter la moindre expédition.",
        body: [
          p(
            txt(
              "Les activités de livraison qui fonctionnent au Cameroun ne sont pas celles qui ont le plus de livreurs. Ce sont celles qui savent dire, à la demande, quel livreur est libre, où il se trouve, et ce que la course coûtera. Cette réponse est le produit. Le reste, c'est de la conduite — et la conduite se contractualise."
            )
          ),
          p(txt("Quatre décisions doivent exister avant votre première expédition. Aucune n'est la moto.")),

          h2("couverture", "1. Ce que vous couvrez réellement"),
          p(
            txt(
              "La couverture s'enregistre par région, et le Cameroun en compte dix. C'est plus lourd de conséquences qu'il n'y paraît : enregistrer une région est une promesse sur les villes qu'elle contient, pas seulement sur son chef-lieu. Couvrez le Littoral et vous avez dit que vous pouvez atteindre Édéa, Nkongsamba, Mbanga, Loum, Penja et Yabassi — pas uniquement Douala."
            )
          ),
          p(
            txt(
              "L'erreur classique consiste à revendiquer une région pour paraître plus grand, puis à refuser les expéditions venant de ses marges. Enregistrez ce que vous pouvez réellement desservir et étendez-vous délibérément."
            )
          ),
          note(
            "tip",
            "Restreint et fiable vaut mieux que large et sélectif",
            txt(
              "Un vendeur qui choisit une agence choisit une certitude. Une agence qui couvre une seule région et accepte toujours vaut mieux, pour lui, qu'une agence qui en couvre cinq et refuse un tiers de ce qu'on lui propose."
            )
          ),

          h2("livreurs", "2. Ce que vous payez à vos livreurs"),
          p(
            txt(
              "La part du livreur est contractuelle, pas fixée par agence. Elle peut être un pourcentage des frais de livraison ou un montant forfaitaire, et elle est annoncée au livreur avant qu'il accepte une course — il sait donc toujours ce que rapporte un trajet avant de s'engager."
            )
          ),
          p(
            txt(
              "C'est un vrai choix de structure, pas un champ de formulaire. Le pourcentage garde votre marge proportionnelle et rend les longues courses coûteuses intéressantes d'elles-mêmes. Le forfait est prévisible, ce que veut un livreur qui budgète sa semaine, mais il fait des courtes courses votre meilleure affaire et des longues votre pire."
            )
          ),
          p(
            txt(
              "À savoir : les livreurs s'inscrivent indépendamment de toute agence et peuvent détenir plusieurs contrats à la fois. Vos livreurs ne sont pas captifs, et vos conditions sont comparées."
            )
          ),

          h2("capacite", "3. Ce que vous pouvez tenir à la fois"),
          p(txt("La capacité est contrôlée à deux niveaux, et ils se comportent différemment à dessein.")),
          ul(
            [strong("Le plafond de l'agence est souple."), txt(" Le dépasser déclenche une alerte plutôt qu'un blocage — une agence qui fait une bonne semaine ne doit pas être arrêtée en milieu de semaine.")],
            [strong("Le plafond du livreur est strict."), txt(" Un livreur déjà à sa limite ne peut pas recevoir une course de plus : l'affectation est refusée.")]
          ),
          p(
            txt(
              "C'est le plafond strict qui protège votre réputation. Un livreur qui garde discrètement neuf colis qu'il ne livrera pas aujourd'hui produit neuf retards et neuf vendeurs qui ne reviennent pas. Refuser le dixième, c'est le système qui vous rend service."
            )
          ),

          h2("economie", "4. L'économie, énoncée simplement"),
          p(
            txt(
              "Les frais de livraison sont à vous. La plateforme n'en prend aucune part. Ce qui en sort, c'est la part contractuelle du livreur, et le reste est la marge de l'agence — vos coûts unitaires sont donc une affaire entre vous et vos livreurs, sans personne d'autre dans le calcul."
            )
          ),

          h2("inscription", "Ce que demande l'inscription"),
          p(
            txt(
              "Davantage qu'à un vendeur, et c'est légitime : on vous confie la marchandise d'autrui. L'ensemble obligatoire comprend vos zones de couverture, une adresse de siège, des coordonnées de versement et vos conditions."
            )
          ),
          p(
            txt(
              "Ces conditions comptent plus qu'elles n'en ont l'air. C'est ce que lit un vendeur au moment de décider s'il vous confie ses commandes, et une formulation vague se lit comme une question sans réponse sur qui paie quand un colis est abîmé."
            )
          ),
          faq(
            {
              question: "Faut-il posséder ses propres motos pour lancer une agence ?",
              answer:
                "Non. Les livreurs s'inscrivent indépendamment et contractent avec des agences ; une agence est une activité de dispatch. Ce qu'il vous faut, c'est une couverture que vous pouvez desservir et des conditions que les livreurs accepteront.",
            },
            {
              question: "Un livreur peut-il travailler pour plusieurs agences ?",
              answer:
                "Oui. Les livreurs détiennent des contrats d'agence et peuvent en avoir plusieurs simultanément, ce qui signifie que la part que vous proposez est comparée à celle des autres.",
            },
            {
              question: "Que se passe-t-il si mon agence dépasse son plafond d'expéditions ?",
              answer:
                "Le plafond de l'agence est souple : le dépasser déclenche une alerte plutôt qu'un blocage. Le plafond par livreur, lui, est strict — un livreur à pleine capacité ne peut pas recevoir d'expédition supplémentaire.",
            }
          ),
          cta(
            "Enregistrez votre agence",
            "Zones de couverture, adresse de siège, coordonnées de versement et vos conditions. C'est l'ensemble obligatoire.",
            "/register?role=agency",
            "Enregistrer votre agence"
          ),
        ],
      },
    ],
  },

  /* ═══ 4. Product descriptions ═══════════════════════════════════════════ */
  {
    id: "write-product-descriptions",
    categoryKey: "guides",
    authorId: "wimall-product",
    publishedAt: "2026-05-28T08:00:00.000Z",
    translations: [
      {
        locale: "en",
        slug: "write-product-descriptions-ai-can-sell-from",
        title: "Write product descriptions an AI can actually sell from",
        metaTitle: "Writing Product Descriptions for WhatsApp AI Selling",
        excerpt:
          "An assistant answering on your behalf can only say what your catalog knows. Most descriptions are labels, and a label cannot answer the question a customer is about to ask.",
        body: [
          p(
            txt(
              "When something answers customer questions on your behalf, the ceiling on how well it sells is the quality of what you told it. This is not a prompt problem. It is a catalog problem, and it is fixable in an afternoon."
            )
          ),
          p(
            txt(
              "Look at a description you have already written. Most read like this: "
            ),
            { type: "text", text: "\"Blender 1.5L, 350W, white.\"", code: true },
            txt(
              " That is an inventory label. It is accurate, it is useless, and it cannot answer a single one of the questions a customer actually sends."
            )
          ),

          h2("questions", "Write down the questions first"),
          p(
            txt(
              "Before rewriting anything, open your WhatsApp and read the last thirty messages customers sent you about products. You will find the same five or six questions, in almost the same words, over and over."
            )
          ),
          p(txt("For most physical goods they are some version of:")),
          ul(
            [txt("Is it original, or a copy?")],
            [txt("What is in the box?")],
            [txt("Does it work with what I already own?")],
            [txt("What happens if it breaks?")],
            [txt("How long until I get it?")]
          ),
          p(
            txt(
              "Those questions are your description's outline. A description that answers all five ends the conversation at a decision rather than at another question."
            )
          ),

          h2("specifics", "Be specific where it costs you nothing"),
          p(
            txt(
              "Vagueness is expensive and specificity is free. \"Good quality\" is a claim no reader believes and no assistant can use. \"Original, sealed, with the manufacturer's one-year warranty card\" is checkable, it is a reason to buy, and it is something an assistant can repeat truthfully."
            )
          ),
          note(
            "warning",
            "Do not write a claim you cannot honour",
            txt(
              "Anything in the description will be said back to customers, at scale, without you reviewing each time. An overstatement that you would have quietly softened in a live conversation becomes a commitment you have made a hundred times."
            )
          ),

          h2("variants", "Put variants in variants"),
          p(
            txt(
              "A description reading \"available in red, blue and black — 128GB or 256GB\" is a structural mistake, not a wording one. Those are variants with their own prices and their own stock, and encoding them in prose means neither the catalog nor anything reading it knows which combinations exist or what each costs."
            )
          ),
          p(
            txt(
              "The rule is simple: if a customer could choose it, it is a variant. If it is true of everything you sell under that name, it is description."
            )
          ),

          h2("words", "Use the words your customers use"),
          p(
            txt(
              "Not the manufacturer's. Nobody searches for a \"multi-functional food preparation system\" — they search for a blender, and half of them search for it in French. Your catalog should contain the words that appear in your customers' actual messages, because those are the words that get matched."
            )
          ),
          quote(
            "The catalog is not documentation for your products. It is the answer to the message a customer has not sent yet.",
            "WiMall product notes"
          ),

          h2("checklist", "A description that works"),
          ol(
            [strong("One line on what it is,"), txt(" in the words a customer would use.")],
            [strong("Who it suits,"), txt(" and what it is not right for. Naming the wrong fit builds more trust than it costs in sales.")],
            [strong("What is included,"), txt(" listed rather than implied.")],
            [strong("The warranty or return position,"), txt(" stated plainly.")],
            [strong("Everything choosable as a variant,"), txt(" with its own price and stock.")]
          ),
          faq(
            {
              question: "How long should a product description be?",
              answer:
                "Long enough to answer the five questions customers actually ask about that product, and no longer. For most items that is a short paragraph plus a list of what is included.",
            },
            {
              question: "Should I write descriptions in French or English?",
              answer:
                "Write in the language your customers message you in. If that is both, both is worth the effort — the words that appear in your catalog are the words that can be matched to a question.",
            }
          ),
          cta(
            "See what a good catalog looks like in practice",
            "Start with your ten best-selling products and rewrite those first. The rest can wait.",
            "/register?role=vendor",
            "Start selling free"
          ),
        ],
      },
    ],
  },

  /* ═══ 5. Repeat customers ═══════════════════════════════════════════════ */
  {
    id: "first-order-to-repeat-customer",
    categoryKey: "growth",
    authorId: "wimall-editorial",
    publishedAt: "2026-04-30T08:00:00.000Z",
    translations: [
      {
        locale: "en",
        slug: "turning-a-first-whatsapp-order-into-a-repeat-customer",
        title: "Turning a first WhatsApp order into a repeat customer",
        metaTitle: "How to Get Repeat Customers on WhatsApp — Practical Tactics",
        excerpt:
          "The thread does not close when the parcel arrives. That is the advantage chat has over every storefront — and most sellers throw it away by going quiet.",
        body: [
          p(
            txt(
              "A storefront's relationship with a customer ends at the confirmation page. Getting them back means paying for an ad, an email they will not open, or luck. A WhatsApp seller has something structurally better and usually wastes it: an open thread with someone who has already paid them once."
            )
          ),
          p(
            txt(
              "The second sale is cheaper than the first by an enormous margin. Not because of any tactic, but because the two expensive things — finding the person, and convincing them you are real — are already done."
            )
          ),

          h2("delivery-day", "The day of delivery is the whole opportunity"),
          p(
            txt(
              "This is the moment the customer's opinion of you is being formed, and almost every seller is silent through it. They know the parcel left. They do not know where it is."
            )
          ),
          p(
            txt(
              "Keeping them informed during that window costs nothing and does most of the work. A customer who was told when the agent was on the way, and who could see it was happening, has had a good experience even if the parcel is an hour late. One who heard nothing has had a bad one even if it arrived early."
            )
          ),

          h2("after", "Ask afterwards, once, and mean it"),
          p(
            txt(
              "One message after delivery asking whether it arrived in good condition does three things at once: it catches a problem while it is still fixable, it signals that a person is paying attention, and it reopens the thread without selling anything."
            )
          ),
          note(
            "tip",
            "One message, not a sequence",
            txt(
              "The temptation is to follow up three times. Do not. A thread is a personal space in a way an inbox is not, and a seller who becomes noise there gets blocked rather than unsubscribed — which is permanent."
            )
          ),

          h2("timing", "Time the next offer to the product, not the calendar"),
          p(
            txt(
              "Most sellers who do reach out again do it on a schedule that suits them — the first of the month, or whenever business is slow. The better signal is not in your calendar at all. It is in what was bought."
            )
          ),
          h3("timing-consumables", "Things that run out"),
          p(
            txt(
              "A consumable has a reorder cycle you can read straight off the order. Someone buying a month of something will need it again in about a month, and a message that arrives near that point is useful rather than intrusive — it is the reminder they would otherwise have had to be their own."
            )
          ),
          h3("timing-durables", "Things that do not"),
          p(
            txt(
              "A phone will not need replacing for two years, so treating it as a reorder cycle guarantees you are wrong. What that customer might want this week is a case, a charger or a screen protector — the accessory, not the repeat."
            )
          ),
          p(
            txt(
              "Being right about that timing is what separates a useful message from a nuisance, and the information you need to be right is already in the order."
            )
          ),

          h2("record", "Keep the record where the conversation is not"),
          p(
            txt(
              "The one thing chat is genuinely bad at is memory. Scrolling a thread to find what someone ordered in March does not scale, and it is why sellers who run entirely out of WhatsApp start forgetting their best customers precisely as they acquire more of them."
            )
          ),
          p(
            txt(
              "Orders that exist as records rather than as messages solve this without moving the conversation anywhere. The customer still talks to you in the same thread; you just stop relying on it as a filing system."
            )
          ),
          quote(
            "Chat is the best place to have a conversation and the worst place to store one.",
            "WiMall product notes"
          ),
          faq(
            {
              question: "How often should I message past customers?",
              answer:
                "Tie it to the product rather than to a schedule. A consumable has a natural reorder cycle; a durable good does not, and messaging on a fixed interval regardless is how a seller becomes noise in a thread they cannot afford to be blocked from.",
            },
            {
              question: "Is it worth asking for feedback after delivery?",
              answer:
                "One message is worth it. It catches problems while they are still fixable and reopens the thread without selling anything. A sequence of three is not.",
            }
          ),
          cta(
            "Stop using your inbox as a filing cabinet",
            "Orders, customers and catalog in one place — while the conversation stays exactly where it is.",
            "/register?role=vendor",
            "Start selling free"
          ),
        ],
      },
    ],
  },
];
