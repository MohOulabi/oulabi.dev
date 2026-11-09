// Bakes the world's map (docs/STORY.md fig. 8: Earth over the Middle East at night) into public/data/earth.png, once,
// in Node (no browser): an equirectangular 2048 x 1024 RGB texture, north up, longitude -180 at the left edge.
//
//   R  the land, as a signed distance to the nearest coast: 0.5 + 0.5 tanh(d / D_KM), d in km, positive on land.
//      The coast is R = 0.5 at any magnification (crisp under bilinear filtering), and the tanh's long tail is the
//      soft band either side of it that the planet's shader lights a little (src/gl/world/shaders.ts).
//   G  where people live: towns along the region's real populated corridors (the Nile, the Levant's coast, the
//      Tigris and Euphrates, the Gulf's shore, the Hejaz and the Asir, the Iranian plateau...) and round each city
//      in src/gl/world/places.ts, the region's and the far ones beyond it. The cube bake scatters faint towns by it,
//      on land only.
//   B  unused (0).
//
// Data: Natural Earth 1:50m land (public domain), from the world-atlas package (ISC), decoded with topojson-client.
// The site itself has no runtime dependency on either: only the PNG ships.
//
// It also writes src/gl/world/inland.ts: how far each city of places.ts stands from the sea (km, from the same field),
// so what gathers round a city (the flock that waits round its lights, glsl/finale.ts) never spreads onto the water.
// Every city, the far ones too, must stand on land, clear of the coast: the run fails (exit 1) if one does not.
//
// usage: node scripts/bake-earth.mjs [--out public/data/earth.png] [--inland src/gl/world/inland.ts]
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { crc32, deflateSync } from "node:zlib";
import { feature } from "topojson-client";
import { FAR_PLACES, PLACES } from "../src/gl/world/places.ts";

/** Every city the world lights: the region's, then the far ones beyond it. */
const ALL = [...PLACES, ...FAR_PLACES];

const require = createRequire(import.meta.url);
const args = Object.fromEntries(
  process.argv.slice(2).reduce((acc, a, i, all) => {
    if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1]]);
    return acc;
  }, []),
);
const OUT = args.out ?? "public/data/earth.png";
const INLAND = args.inland ?? "src/gl/world/inland.ts";

/** Output size, and the supersampling of the land raster (the distance field is computed at W*SS x H*SS). */
const W = 2048;
const H = 1024;
const SS = 2;
/** The distance field's scale (km): the coast's slope in R, and how far its soft band reaches. */
const D_KM = 150;
const EARTH_KM = 6371;

// ---------------------------------------------------------------------------------------------------------------
// 1. the land, rasterized (even-odd) at W*SS x H*SS

const topo = JSON.parse(readFileSync(require.resolve("world-atlas/land-50m.json"), "utf8"));
const land = feature(topo, topo.objects.land);
const SW = W * SS;
const SH = H * SS;
const mask = new Uint8Array(SW * SH);
const rows = Array.from({ length: SH }, () => []);
let edges = 0;
const rings = [];
for (const f of land.features ?? [land]) {
  const g = f.geometry;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  for (const poly of polys) for (const ring of poly) rings.push(ring);
}
/**
 * A ring in spherical coordinates, made a closed ring of the plane: longitudes unwrapped where it crosses the
 * antimeridian (Eurasia, Wrangel), and a ring round a pole (Antarctica) closed along that pole; with the copies one
 * turn either side wherever it runs off the map, so the even-odd fill wraps round the globe.
 */
