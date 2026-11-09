import { llmsFullTxt } from "@/content/llms";

// Prerendered to out/llms-full.txt by the static export: every fact on the site and the CV, in markdown.
export const dynamic = "force-static";

export function GET() {
  return new Response(llmsFullTxt(), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
