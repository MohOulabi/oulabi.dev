// Visual QA: screenshots of the staged site at chosen story times.
// usage: node scripts/shots.mjs --url http://localhost:4317 --t 0,0.5,1,2,3,3.5,4,12,13,13.5,14 \
//          --size 1440x900 --q high --out shots
// Uses the installed Google Chrome (no browser download). Story time is set with window.__story.jump(T).
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1]]);
    return acc;
  }, []),
);
const url = args.url ?? "http://localhost:4317";
const times = (args.t ?? "0,1,2,3,4,12,13,14").split(",").map(Number);
const [w, h] = (args.size ?? "1440x900").split("x").map(Number);
const out = args.out ?? "shots";
const q = args.q ?? "high";
const settle = Number(args.settle ?? 700);
const reduce = args.reduce === "1";
mkdirSync(out, { recursive: true });

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
const page = await browser.newPage({
  viewport: { width: w, height: h },
  deviceScaleFactor: Number(args.dpr ?? 1),
  reducedMotion: reduce ? "reduce" : "no-preference",
});
const logs = [];
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") logs.push(`[${m.type()}] ${m.text()}`);
});
page.on("pageerror", (e) => logs.push(`[pageerror] ${e.message}`));

await page.goto(`${url}${url.includes("?") ? "&" : "?"}q=${q}`, { waitUntil: "networkidle" });
await page.waitForFunction(
  () =>
    document.documentElement.classList.contains("gl-ready") ||
    document.documentElement.classList.contains("flow"),
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(800);

for (const t of times) {
  await page.evaluate((T) => window.__story?.jump(T), t);
  await page.waitForTimeout(settle);
  const file = join(out, `t${String(t).replace(".", "_")}-${w}x${h}.png`);
  await page.screenshot({ path: file });
  console.log(file);
}
const perf = await page.evaluate(() => window.__story?.stats?.() ?? null);
if (perf) console.log("stats", JSON.stringify(perf));
if (logs.length) console.log(logs.slice(0, 30).join("\n"));
await browser.close();
