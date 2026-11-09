import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata, Viewport } from "next";
import { Alexandria, Archivo, IBM_Plex_Mono, Newsreader } from "next/font/google";
import { abs } from "@/content/seo";
import { seo, site } from "@/content/site";
import "./globals.css";

const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

/** The figures' lines, the signature and the record's headlines. */
const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["italic"],
  axes: ["opsz"],
  variable: "--font-serif",
  display: "swap",
});

/** The ink journal's notes, the figure numbers and the spine (small, lowercase, letter-spaced). */
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["300", "400"],
  variable: "--font-mono",
  display: "swap",
});

const alexandria = Alexandria({
  subsets: ["arabic"],
  variable: "--font-alexandria",
  display: "swap",
  // the Arabic name is on the first screen
  preload: true,
});

/**
 * What every page shares (src/content/site.ts, seo). The home page's own head (canonical, robots, Open Graph, the
 * social card, the markdown alternates, the JSON-LD) is in page.tsx, so the 404 page never claims to be the profile.
 */
export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: seo.title, template: `%s · ${site.name}` },
  description: seo.description,
  applicationName: site.name,
  authors: [{ name: site.name, url: abs("/") }],
  creator: site.name,
  publisher: site.name,
  // the home-screen name on iOS (the manifest's short_name); only the title, the page stays a page in the browser
  other: { "apple-mobile-web-app-title": seo.shortName },
  formatDetection: { telephone: false, address: false },
};

export const viewport: Viewport = {
  themeColor: "#06070B",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${archivo.variable} ${newsreader.variable} ${plexMono.variable} ${alexandria.variable}`}
      suppressHydrationWarning
    >
      <body>
        <script
          // Runs before paint: lets CSS switch to the staged layout without a flash.
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static inline boot script
          dangerouslySetInnerHTML={{
            __html:
              "document.documentElement.classList.add('js');try{if(/[?&]q=static/.test(location.search))document.documentElement.classList.add('no-stage')}catch(e){}",
          }}
        />
        {children}
        {/* Vercel Web Analytics and Speed Insights (the project's dashboard collects them) */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