function planar(ring) {
  const pts = [[ring[0][0], ring[0][1]]];
  let off = 0;
  for (let i = 1; i < ring.length; i++) {
    const dl = ring[i][0] - ring[i - 1][0];
    if (dl > 180) off -= 360;
    else if (dl < -180) off += 360;
    pts.push([ring[i][0] + off, ring[i][1]]);
  }
  if (off !== 0) {
    let lat = 0;
    for (const p of pts) lat += p[1];
    lat /= pts.length;
    // a ring that is the pole itself is no area of the plane
    if (Math.abs(lat) > 89.99) return [];
    const pole = lat < 0 ? -90 : 90;
    pts.push([pts[pts.length - 1][0], pole], [pts[0][0], pole], [pts[0][0], pts[0][1]]);
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of pts) {
    lo = Math.min(lo, p[0]);
    hi = Math.max(hi, p[0]);
  }
  const out = [pts];
  if (lo < -180) out.push(pts.map(([l, p]) => [l + 360, p]));
  if (hi > 180) out.push(pts.map(([l, p]) => [l - 360, p]));
  return out;
}
const flat = rings.flatMap(planar);
for (const ring of flat) {
  for (let i = 0; i < ring.length - 1; i++) {
    const [l1, p1] = ring[i];
    const [l2, p2] = ring[i + 1];
    const x1 = ((l1 + 180) / 360) * SW;
    const y1 = ((90 - p1) / 180) * SH;
    const x2 = ((l2 + 180) / 360) * SW;
    const y2 = ((90 - p2) / 180) * SH;
    if (y1 === y2) continue;
    const ya = Math.min(y1, y2);
    const yb = Math.max(y1, y2);
    for (let y = Math.max(0, Math.ceil(ya - 0.5)); y < SH && y + 0.5 < yb; y++) {
      const yc = y + 0.5;
      if (yc < ya) continue;
      rows[y].push(x1 + ((yc - y1) / (y2 - y1)) * (x2 - x1));
    }
    edges++;
  }
}
for (let y = 0; y < SH; y++) {
  const xs = rows[y].sort((a, b) => a - b);
  for (let k = 0; k + 1 < xs.length; k += 2) {
    const a = Math.max(0, Math.ceil(xs[k] - 0.5));
    const b = Math.min(SW - 1, Math.floor(xs[k + 1] - 0.5));
    for (let x = a; x <= b; x++) mask[y * SW + x] ^= 1;
  }
}
console.log(`land: ${rings.length} rings, ${edges} edges`);

// ---------------------------------------------------------------------------------------------------------------
// 2. the signed distance to the coast (km): a separable exact EDT (Felzenszwalb) on the grid, rows wrapping round
//    the globe, each row's pixels as wide as they really are at its latitude

const INF = 1e20;
const kyKm = (Math.PI * EARTH_KM) / SH;
const kxKm = (y) =>
  Math.cos(((90 - ((y + 0.5) / SH) * 180) * Math.PI) / 180) * ((2 * Math.PI * EARTH_KM) / SW);

/** Squared distance (km^2) from every pixel to the nearest pixel whose mask equals `want`. */
function edt(want) {
  const f = new Float64Array(SW * SH);
  // rows: the nearest feature along the row (wrapping), in pixels, then in km at that latitude
  const g = new Float64Array(SW);
  for (let y = 0; y < SH; y++) {
    const o = y * SW;
    let any = false;
    for (let x = 0; x < SW; x++) if (mask[o + x] === want) any = true;
    if (!any) {
      for (let x = 0; x < SW; x++) f[o + x] = INF;
      continue;
    }
    let last = -INF;
    for (let pass = 0; pass < 2; pass++)
      for (let x = 0; x < SW; x++) {
        if (mask[o + x] === want) last = x + pass * SW;
        if (pass === 1) g[x] = x + SW - last;
      }
    last = INF;
    for (let pass = 0; pass < 2; pass++)
      for (let x = SW - 1; x >= 0; x--) {
        if (mask[o + x] === want) last = x - pass * SW;
        if (pass === 1) g[x] = Math.min(g[x], last - (x - SW));
      }
    const kx = kxKm(y);
    for (let x = 0; x < SW; x++) {
      const d = g[x] * kx;
      f[o + x] = d * d;
    }
  }
  // columns: the lower envelope of parabolas over the rows' results
  const out = new Float64Array(SW * SH);
  const col = new Float64Array(SH);
  const v = new Int32Array(SH);
  const z = new Float64Array(SH + 1);
  for (let x = 0; x < SW; x++) {
    for (let y = 0; y < SH; y++) col[y] = f[y * SW + x];
    let k = 0;
    v[0] = 0;
    z[0] = -Infinity;
    z[1] = Infinity;
    const sAt = (q, p) =>
      (col[q] + (q * kyKm) ** 2 - (col[p] + (p * kyKm) ** 2)) / (2 * kyKm * (q - p));
    for (let q = 1; q < SH; q++) {
      let s = sAt(q, v[k]);
      while (s <= z[k]) {
        k--;
        s = sAt(q, v[k]);
      }
      k++;
      v[k] = q;
      z[k] = s;
      z[k + 1] = Infinity;
    }
    k = 0;
    for (let q = 0; q < SH; q++) {
      while (z[k + 1] < q * kyKm) k++;
      out[q * SW + x] = (kyKm * (q - v[k])) ** 2 + col[v[k]];
    }
  }
  return out;
}

