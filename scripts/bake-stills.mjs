// Bakes the printed journal's plates of the world (docs/STORY.md "Lovely details": reduced motion, the static tier and
// no JavaScript show the figures as still plates) from the show itself: fig. 8 (Earth at night over the Middle East,
// the cities lit and wired from Riyadh) and fig. 9 (the aurora over it), each a frame of the real render with the
// page's chrome, copy and ink hidden, written as WebP into public/stills/ (globals.css .still-theirs, .still-storm).
// The plates' printed ink (src/content/ink.ts PRINT) is drawn over them: the script prints where Riyadh and the aurora
// sit in plate units (1600 x 1000), for the marks that point at them.
//
// Needs the site running (bun run dev -p <port>) and the installed Chrome (as scripts/shots.mjs).
// usage: node scripts/bake-stills.mjs --url http://localhost:4317 [--out public/stills]
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1]]);
    return acc;
  }, []),
);
const url = args.url ?? "http://localhost:4317";
const out = args.out ?? "public/stills";
mkdirSync(out, { recursive: true });

/** The plate's units (src/components/stills.tsx) and the size each still is written at. */
const PW = 1600;
const PH = 1000;
const OW = 1280;
const OH = 800;
/** The page the frames are taken from (CSS px) and its pixel ratio (rendered large, written smaller: no aliasing). */
const VW = 1440;
const VH = 900;
const DPR = 2;

/**
 * The plates: the story time, the part of the frame (CSS px, 16:10) and the anchors to report. Fig. 8 frames the world
 * above where the copy sits on screen, so its plate is the world's own square of the frame, centred; fig. 9's aurora
 * shot is the whole frame.
 */
const PLATES = [
  { id: "theirs", T: 7.97, clip: { x: 211, y: 69, width: 960, height: 600 }, marks: ["hub"] },
  { id: "storm", T: 8.88, clip: { x: 0, y: 0, width: VW, height: VH }, marks: ["hub", "poleN"] },
];

/** Everything over the canvas goes: the chrome, the copy, the ink (the plate prints its own), the cursor. */
const HIDE = "body > *:not(.gl-canvas) { opacity: 0 !important; }";

const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: [
    "--use-angle=metal",
    "--enable-gpu",
    "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader=false",
  ],
});
const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: DPR });
await page.goto(`${url}${url.includes("?") ? "&" : "?"}bang=1&q=high`, {
  waitUntil: "networkidle",
});
await page.waitForFunction(() => document.documentElement.classList.contains("gl-ready"), null, {
  timeout: 60000,
});
await page.addStyleTag({ content: HIDE });
await page.waitForTimeout(2500);

for (const p of PLATES) {
  await page.evaluate((T) => window.__story.jump(T), p.T);
  await page.waitForTimeout(2500);
  const png = await page.screenshot({ clip: p.clip });
  const webp = await page.evaluate(
    async ({ b64, w, h }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const g = c.getContext("2d");
      g.imageSmoothingEnabled = true;
      g.imageSmoothingQuality = "high";
      g.drawImage(img, 0, 0, w, h);
      return c.toDataURL("image/webp", 0.82);
    },
    { b64: png.toString("base64"), w: OW, h: OH },
  );
  const file = join(out, `${p.id}.webp`);
  writeFileSync(file, Buffer.from(webp.split(",")[1], "base64"));
  const at = await page.evaluate((ids) => {
    const m = window.__nuqta?.anchors;
    return ids.map((id) => {
      const a = m?.get(id);
      return a?.live ? [id, a.sx, a.sy] : [id, null, null];
    });
  }, p.marks);
  const plate = at.map(([id, x, y]) =>
    x === null
      ? `${id}: not in view`
      : `${id} at ${Math.round(((x - p.clip.x) / p.clip.width) * PW)}, ${Math.round(((y - p.clip.y) / p.clip.height) * PH)}`,
  );
  console.log(`${file} (T ${p.T}): ${plate.join("; ")}`);
}
await browser.close();
