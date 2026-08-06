import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/constants";

/**
 * Install manifest. The icons here are the opaque tiles rather than the
 * transparent mark — an installed launcher draws its own plate behind the icon,
 * and a transparent one would sit on whatever the OS theme happens to be.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} — Commerce Runs on Conversation`,
    short_name: BRAND.name,
    description: BRAND.description,
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",
    theme_color: "#068554",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops this to whatever shape the launcher uses, so it is the
      // full-bleed variant with the bag inside the centre safe zone.
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