const toLand = edt(1);
const toSea = edt(0);
const sd = new Float32Array(W * H);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++) {
    let s = 0;
    for (let j = 0; j < SS; j++)
      for (let i = 0; i < SS; i++) {
        const sy = y * SS + j;
        const n = sy * SW + x * SS + i;
        // half a pixel: the coast runs between a land pixel and a sea pixel
        const half = 0.5 * Math.min(kyKm, kxKm(sy) + 1e-3);
        s += mask[n] ? Math.sqrt(toSea[n]) - half : -(Math.sqrt(toLand[n]) - half);
      }
    sd[y * W + x] = s / (SS * SS);
  }

// ---------------------------------------------------------------------------------------------------------------
// 3. where people live: real populated corridors (lat, lon polylines; width in km; how lit, 0..1), and a halo
//    round every city of places.ts. Coordinates are real towns along each corridor.

/** @type {{ w: number; km: number; p: [number, number][] }[]} */
const CORRIDORS = [
  // the kingdom: riyadh and al-kharj; the highway to the gulf; the eastern province; qassim and hail
  {
    w: 0.55,
    km: 28,
    p: [
      [24.95, 46.55],
      [24.71, 46.68],
      [24.45, 46.95],
      [24.15, 47.31],
    ],
  },
  {
    w: 0.18,
    km: 22,
    p: [
      [24.71, 46.68],
      [25.05, 47.9],
      [25.6, 49.0],
      [26.0, 49.6],
      [26.39, 50.0],
    ],
  },
  {
    w: 0.6,
    km: 24,
    p: [
      [27.0, 49.65],
      [26.75, 49.9],
      [26.43, 50.08],
      [26.28, 50.2],
      [26.1, 50.1],
    ],
  },
  {
    w: 0.35,
    km: 22,
    p: [
      [25.2, 49.5],
      [25.38, 49.59],
      [25.55, 49.62],
    ],
  },
  {
    w: 0.25,
    km: 22,
    p: [
      [24.71, 46.68],
      [25.4, 45.6],
      [26.0, 44.7],
      [26.36, 43.98],
      [26.08, 43.99],
    ],
  },
  {
    w: 0.14,
    km: 18,
    p: [
      [26.36, 43.98],
      [27.0, 42.9],
      [27.51, 41.72],
    ],
  },
  // the hejaz: mecca and jeddah, the red sea coast from jazan to yanbu, jeddah to medina, medina to tabuk, neom
  {
    w: 0.18,
    km: 20,
    p: [
      [24.71, 46.68],
      [23.6, 45.0],
      [22.5, 42.6],
      [21.27, 40.42],
    ],
  },
  {
    w: 0.7,
    km: 22,
    p: [
      [21.27, 40.42],
      [21.42, 39.83],
      [21.53, 39.22],
      [21.75, 39.12],
    ],
  },
  {
    w: 0.3,
    km: 26,
    p: [
      [16.9, 42.58],
      [17.6, 42.1],
      [18.5, 41.5],
      [19.5, 40.95],
      [20.4, 40.05],
      [21.2, 39.25],
      [22.3, 39.1],
      [23.2, 38.75],
      [24.09, 38.06],
    ],
  },
  {
    w: 0.22,
    km: 20,
    p: [
      [21.75, 39.12],
      [22.8, 39.35],
      [23.7, 39.5],
      [24.47, 39.61],
    ],
  },
  {
    w: 0.1,
    km: 16,
    p: [
      [24.47, 39.61],
      [25.6, 38.6],
      [26.6, 37.9],
      [27.6, 37.2],
      [28.38, 36.56],
      [28.2, 35.8],
      [28.05, 35.4],
    ],
  },
  // the asir: taif, al baha, abha and khamis mushait, najran; jazan up to abha
  {
    w: 0.32,
    km: 24,
    p: [
      [21.27, 40.42],
      [20.6, 41.1],
      [20.01, 41.47],
      [19.2, 42.0],
      [18.22, 42.5],
      [18.3, 42.73],
      [17.9, 43.6],
      [17.49, 44.13],
    ],
  },
  {
    w: 0.2,
    km: 18,
    p: [
      [16.92, 42.6],
      [17.5, 42.6],
      [18.22, 42.5],
    ],
  },
  // the gulf: kuwait, bahrain, qatar, the emirates' coast and al ain, the batinah coast to muscat, salalah
  {
    w: 0.75,
    km: 22,
    p: [
      [28.95, 48.15],
      [29.2, 48.05],
      [29.35, 47.95],
      [29.37, 47.7],
    ],
  },
  {
    w: 0.7,
    km: 16,
    p: [
      [26.0, 50.55],
      [26.2, 50.56],
      [26.25, 50.62],
    ],
  },
  {
    w: 0.6,
    km: 20,
    p: [
      [25.0, 51.55],
      [25.29, 51.5],
      [25.65, 51.48],
      [25.9, 51.5],
    ],
  },
  {
    w: 0.75,
    km: 22,
    p: [
      [24.43, 54.42],
      [24.75, 54.9],
      [25.0, 55.1],
      [25.17, 55.3],
      [25.35, 55.42],
      [25.5, 55.6],
      [25.79, 55.94],
    ],
  },
  {
    w: 0.25,
    km: 18,
    p: [
      [24.43, 54.42],
      [24.3, 55.2],
      [24.2, 55.75],
    ],
  },
  {
    w: 0.45,
    km: 20,
    p: [
      [24.35, 56.71],
      [24.0, 57.1],
      [23.7, 57.85],
      [23.58, 58.35],
      [23.6, 58.6],
    ],
  },
  {
    w: 0.15,
    km: 18,
    p: [
      [23.58, 58.35],
      [23.2, 57.9],
      [22.93, 57.53],
    ],
  },
  {
    w: 0.3,
    km: 16,
    p: [
      [17.0, 53.95],
      [17.02, 54.09],
      [17.05, 54.3],
    ],
  },
  // yemen: the highlands from saada to aden, hodeidah, mukalla (dim: little power at night)
  {
    w: 0.24,
    km: 22,
    p: [
      [16.94, 43.76],
      [16.2, 43.95],
      [15.37, 44.19],
      [14.54, 44.4],
      [13.97, 44.18],
      [13.58, 44.02],
      [13.1, 44.6],
      [12.83, 45.0],
    ],
  },
  {
    w: 0.12,
    km: 18,
    p: [
      [14.8, 42.95],
      [15.1, 43.6],
      [15.37, 44.19],
    ],
  },
  {
    w: 0.12,
    km: 14,
    p: [
      [14.54, 49.13],
      [14.6, 49.4],
    ],
  },
  // the levant: the coast from gaza to latakia, jerusalem, amman and irbid, the desert road to aqaba
  {
    w: 0.85,
    km: 18,
    p: [
      [31.4, 34.38],
      [31.8, 34.65],
      [32.08, 34.79],
      [32.33, 34.86],
      [32.8, 35.0],
      [33.27, 35.2],
      [33.56, 35.37],
      [33.89, 35.5],
      [34.44, 35.83],
      [34.89, 35.89],
      [35.52, 35.79],
    ],
  },
  {
    w: 0.5,
    km: 16,
    p: [
      [31.77, 35.21],
      [31.9, 35.0],
      [32.08, 34.79],
    ],
  },
  {
    w: 0.55,
    km: 20,
    p: [
      [31.72, 35.79],
      [31.95, 35.93],
      [32.07, 36.09],
      [32.55, 35.85],
    ],
  },
  {
    w: 0.12,
    km: 14,
    p: [
      [31.95, 35.93],
      [31.0, 35.9],
      [30.2, 35.7],
      [29.53, 35.0],
    ],
  },
  // syria: damascus, homs, hama, aleppo; homs to tartus; the euphrates to deir ez-zor
  {
    w: 0.36,
    km: 20,
    p: [
      [33.51, 36.28],
      [34.0, 36.5],
      [34.73, 36.71],
      [35.13, 36.75],
      [35.6, 36.9],
      [36.2, 37.16],
    ],
  },
  {
    w: 0.2,
    km: 16,
    p: [
      [34.73, 36.71],
      [34.85, 36.3],
      [34.89, 35.89],
    ],
  },
  {
    w: 0.12,
    km: 16,
    p: [
      [36.2, 37.16],
      [35.95, 38.99],
      [35.33, 40.14],
    ],
  },
  // turkey: istanbul to izmit and bursa, izmir, ankara, konya, the south coast, gaziantep to sanliurfa, the black sea
  {
    w: 0.85,
    km: 22,
    p: [
      [41.1, 28.6],
      [41.01, 28.98],
      [40.95, 29.3],
      [40.77, 29.92],
      [40.5, 29.4],
      [40.19, 29.06],
    ],
  },
  {
    w: 0.5,
    km: 20,
    p: [
      [38.7, 27.3],
      [38.42, 27.14],
      [38.2, 27.4],
    ],
  },
  {
    w: 0.22,
    km: 18,
    p: [
      [40.77, 29.92],
      [40.73, 31.6],
      [40.1, 32.6],
      [39.93, 32.86],
    ],
  },
  {
    w: 0.45,
    km: 20,
    p: [
      [39.8, 32.6],
      [39.93, 32.86],
      [40.0, 33.1],
    ],
  },
  {
    w: 0.18,
    km: 18,
    p: [
      [39.93, 32.86],
      [38.9, 32.7],
      [37.87, 32.48],
    ],
  },
  {
    w: 0.16,
    km: 18,
    p: [
      [39.93, 32.86],
      [39.3, 34.2],
      [38.73, 35.48],
    ],
  },
  {
    w: 0.32,
    km: 18,
    p: [
      [36.9, 30.7],
      [36.6, 31.9],
      [36.3, 33.4],
      [36.8, 34.63],
      [37.0, 35.32],
      [37.07, 36.25],
      [37.07, 37.38],
      [37.16, 38.79],
    ],
  },
  {
    w: 0.18,
    km: 16,
    p: [
      [41.29, 36.33],
      [41.0, 37.9],
      [41.0, 39.72],
    ],
  },
  // mesopotamia: the tigris (mosul, baghdad, kut, amara, basra), the euphrates (ramadi, hilla, najaf, nasiriyah),
  // kurdistan (erbil, kirkuk, sulaymaniyah)
  {
    w: 0.36,
    km: 24,
    p: [
      [36.34, 43.13],
      [35.4, 43.5],
      [34.6, 43.68],
      [34.2, 43.87],
      [33.32, 44.37],
      [32.5, 45.83],
      [31.84, 47.15],
      [30.95, 47.45],
      [30.51, 47.78],
      [30.35, 47.95],
    ],
  },
  {
    w: 0.3,
    km: 22,
    p: [
      [33.42, 43.3],
      [33.35, 43.78],
      [33.32, 44.37],
      [32.47, 44.42],
      [32.0, 44.33],
      [31.99, 44.93],
      [31.3, 45.6],
      [31.05, 46.26],
      [30.51, 47.78],
    ],
  },
  {
    w: 0.3,
    km: 20,
    p: [
      [36.34, 43.13],
      [36.19, 44.01],
      [35.47, 44.39],
      [35.56, 45.44],
    ],
  },
  // iran: tabriz to tehran, tehran to isfahan and shiraz, the zagros, khuzestan, the caspian coast, east to mashhad
  {
    w: 0.42,
    km: 22,
    p: [
      [38.08, 46.29],
      [37.4, 47.6],
      [36.67, 48.48],
      [36.27, 50.0],
      [35.84, 50.94],
      [35.69, 51.39],
      [35.7, 51.7],
    ],
  },
  {
    w: 0.3,
    km: 22,
    p: [
      [35.69, 51.39],
      [34.64, 50.88],
      [33.98, 51.43],
      [33.0, 51.6],
      [32.65, 51.67],
    ],
  },
  {
    w: 0.2,
    km: 20,
    p: [
      [32.65, 51.67],
      [31.4, 52.2],
      [30.2, 52.5],
      [29.59, 52.58],
    ],
  },
  {
    w: 0.25,
    km: 20,
    p: [
      [34.31, 47.07],
      [34.8, 48.51],
      [35.6, 49.3],
      [36.27, 50.0],
    ],
  },
  {
    w: 0.35,
    km: 22,
    p: [
      [32.4, 48.4],
      [31.32, 48.67],
      [30.34, 48.3],
    ],
  },
  {
    w: 0.32,
    km: 22,
    p: [
      [38.4, 48.87],
      [37.28, 49.58],
      [36.7, 51.4],
      [36.56, 53.06],
      [36.84, 54.43],
    ],
  },
  {
    w: 0.12,
    km: 16,
    p: [
      [35.69, 51.39],
      [35.58, 53.39],
      [36.2, 57.7],
      [36.26, 59.62],
    ],
  },
  {
    w: 0.45,
    km: 20,
    p: [
      [36.2, 59.4],
      [36.26, 59.62],
      [36.35, 59.8],
    ],
  },
  {
    w: 0.14,
    km: 16,
    p: [
      [31.9, 54.36],
      [30.9, 55.9],
      [30.28, 57.08],
    ],
  },
  {
    w: 0.14,
    km: 16,
    p: [
      [29.59, 52.58],
      [28.3, 54.3],
      [27.18, 56.27],
    ],
  },
  // egypt: the delta (alexandria, tanta, mansoura, damietta, port said, the canal to suez), the nile valley to aswan,
  // the red sea coast, sinai
  {
    w: 0.85,
    km: 26,
    p: [
      [31.18, 29.93],
      [30.79, 31.0],
      [30.04, 31.24],
      [29.85, 31.3],
    ],
  },
  {
    w: 0.75,
    km: 24,
    p: [
      [31.42, 31.81],
      [31.04, 31.38],
      [30.55, 31.0],
      [30.04, 31.24],
    ],
  },
  {
    w: 0.5,
    km: 18,
    p: [
      [31.26, 32.3],
      [30.6, 32.27],
      [29.97, 32.53],
    ],
  },
  {
    w: 0.45,
    km: 30,
    p: [
      [30.6, 30.6],
      [30.9, 31.2],
      [31.1, 31.8],
    ],
  },
  {
    w: 0.55,
    km: 12,
    p: [
      [29.85, 31.3],
      [29.07, 31.1],
      [28.1, 30.75],
      [27.18, 31.18],
      [26.56, 31.69],
      [26.16, 32.73],
      [25.69, 32.64],
      [24.95, 32.87],
      [24.09, 32.9],
    ],
  },
  {
    w: 0.2,
    km: 14,
    p: [
      [27.26, 33.81],
      [26.7, 33.94],
    ],
  },
  {
    w: 0.15,
    km: 12,
    p: [
      [27.92, 34.33],
      [28.5, 34.5],
    ],
  },
  // sudan: the nile from wadi halfa to khartoum and wad madani; kassala; port sudan
  {
    w: 0.12,
    km: 14,
    p: [
      [21.8, 31.35],
      [19.17, 30.48],
      [18.2, 31.6],
      [17.7, 33.97],
      [16.7, 33.43],
      [15.6, 32.53],
    ],
  },
  {
    w: 0.45,
    km: 22,
    p: [
      [15.75, 32.5],
      [15.5, 32.56],
      [15.3, 32.6],
      [14.4, 33.52],
      [13.55, 33.62],
    ],
  },
  {
    w: 0.12,
    km: 14,
    p: [
      [15.45, 36.4],
      [15.5, 35.0],
      [15.5, 32.56],
    ],
  },
  {
    w: 0.25,
    km: 14,
    p: [
      [19.4, 37.2],
      [19.6, 37.18],
      [19.8, 37.2],
    ],
  },
  // the horn: asmara, addis ababa to adama and dire dawa, north to mekelle, djibouti, hargeisa, mogadishu
  {
    w: 0.15,
    km: 16,
    p: [
      [15.32, 38.93],
      [15.6, 39.45],
    ],
  },
  {
    w: 0.4,
    km: 22,
    p: [
      [9.2, 38.6],
      [9.03, 38.74],
      [8.75, 38.98],
      [8.54, 39.27],
    ],
  },
  {
    w: 0.1,
    km: 14,
    p: [
      [8.54, 39.27],
      [9.3, 40.6],
      [9.6, 41.86],
      [9.31, 42.12],
    ],
  },
  {
    w: 0.08,
    km: 14,
    p: [
      [9.03, 38.74],
      [11.13, 39.63],
      [13.5, 39.47],
    ],
  },
  {
    w: 0.35,
    km: 12,
    p: [
      [11.52, 43.05],
      [11.57, 43.1],
      [11.6, 43.15],
    ],
  },
  {
    w: 0.12,
    km: 14,
    p: [
      [9.56, 44.06],
      [10.43, 45.01],
    ],
  },
  {
    w: 0.22,
    km: 16,
    p: [
      [2.0, 45.3],
      [2.04, 45.34],
      [2.1, 45.4],
    ],
  },
  // the caucasus and the caspian: tbilisi, yerevan, baku
  {
    w: 0.3,
    km: 18,
    p: [
      [41.72, 44.79],
      [41.5, 45.0],
    ],
  },
  {
    w: 0.3,
    km: 18,
    p: [
      [40.18, 44.51],
      [40.3, 44.6],
    ],
  },
  {
    w: 0.4,
    km: 18,
    p: [
      [40.41, 49.87],
      [40.55, 49.65],
    ],
  },
  // pakistan: karachi, hyderabad, up the indus to multan and lahore
  {
    w: 0.7,
    km: 24,
    p: [
      [24.8, 66.95],
      [24.86, 67.05],
      [24.95, 67.2],
    ],
  },
  {
    w: 0.25,
    km: 20,
    p: [
      [24.86, 67.05],
      [25.4, 68.37],
      [27.7, 68.86],
      [29.4, 71.68],
      [30.16, 71.52],
      [31.55, 74.34],
    ],
  },
];

