/**
 * The geography the marketing pages are allowed to claim.
 *
 * Mirrored from the backend's `src/core/constants/locations.json`, which today
 * contains exactly one country — Cameroon (`cm`) — with ten regions and the
 * cities inside each. That file is what validates an agency's `coverage_areas`,
 * so it is the only honest answer to "where does Wi-Mall operate".
 *
 * Region *keys* are the backend's (`far_north`, `northwest`, …) so a link from a
 * marketing page to a coverage filter can pass them straight through. Region
 * *names* are localized in the message catalog (`pages.regions.<key>`) because
 * "Nord-Ouest" and "Northwest" are the same region; city names are not, because
 * "Douala" is "Douala" in all five languages.
 */

export const COUNTRY_CODE = "cm";

/**
 * Every region of Cameroon, with its capital and the towns inside it — the
 * order and spelling locations.json uses.
 *
 * `towns` matters beyond decoration: coverage is registered per region, so an
 * agency that covers Littoral reaches Edéa and Nkongsamba as surely as it
 * reaches Douala. Naming them on a city page is a true statement about reach,
 * not filler.
 */
export const REGIONS = [
  { key: "adamaoua", capital: "Ngaoundéré", towns: ["Banyo", "Meiganga", "Tibati", "Tignère"] },
  {
    key: "centre",
    capital: "Yaoundé",
    towns: ["Bafia", "Mbalmayo", "Obala", "Eseka", "Nanga Eboko", "Akonolinga", "Mfou"],
  },
  { key: "east", capital: "Bertoua", towns: ["Batouri", "Abong-Mbang", "Yokadouma", "Lomié"] },
  { key: "far_north", capital: "Maroua", towns: ["Kousséri", "Mokolo", "Mora", "Yagoua", "Kaélé"] },
  {
    key: "littoral",
    capital: "Douala",
    towns: ["Edéa", "Nkongsamba", "Mbanga", "Loum", "Penja", "Yabassi"],
  },
  { key: "north", capital: "Garoua", towns: ["Guider", "Figuil", "Poli", "Tcholliré"] },
  {
    key: "northwest",
    capital: "Bamenda",
    towns: ["Kumbo", "Ndop", "Bali", "Wum", "Fundong", "Mbengwi"],
  },
  { key: "south", capital: "Ebolowa", towns: ["Kribi", "Sangmélima", "Ambam"] },
  { key: "southwest", capital: "Buea", towns: ["Limbe", "Kumba", "Tiko", "Mutengene", "Mamfe"] },
  {
    key: "west",
    capital: "Bafoussam",
    towns: ["Dschang", "Foumban", "Mbouda", "Bafang", "Bangangté", "Bandjoun", "Foumbot"],
  },
] as const;

export type RegionKey = (typeof REGIONS)[number]["key"];

export function findRegion(key: RegionKey) {
  return REGIONS.find((region) => region.key === key)!;
}

/**
 * The cities that get their own page.
 *
 * Deliberately a short, hand-picked list rather than all 66 cities in the
 * dataset. A page per city is only worth publishing where there is something
 * true and specific to say about commerce there — the copy in
 * `pages.cities.<slug>` names real markets and districts. Generating the other
 * 61 from a template would be a doorway-page set, which is a spam-policy
 * problem, not an SEO win.
 *
 * `sortOrder` is the display order on /cameroon; the slug is the URL segment.
 */
export const CITIES = [
  { slug: "douala", name: "Douala", region: "littoral" },
  { slug: "yaounde", name: "Yaoundé", region: "centre" },
  { slug: "bafoussam", name: "Bafoussam", region: "west" },
  { slug: "bamenda", name: "Bamenda", region: "northwest" },
  { slug: "garoua", name: "Garoua", region: "north" },
] as const satisfies readonly { slug: string; name: string; region: RegionKey }[];

export type City = (typeof CITIES)[number];
export type CitySlug = City["slug"];

export function findCity(slug: string): City | undefined {
  return CITIES.find((city) => city.slug === slug);
}

/** Path for one city page — the single place that knows the URL shape. */
export function cityPath(slug: string): string {
  return `/cameroon/${slug}`;
}
