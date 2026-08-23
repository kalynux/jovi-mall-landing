/**
 * The primary navigation tree, in one place.
 *
 * Before this file the header's links were declared inline inside `Navbar.tsx`,
 * and two other declarations existed that nothing rendered — `NAV_LINKS` in
 * `lib/constants.ts` (untranslated English anchors) and `NAV_MARKETING_ROUTES`
 * in `lib/marketing/routes.ts`, whose `nav` flags had already drifted out of
 * agreement with what the header actually showed. Both are gone; this is the
 * only thing that describes the menu.
 *
 * Every entry carries a *key*, never a label. Labels resolve through
 * `useTranslations("navbar")` at render time, so a menu item cannot ship in one
 * language — a missing key fails loudly in all five instead.
 *
 * Paths are written locale-agnostic (`/vendors`, not `/fr/vendors`). The `Link`
 * from `@/i18n/navigation` adds the prefix; see `i18n/routing.ts`.
 */

export type MenuItem = {
  /** Key under the `navbar` namespace. */
  key: string;
  /** Locale-agnostic path. */
  href: string;
};

export type MenuNode =
  | ({ kind: "link" } & MenuItem)
  | {
      kind: "menu";
      /** Key under the `navbar` namespace, used as the trigger label. */
      key: string;
      items: MenuItem[];
      /**
       * Draws a hairline after the item with this key. Used once, to keep
       * "Company" honest: About/Careers/Contact are about us, FAQ and Cameroon
       * are not — they just need a home in the header rather than being
       * reachable only from the footer.
       */
      dividerAfter?: string;
    };

/**
 * The four role pages sit under one trigger rather than taking four top-level
 * slots. That is what frees the room for Blog, which was previously reachable
 * only by scrolling to the footer of whatever page you happened to be on.
 */
export const MAIN_MENU: MenuNode[] = [
  { kind: "link", key: "shop", href: "/shop" },
  {
    kind: "menu",
    key: "solutions",
    items: [
      { key: "vendors", href: "/vendors" },
      { key: "agencies", href: "/agencies" },
      { key: "agents", href: "/agents" },
      { key: "customers", href: "/customers" },
    ],
  },
  { kind: "link", key: "pricing", href: "/pricing" },
  // Deliberately top-level and not tucked into a dropdown: articles only earn
  // their traffic if a reader can reach them without hunting, and one click is
  // the difference between a blog that is read and one that is not.
  { kind: "link", key: "blog", href: "/blog" },
  {
    kind: "menu",
    key: "company",
    items: [
      { key: "about", href: "/about" },
      { key: "careers", href: "/careers" },
      { key: "contact", href: "/contact" },
      { key: "faq", href: "/faq" },
      { key: "cameroon", href: "/cameroon" },
    ],
    dividerAfter: "contact",
  },
];

/** Every href the menu can reach, flattened — used for active-state matching. */
export function menuHrefs(node: MenuNode): string[] {
  return node.kind === "link" ? [node.href] : node.items.map((item) => item.href);
}

/**
 * True when `pathname` is inside this node.
 *
 * A `menu` node has no href of its own, so it highlights when any of its
 * children match. `pathname` here is the locale-stripped one that
 * `usePathname()` from `@/i18n/navigation` returns.
 */
export function isNodeActive(node: MenuNode, pathname: string): boolean {
  return menuHrefs(node).some(
    (href) => pathname === href || pathname.startsWith(`${href}/`)
  );
}