const G = new Float32Array(W * H);
const RAD = Math.PI / 180;
function addSeg(a, b, w, km) {
  // flat around the segment's mean latitude (fine at these lengths), lengths in km
  const lat0 = ((a[0] + b[0]) / 2) * RAD;
  const kx = Math.cos(lat0) * EARTH_KM * RAD;
  const ky = EARTH_KM * RAD;
  const reach = (km * 3) / ky;
  const lo = Math.min(a[0], b[0]) - reach;
  const hi = Math.max(a[0], b[0]) + reach;
  const left = Math.min(a[1], b[1]) - reach / Math.cos(lat0);
  const right = Math.max(a[1], b[1]) + reach / Math.cos(lat0);
  const y0 = Math.max(0, Math.floor(((90 - hi) / 180) * H));
  const y1 = Math.min(H - 1, Math.ceil(((90 - lo) / 180) * H));
  const x0 = Math.floor(((left + 180) / 360) * W);
  const x1 = Math.ceil(((right + 180) / 360) * W);
  const bx = (b[1] - a[1]) * kx;
  const by = (b[0] - a[0]) * ky;
  const bb = bx * bx + by * by || 1;
  for (let y = y0; y <= y1; y++) {
    const lat = 90 - ((y + 0.5) / H) * 180;
    for (let xi = x0; xi <= x1; xi++) {
      const x = ((xi % W) + W) % W;
      const lon = -180 + ((xi + 0.5) / W) * 360;
      const px = (lon - a[1]) * kx;
      const py = (lat - a[0]) * ky;
      const t = Math.max(0, Math.min(1, (px * bx + py * by) / bb));
      const dx = px - t * bx;
      const dy = py - t * by;
      const d2 = (dx * dx + dy * dy) / (km * km);
      if (d2 < 9) G[y * W + x] = Math.max(G[y * W + x], w * Math.exp(-d2));
    }
  }
}
for (const c of CORRIDORS)
  for (let i = 0; i + 1 < c.p.length; i++) addSeg(c.p[i], c.p[i + 1], c.w, c.km);
