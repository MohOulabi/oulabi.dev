// Build public/data/bsc5.json from the Yale Bright Star Catalogue (data-src/bsc5.dat, byte format in
// data-src/bsc5.readme). Run from the repo root: node scripts/bake-bsc5.mjs
// Output: a flat array [raDeg, decDeg, vmag, bv, ...] (J2000), brightest first. Entries without
// coordinates (the 14 non-stellar HR numbers) are skipped; a missing B-V becomes 0.6 (a G star).
import { readFileSync, writeFileSync } from "node:fs";

const lines = readFileSync("data-src/bsc5.dat", "latin1").split("\n");
const num = (s) => {
  const t = s.trim();
  return t === "" ? null : Number(t);
};
const rows = [];
for (const L of lines) {
  if (L.length < 107) continue;
  const rah = num(L.slice(75, 77));
  const ram = num(L.slice(77, 79));
  const ras = num(L.slice(79, 83));
  const sign = L[83];
  const ded = num(L.slice(84, 86));
  const dem = num(L.slice(86, 88));
  const des = num(L.slice(88, 90));
  const v = num(L.slice(102, 107));
  const bv = num(L.slice(109, 114));
  if (rah === null || ded === null || v === null) continue;
  const ra = (rah + ram / 60 + ras / 3600) * 15;
  const dec = (sign === "-" ? -1 : 1) * (ded + dem / 60 + des / 3600);
  rows.push([ra, dec, v, bv ?? 0.6]);
}
rows.sort((a, b) => a[2] - b[2]);
const flat = [];
for (const r of rows)
  flat.push(+r[0].toFixed(2), +r[1].toFixed(2), +r[2].toFixed(2), +r[3].toFixed(2));
const out = {
  source:
    "Yale Bright Star Catalogue, 5th Revised Ed. (Hoffleit & Warren 1991), NASA ADC / CDS V/50. Public domain. Every star with coordinates, brightest first.",
  fields: ["raDegJ2000", "decDegJ2000", "vmag", "bv"],
  count: rows.length,
  stars: flat,
};
writeFileSync("public/data/bsc5.json", JSON.stringify(out));
console.log("stars", rows.length);
