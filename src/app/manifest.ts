import type { MetadataRoute } from "next";
import { seo, site } from "@/content/site";

export const dynamic = "force-static";

/** The web app manifest: the night sky's ink, and the point of light (app/icon.svg) as the icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: seo.shortName,
    description: seo.description,
    start_url: "/",
    scope: "/",
    display: "browser",
    background_color: "#06070B",
    theme_color: "#06070B",
    lang: "en",
    dir: "ltr",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