// a halo of towns round every city, the larger the wider (the far ones' lighter weights keep theirs small: no
// corridors out there, so the region stays the densest light on the night side)
for (const c of ALL)
  addSeg([c.lat, c.lon], [c.lat, c.lon + 1e-6], Math.min(0.9, 0.35 + 0.45 * c.w), 30 + 45 * c.w);

// ---------------------------------------------------------------------------------------------------------------
// 4. the PNG (RGB, 8 bit), and the checks

const px = Buffer.alloc(W * H * 3);
for (let i = 0; i < W * H; i++) {
  px[i * 3] = Math.round(255 * (0.5 + 0.5 * Math.tanh(sd[i] / D_KM)));
  px[i * 3 + 1] = Math.round(255 * Math.min(1, G[i]));
  px[i * 3 + 2] = 0;
}

function png(w, h, data) {
  const bpp = 3;
  const stride = w * bpp;
  const raw = Buffer.alloc((stride + 1) * h);
  const prev = Buffer.alloc(stride);
  const cand = Array.from({ length: 5 }, () => Buffer.alloc(stride));
  for (let y = 0; y < h; y++) {
    const row = data.subarray(y * stride, (y + 1) * stride);
    let best = 0;
    let bestS = Infinity;
    for (let ft = 0; ft < 5; ft++) {
      const c = cand[ft];
      let s = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? row[i - bpp] : 0;
        const b = prev[i];
        const cc = i >= bpp ? prev[i - bpp] : 0;
        let p;
        if (ft === 0) p = 0;
        else if (ft === 1) p = a;
        else if (ft === 2) p = b;
        else if (ft === 3) p = (a + b) >> 1;
        else {
          const pp = a + b - cc;
          const pa = Math.abs(pp - a);
          const pb = Math.abs(pp - b);
          const pc = Math.abs(pp - cc);
          p = pa <= pb && pa <= pc ? a : pb <= pc ? b : cc;
        }
        const v = (row[i] - p) & 255;
        c[i] = v;
        s += v < 128 ? v : 256 - v;
      }
      if (s < bestS) {
        bestS = s;
        best = ft;
      }
    }
    raw[y * (stride + 1)] = best;
    cand[best].copy(raw, y * (stride + 1) + 1);
    row.copy(prev);
  }
  const chunk = (type, body) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(body.length);
    const tb = Buffer.concat([Buffer.from(type, "ascii"), body]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(tb) >>> 0);
    return Buffer.concat([len, tb, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const file = png(W, H, px);
writeFileSync(OUT, file);
console.log(`${OUT}: ${W}x${H}, ${(file.length / 1024).toFixed(0)} KB`);

// every city must stand on land (bilinear, as the GPU reads it), clear of the coast (by 2 km)
let bad = 0;
const inland = [];
for (const c of ALL) {
  const fx = ((c.lon + 180) / 360) * W - 0.5;
  const fy = ((90 - c.lat) / 180) * H - 0.5;
  const x = Math.floor(fx);
  const y = Math.floor(fy);
  const u = fx - x;
  const v = fy - y;
  const at = (i, j) => sd[Math.min(H - 1, Math.max(0, y + j)) * W + ((((x + i) % W) + W) % W)];
  const d = (1 - v) * ((1 - u) * at(0, 0) + u * at(1, 0)) + v * ((1 - u) * at(0, 1) + u * at(1, 1));
  const flag = d < 2 ? "  <-- too close to the water" : "";
  if (flag) bad++;
  inland.push(`  ${JSON.stringify(c.name)}: ${Math.max(0, d).toFixed(1)},`);
  console.log(`${c.name.padEnd(14)} ${d.toFixed(1).padStart(7)} km inland${flag}`);
}
if (bad) {
  console.log(`${bad} cities too close to the water`);
  process.exitCode = 1;
}
writeFileSync(
  INLAND,
  `/**
 * Generated by scripts/bake-earth.mjs from the baked map (public/data/earth.png): how far each place of ./places.ts
 * stands from the sea, in km (the radius of the land round it). Do not edit: run the bake again.
 */
export const INLAND_KM: Record<string, number> = {
${inland.join("\n")}
};
`,
);
console.log(
  `${INLAND}: ${ALL.length} places (${PLACES.length} in the region, ${FAR_PLACES.length} beyond it)`,
);
