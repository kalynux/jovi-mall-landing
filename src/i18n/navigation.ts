import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * Locale-aware replacements for the `next/link` and `next/navigation` exports.
 * A `<Link href="/shop">` rendered under /fr resolves to /fr/shop, so in-app
 * navigation keeps the visitor's language without a middleware redirect.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
