import { llmsTxt } from "@/content/llms";

// Prerendered to out/llms.txt by the static export (llmstxt.org: who he is, for AI search and assistants).
export const dynamic = "force-static";

export function GET() {
  return new Response(llmsTxt(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
