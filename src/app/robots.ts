import type { MetadataRoute } from "next";
import { abs } from "@/content/seo";

export const dynamic = "force-static";

/**
 * The site wants to be found, in search and in AI answers: every crawler may read every page, and the search and AI
 * crawlers are named so that no default of theirs, or of a host, reads silence as a no.
 */
const NAMED = [
  "Googlebot",
  "Bingbot",
  "Applebot",
  "DuckDuckBot",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
  "meta-externalagent",
  "Amazonbot",
  "DuckAssistBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      { userAgent: NAMED, allow: "/" },
    ],
    sitemap: abs("/sitemap.xml"),
  };
}
