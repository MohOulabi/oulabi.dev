import type { MetadataRoute } from "next";
import { abs } from "@/content/seo";
import { cv, seo } from "@/content/site";

export const dynamic = "force-static";

/**
 * One page (the show, then the record) and the CV it links to. lastModified is when the facts last changed
 * (seo.updated, set by hand), not the build: a date that moves on every deploy tells a search engine nothing.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: abs("/"), lastModified: seo.updated, changeFrequency: "monthly", priority: 1 },
    { url: abs(cv.pdf), lastModified: seo.updated, changeFrequency: "monthly", priority: 0.8 },
  ];
}
