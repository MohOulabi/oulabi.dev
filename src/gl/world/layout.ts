/**
 * The world's fixed layout (src/lib/journey.ts PLANET): where the hub, the cities, the network and the ring of
 * nodes sit on the planet, where the sun is, the storm's direction and the field's shape, and the timeline of figs
 * 8-11 (the world appears, your point lands at the hub, the cities light and wire together, the storm and its
 * aurora, the camera pulls away) as pure functions of story time. Everything here is computed once at module load,
 * so every tier, every visit and the camera agree on the same planet.
 *
 * The planet is Earth, seen over the Middle East at night: real latitude and longitude are mapped onto it so that
 * Riyadh (./places.ts HUB_GEO) sits exactly at HUB, in the middle of the world as figs 8-9 frame it, and geographic
 * north is AXIS, up the screen; the land is baked from Natural Earth (public/data/earth.png, scripts/bake-earth.mjs)
 * and the cities are real (./places.ts), lighting outward from Riyadh: the region's (CITIES, wired into the network),
 * then the world beyond it on the night side (FAR, smaller and softer, wired region by region and joined to the
 * region's network through their gateways: FAR_ARCS). The field of fig. 9 has its own axis (MAG), as
 * Earth's does. The core show's world planet of figs 4-7 is the same Earth (src/gl/show/cosmos.ts), turning about AXIS
 * with the story and at rest in this frame from the hand-off on.
 *
 * Frame: the planet does not spin with story time (the camera travels instead, so the framing stays composed);
 * the visitor's horizontal drag turns it a little about AXIS and springs back. Directions below are unit vectors
 * from the planet's centre in that rest frame ("base" directions).
 */
import { type Matrix3, Vector3 } from "three";
import { BEATS, F, figK, HANDOFF, PLANET } from "@/lib/journey";
import { clamp01 } from "@/lib/math";
import { INLAND_KM } from "./inland";
import { FAR_GATES, FAR_PLACES, FAR_WEBS, HUB_GEO, PLACES } from "./places";

export const CENTER = new Vector3(...PLANET.center);
export const RADIUS = PLANET.radius;

/**
 * The hub (where your point lands: the first city, Riyadh) faces +z and 10 degrees up, toward the eye of figs 8-9
 * (poses/world.ts KEYS: the eye can rise no higher, or the sun behind the world shows over its upper limb), so
 * Riyadh sits in the middle of the world as they frame it.
 */
export const HUB = new Vector3(0, Math.tan((10 * Math.PI) / 180), 1).normalize();
/** Tangent frame at the hub: east (+x) and north (toward the planet's top). */
const EAST = new Vector3(1, 0, 0);
const NORTH = new Vector3().crossVectors(HUB, EAST).normalize();
/**
 * Planet axis (geographic north): the hub sits at Riyadh's real latitude on the meridian that runs straight up the
 * screen, so the map reads north up from the camera of figs 8-9, as it does on any map of the region.
 */
const DEG = Math.PI / 180;
const HUB_LAT = HUB_GEO.lat * DEG;
export const AXIS = new Vector3()
  .copy(HUB)
  .multiplyScalar(Math.sin(HUB_LAT))
  .addScaledVector(NORTH, Math.cos(HUB_LAT))
  .normalize();
/**
 * The field's axis (fig. 9): as on Earth, the magnetic pole is not the geographic one (here 17 degrees from it). It
 * leans 15 degrees east of the vertical (toward the sun's side) and 6 toward the eye, so the field, its loops and the
 * aurora read tilted against the storm; the field lines, the storm's frame and the auroral ovals are drawn about it.
 */
export const MAG = new Vector3(0.2504, 0.9623, 0.1061).normalize();
/**
 * The geographic frame: GEO_X on the equator under Riyadh's meridian, GEO_Y 90 degrees east of it, GEO_Z = AXIS
 * (north). A direction's latitude is asin(d . GEO_Z), its longitude HUB_GEO.lon + atan2(d . GEO_Y, d . GEO_X).
 */
export const GEO_Z = AXIS;
export const GEO_X = new Vector3().copy(HUB).addScaledVector(AXIS, -HUB.dot(AXIS)).normalize();
export const GEO_Y = new Vector3().crossVectors(AXIS, GEO_X).normalize();
/** Longitude of GEO_X (radians): Riyadh's. */
export const GEO_LON0 = HUB_GEO.lon * DEG;

/**
 * The turn by `a` (rad, east positive) about Earth's axis, rest frame -> world, into m (no allocation): the visitor's
 * drag (./world.ts), the flock's wait over the turned lights (glsl/finale.ts) and the core show's Earth (cosmos.ts,
 * which turns it with the story and reads its surface back through the inverse, a turn by -a).
 */
export function axisTurn(m: Matrix3, a: number) {
  const x = AXIS.x;
  const y = AXIS.y;
  const z = AXIS.z;
  const c = Math.cos(a);
  const s = Math.sin(a);
  const t = 1 - c;
  return m.set(
    t * x * x + c,
    t * x * y - s * z,
    t * x * z + s * y,
    t * x * y + s * z,
    t * y * y + c,
    t * y * z - s * x,
    t * x * z - s * y,
    t * y * z + s * x,
    t * z * z + c,
  );
}

/** The base direction of a real place (degrees north, degrees east). */
function geoDir(lat: number, lon: number, out = new Vector3()) {
  const la = lat * DEG;
  const lo = lon * DEG - GEO_LON0;
  return out
    .copy(GEO_Z)
    .multiplyScalar(Math.sin(la))
    .addScaledVector(GEO_X, Math.cos(la) * Math.cos(lo))
    .addScaledVector(GEO_Y, Math.cos(la) * Math.sin(lo));
}
/** A faint cold skylight from the upper left that gives the night side its form (no moon in the sky). */
export const SKYLIGHT = new Vector3(-0.55, 0.6, 0.6).normalize();
/** The sun: behind the planet, up and to the right of every camera here, so the night side faces us. */
export const SUN = new Vector3(0.24, 0.34, -1).normalize();

/** Earth's radius (km): the map's distances onto the planet. */
const EARTH_KM = 6371;

/**
 * Upper bounds baked into the shaders: the region's cities (the flow's uniform arrays, shaders.ts FLOW_VERT, with the
 * nodes and the waves: 2 x 40 + 18 + 4 vec4 of the vertex stage, well inside a phone's 256), the network's links.
 * The far lights are not in any uniform array (the bake reads every city from a small table texture, their markers
 * are a points draw of their own and their network an instanced draw of its own, from attributes, ./world.ts), so
 * they cost the uniform budget nothing.
 */
export const MAX_CITIES = 40;
const MAX_LINKS = 56;
export const NODES = 18;

/** `spread`: how far round it (rad) what gathers at the city may scatter: its towns' reach, never past its coast. */
export type City = {
  dir: Vector3;
  size: number;
  order: number;
  seed: number;
  spokeH: number;
  speed: number;
  weight: number;
  spread: number;
};
/** A light beyond the region (./places.ts FAR_PLACES): where it is, how much light it gives, when it switches on. */
export type FarCity = { dir: Vector3; size: number; order: number; seed: number };
export type Arc = {
  a: number;
  b: number;
  /** 0 a link of the network (fig. 8); dormant (the surge): 1 a route to the hub, 2 a hop to a node. */
  kind: 0 | 1 | 2;
  height: number;
  delay: number;
  speed: number;
  phase: number;
  bright: number;
  toHub: number;
};
export type Node = { dir: Vector3; ring: number; bearing: number; threshold: number };
/**
 * A link of the far network (fig. 8), drawn from `a` (the end the network reached first) to `b`: it starts drawing on
 * at netK `delay` and takes `dur` of it (the front's pace along it), `kind` 0 a link inside a far web, 1 a trunk out
 * of the region, 2 a bridge between webs; `flow` 1 when a packet runs along it.
 */
export type FarArc = {
  a: Vector3;
  b: Vector3;
  kind: 0 | 1 | 2;
  height: number;
  delay: number;
  dur: number;
  speed: number;
  phase: number;
  bright: number;
  flow: number;
};

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Direction at angular distance rho (rad) from the hub, along bearing theta (0 east, pi/2 north). */
function fromHub(rho: number, theta: number, out = new Vector3()) {
  return out
    .copy(HUB)
    .multiplyScalar(Math.cos(rho))
    .addScaledVector(EAST, Math.cos(theta) * Math.sin(rho))
    .addScaledVector(NORTH, Math.sin(theta) * Math.sin(rho))
    .normalize();
}

/** Arc height above the surface for a great-circle span of `ang` radians (links, routes and hops agree). */
const arcHeight = (ang: number) => RADIUS * (0.012 + 0.16 * ang);

const angle = (a: Vector3, b: Vector3) => Math.acos(Math.min(1, Math.max(-1, a.dot(b))));

/**
 * When a light switches on (its `order`, against cityKAt): outward from the hub in order of distance. The region, out
 * to its farthest city, takes most of the beat (from 0.05 to REGION_K); the world beyond it lights in the last of it
 * (to 0.95), out to the farthest far city, so the light spreads from your point over the region and then on round the
 * world. One curve for both: a far city nearer than the region's edge (Baku, Athens) lights among the region's.
 */
const REGION_K = 0.74;
const rhoOf = (p: { lat: number; lon: number }) => angle(geoDir(p.lat, p.lon), HUB);
const REGION_RHO = Math.max(...PLACES.slice(0, MAX_CITIES).map(rhoOf));
const WORLD_RHO = Math.max(REGION_RHO + 0.01, ...FAR_PLACES.map(rhoOf));
const orderAt = (rho: number) =>
  rho <= REGION_RHO
    ? 0.05 + (REGION_K - 0.05) * (rho / REGION_RHO)
    : REGION_K + (0.95 - REGION_K) * ((rho - REGION_RHO) / (WORLD_RHO - REGION_RHO));

function buildCities(): City[] {
  const rnd = mulberry(0x6e75717461);
  // the real cities of the region (./places.ts), Riyadh first; size is each one's light
  const out: City[] = PLACES.slice(0, MAX_CITIES).map((p, i) => ({
    dir: i === 0 ? HUB.clone() : geoDir(p.lat, p.lon),
    size: p.w,
    order: 0,
    seed: i === 0 ? 0.5 : rnd(),
    spokeH: 0,
    speed: 0,
    weight: 0,
    // (0.8 of its distance to the sea, ./inland.ts, from the baked map)
    spread: Math.min(0.008 + 0.03 * p.w, (0.8 * (INLAND_KM[p.name] ?? 0)) / EARTH_KM),
  }));
  // the light spreads out from the hub, with a little disorder
  for (let i = 1; i < out.length; i++) {
    const c = out[i];
    const rho = angle(c.dir, HUB);
    // in order of distance from the hub, with a little disorder (the light spreads outward from your point)
    c.order = Math.min(0.98, orderAt(rho) + 0.065 * c.seed);
    c.spokeH = arcHeight(rho);
    // about one world unit per second along the route, whatever its length
    c.speed = Math.min(0.55, Math.max(0.07, 1.15 / (rho * RADIUS)));
    c.weight = 0.45 + 0.55 * c.size;
  }
  return out;
}

export const CITIES = buildCities();

/**
 * The world beyond the region (./places.ts FAR_PLACES), lit last, outward from the hub like the rest, and wired last
 * (FAR_ARCS); no flock of their own (the region's cities lead; the far lights are the world they reach). Their ground
 * light is baked with the region's (./world.ts bake), their markers are a points draw of their own (./world.ts,
 * shaders.ts FAR_*).
 */
export const FAR: FarCity[] = (() => {
  const rnd = mulberry(0x776f726c64);
  return FAR_PLACES.map((p) => {
    const dir = geoDir(p.lat, p.lon);
    const seed = rnd();
    return { dir, size: p.w, order: Math.min(0.98, orderAt(angle(dir, HUB)) + 0.03 * seed), seed };
  });
})();

/**
 * The network's schedule, in netK (netKAt: 0 to 1.1 over BEATS.theirs.network). The region wires first: a link draws
 * on from NET0 + NET_S x the switch-on order of the later of its cities, over NET_DRAW (shaders.ts ARC_VERT's 0.16), so
 * it is all wired by about 0.62; then the trunks leave its gateways and the far webs grow out of them (FAR_ARCS) until
 * FAR_END, so the network wires outward from Riyadh and is whole as the figure ends.
 */
const NET0 = 0.02;
const NET_S = 0.55;
const NET_DRAW = 0.16;
const FAR_END = 1.08;

function buildArcs(): Arc[] {
  const rnd = mulberry(0x61726373);
  const n = CITIES.length;
  const seen = new Set<string>();
  const arcs: Arc[] = [];
  const key = (a: number, b: number) => (a < b ? `${a}-${b}` : `${b}-${a}`);
  const link = (i: number, j: number) => {
    const k = key(i, j);
    if (i === j || seen.has(k) || arcs.length >= MAX_LINKS) return;
    seen.add(k);
    // from the city lit first to the one lit after: the network grows outward
    const [a, b] = CITIES[i].order <= CITIES[j].order ? [i, j] : [j, i];
    const ang = angle(CITIES[a].dir, CITIES[b].dir);
    arcs.push({
      a,
      b,
      kind: 0,
      // links between cities arch higher than the routes into the hub (which the flow rides)
      height: a === 0 || b === 0 ? arcHeight(ang) : Math.min(arcHeight(ang) * 1.2, RADIUS * 0.13),
      delay: NET0 + NET_S * Math.max(CITIES[a].order, CITIES[b].order),
      speed: Math.min(0.5, Math.max(0.06, 0.9 / (ang * RADIUS))),
      phase: rnd(),
      bright: 0.42 + 0.36 * Math.min(1, (CITIES[a].size + CITIES[b].size) * 0.6),
      toHub: a === 0 || b === 0 ? 1 : 0,
    });
  };
  // the network grows outward from Riyadh: Riyadh wires straight to a city in each direction (./places.ts `hub`:
  // Jeddah, Dubai, Baghdad, Cairo, Sana'a), and every other city to the nearest city lit before it. Cities closer than
  // MIN_ARC read as one light (Jeddah and Mecca, Dammam and Manama): no arc between them.
  const MIN_ARC = 0.024;
  const byOrder = [...Array(n).keys()].sort((p, q) => CITIES[p].order - CITIES[q].order);
  const ang = (i: number, j: number) => angle(CITIES[i].dir, CITIES[j].dir);
  for (let j = 1; j < n; j++) if (PLACES[j].hub) link(0, j);
  for (const i of byOrder) {
    if (i === 0) continue;
    let best = -1;
    for (const j of byOrder) {
      if (CITIES[j].order >= CITIES[i].order) break;
      if (ang(i, j) >= MIN_ARC && (best < 0 || ang(i, j) < ang(i, best))) best = j;
    }
    if (best >= 0) link(i, best);
  }
  // (the far lights are wired by FAR_ARCS: in webs of their own, joined to these through the gateways, never by long
  // arcs from the region across the globe)
  return arcs;
}

const LINKS = buildArcs();

/**
 * The far network: each web of ./places.ts FAR_WEBS wired to its near neighbours (the shortest links that span it,
 * then a few more that close a loop: a short link whose cities are far apart along the web, never across another
 * link and never leaving a city alongside one it already has), the trunks and bridges of FAR_GATES, all grown outward
 * from the region: the front leaves each gateway when the region's link into it has drawn on, and runs along the
 * links at one pace (fitted so the farthest city is reached at FAR_END), so every link draws on from the end the
 * network reached first. Each link is a little dimmer the later the front reaches it (FAR_FALL), so the light of the
 * network thins out from Riyadh and the region's leads. Built once as the module loads, in a few milliseconds (no step
 * is worse than quadratic in a web's size, and the pace takes a few passes).
 */
const FAR_FALL = 0.55;
function buildFarArcs(): FarArc[] {
  const rnd = mulberry(0x66617261);
  const nR = CITIES.length;
  const dirs = [...CITIES.map((c) => c.dir), ...FAR.map((c) => c.dir)];
  const size = [...CITIES.map((c) => c.size), ...FAR.map((c) => c.size)];
  const N = dirs.length;
  const id = new Map<string, number>();
  PLACES.slice(0, nR).forEach((p, i) => {
    id.set(p.name, i);
  });
  FAR_PLACES.forEach((p, i) => {
    id.set(p.name, nR + i);
  });
  const at = (name: string) => {
    const i = id.get(name);
    if (i === undefined) throw new Error(`far network: no place "${name}"`);
    return i;
  };
  // two lights closer than this read as one (Mumbai and Pune): twins, wired as one light (no arc between them, and
  // the web reaches both at once)
  const MIN_ARC = 0.024;
  // a link never leaves a city closer than this (rad) to one it already has there: no doubled lines
  const MIN_SPLAY = 0.36;
  const edges: { u: number; v: number; len: number; kind: 0 | 1 | 2 }[] = [];
  const pairs: [number, number][] = [];
  // the links at each city so far (the other end), for the splay test
  const at0 = Array.from({ length: N }, () => [] as number[]);
  const t0 = new Vector3();
  const t1 = new Vector3();
  // the direction a link from i to j leaves i in (the tangent of the great circle at i)
  const leave = (i: number, j: number, out: Vector3) =>
    out.copy(dirs[j]).addScaledVector(dirs[i], -dirs[i].dot(dirs[j])).normalize();
  const SPLAY_COS = Math.cos(MIN_SPLAY);
  const splays = (i: number, j: number) => {
    leave(i, j, t0);
    for (const k of at0[i]) if (t0.dot(leave(i, k, t1)) > SPLAY_COS) return false;
    return true;
  };
  const add = (u: number, v: number, kind: 0 | 1 | 2) => {
    edges.push({ u, v, len: angle(dirs[u], dirs[v]), kind });
    at0[u].push(v);
    at0[v].push(u);
  };

  // a web's cities on the plane that touches the globe at its centroid o (east e, north nn), for the crossing test
  const flat = (i: number, o: Vector3, e: Vector3, nn: Vector3) => {
    const z = Math.max(0.2, dirs[i].dot(o));
    return [dirs[i].dot(e) / z, dirs[i].dot(nn) / z];
  };
  const side = (p: number[], q: number[], r: number[]) =>
    Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]));
  const crosses = (a: number[], b: number[], c: number[], d: number[]) =>
    side(a, b, c) * side(a, b, d) < 0 && side(c, d, a) * side(c, d, b) < 0;

  for (const names of FAR_WEBS) {
    const ids = names.map(at);
    const m = ids.length;
    // the angle between every two of its cities, and the shortest way between them along the web (W; twins are one
    // place, 0 apart)
    const D = new Float64Array(m * m);
    const W = new Float64Array(m * m).fill(Infinity);
    for (let u = 0; u < m; u++)
      for (let v = u + 1; v < m; v++)
        D[u * m + v] = D[v * m + u] = angle(dirs[ids[u]], dirs[ids[v]]);
    const linked = new Uint8Array(m * m);
    const web: [number, number][] = [];
    // (W is filled in once the tree is whole, then kept up to date as each loop is added)
    const along = (u: number, v: number, d: number) => {
      for (let i = 0; i < m; i++)
        for (let j = 0; j < m; j++) {
          const via = Math.min(W[i * m + u] + d + W[v * m + j], W[i * m + v] + d + W[u * m + j]);
          if (via < W[i * m + j]) W[i * m + j] = via;
        }
    };
    const link = (u: number, v: number, _d: number) => {
      web.push([u, v]);
      linked[u * m + v] = linked[v * m + u] = 1;
      add(ids[u], ids[v], 0);
    };
    const twins: [number, number][] = [];
    for (let u = 0; u < m; u++)
      for (let v = u + 1; v < m; v++)
        if (D[u * m + v] < MIN_ARC) {
          twins.push([u, v]);
          pairs.push([ids[u], ids[v]]);
        }
    // the spanning tree of the shortest links (Prim): twins join it together
    const inT = new Uint8Array(m);
    const key = new Float64Array(m).fill(Infinity);
    const from = new Int32Array(m).fill(-1);
    let count = 0;
    const join = (v: number) => {
      if (inT[v]) return;
      inT[v] = 1;
      count++;
      for (let w = 0; w < m; w++) {
        const d = D[v * m + w];
        if (!inT[w] && d >= MIN_ARC && d < key[w]) {
          key[w] = d;
          from[w] = v;
        }
      }
      for (const [a, b] of twins)
        if (a === v) join(b);
        else if (b === v) join(a);
    };
    join(0);
    while (count < m) {
      let v = -1;
      for (let w = 0; w < m; w++) if (!inT[w] && from[w] >= 0 && (v < 0 || key[w] < key[v])) v = w;
      if (v < 0) break;
      link(from[v], v, key[v]);
      join(v);
    }
    // the way along the tree from each city to every other (a walk from each; a tree has one way)
    const nb = Array.from({ length: m }, () => [] as [number, number][]);
    for (const [u, v] of web) {
      nb[u].push([v, D[u * m + v]]);
      nb[v].push([u, D[u * m + v]]);
    }
    for (const [u, v] of twins) {
      nb[u].push([v, 0]);
      nb[v].push([u, 0]);
    }
    const stack: number[] = [];
    for (let s0 = 0; s0 < m; s0++) {
      W[s0 * m + s0] = 0;
      stack.push(s0);
      while (stack.length) {
        const u = stack.pop() as number;
        for (const [v, d] of nb[u])
          if (W[s0 * m + v] === Infinity) {
            W[s0 * m + v] = W[s0 * m + u] + d;
            stack.push(v);
          }
      }
    }
    // a few more that close loops: short, a real shortcut along the web (1.5 x; 1.25 x and a little longer in a small
    // web, so it is a web and not a strand), crossing no link, splayed from the links at both its ends
    const o = new Vector3();
    for (const i of ids) o.add(dirs[i]);
    o.normalize();
    const e = new Vector3().crossVectors(AXIS, o).normalize();
    const nn = new Vector3().crossVectors(o, e);
    const P = ids.map((i) => flat(i, o, e, nn));
    let longest = 0;
    for (const [u, v] of web) longest = Math.max(longest, D[u * m + v]);
    const small = m <= 6;
    const cap = Math.max(small ? 0.16 : 0.14, Math.min(0.26, longest * 1.1));
    const shortcut = small ? 1.25 : 1.5;
    const cands: [number, number, number][] = [];
    for (let u = 0; u < m; u++)
      for (let v = u + 1; v < m; v++) {
        const d = D[u * m + v];
        if (d >= MIN_ARC && d <= cap && !linked[u * m + v]) cands.push([u, v, d]);
      }
    cands.sort((p, q) => p[2] - q[2]);
    const extra = web.length + Math.ceil(m * 0.4);
    for (const [u, v, d] of cands) {
      if (web.length >= extra) break;
      if (W[u * m + v] / d < shortcut) continue;
      if (!splays(ids[u], ids[v]) || !splays(ids[v], ids[u])) continue;
      if (
        web.some(
          ([a, b]) => a !== u && a !== v && b !== u && b !== v && crosses(P[u], P[v], P[a], P[b]),
        )
      )
        continue;
      link(u, v, d);
      along(u, v, d);
    }
  }
  for (const [p, q] of FAR_GATES) {
    const u = at(p);
    add(u, at(q), u < nR ? 1 : 2);
  }

  // when the network reaches each city: a region city once the region's link into it has drawn on (the hub at once)
  const regionAt = new Array<number>(nR).fill(Infinity);
  regionAt[0] = 0;
  for (const l of LINKS) regionAt[l.b] = Math.min(regionAt[l.b], l.delay + NET_DRAW);
  // the far graph once, as lists per city (the region's own cities are reached by the region's network, never back
  // through a far one, so no link leads into them; twins are reached together)
  const adj = Array.from({ length: N }, () => [] as [number, number][]);
  for (const g of edges) {
    if (g.v >= nR) adj[g.u].push([g.v, g.len]);
    if (g.u >= nR) adj[g.v].push([g.u, g.len]);
  }
  for (const [u, v] of pairs) {
    adj[u].push([v, 0]);
    adj[v].push([u, 0]);
  }
  const nodes: number[] = [];
  for (let i = 0; i < N; i++) if (adj[i].length || i >= nR) nodes.push(i);
  const MIN_DUR = 0.035;
  // the front's arrival at each city for a pace (netK per radian), as c + s x pace on its way (s its length run at
  // the pace, c its start and the links too short for it), and when the last link is whole: end = C + S x pace
  const c = new Float64Array(N);
  const sl = new Float64Array(N);
  const done = new Uint8Array(N);
  const r = (i: number, pace: number) => c[i] + sl[i] * pace;
  const grow = (pace: number) => {
    for (const i of nodes) {
      c[i] = i < nR ? regionAt[i] : Infinity;
      sl[i] = 0;
      done[i] = 0;
    }
    for (;;) {
      let u = -1;
      for (const i of nodes)
        if (!done[i] && c[i] < Infinity && (u < 0 || r(i, pace) < r(u, pace))) u = i;
      if (u < 0) break;
      done[u] = 1;
      const ru = r(u, pace);
      for (const [o, len] of adj[u]) {
        const long = len * pace >= MIN_DUR;
        const t = ru + (len > 0 ? (long ? len * pace : MIN_DUR) : 0);
        if (t < r(o, pace)) {
          c[o] = c[u] + (len > 0 && !long ? MIN_DUR : 0);
          sl[o] = sl[u] + (long ? len : 0);
        }
      }
    }
    let end = -Infinity;
    let C = 0;
    let S = 0;
    for (const g of edges) {
      const a = r(g.u, pace) <= r(g.v, pace) ? g.u : g.v;
      const long = g.len * pace >= MIN_DUR;
      const t = r(a, pace) + (long ? g.len * pace : MIN_DUR);
      if (t > end) {
        end = t;
        C = c[a] + (long ? 0 : MIN_DUR);
        S = sl[a] + (long ? g.len : 0);
      }
    }
    return { end, C, S };
  };
  // the pace that reaches the farthest city at FAR_END: Newton's steps on the line the last link is on, kept inside
  // a bracket (halved when a step leaves it); a few passes
  let lo = 0.05;
  let hi = 4;
  let pace = 0.5;
  for (let i = 0; i < 24; i++) {
    const { end, C, S } = grow(pace);
    if (!Number.isFinite(end)) throw new Error("far network: a far city the network never reaches");
    if (end <= FAR_END + 1e-9) lo = pace;
    else hi = pace;
    if (Math.abs(end - FAR_END) < 1e-7 || hi - lo < 1e-6) break;
    const next = S > 0 ? (FAR_END - C) / S : (lo + hi) / 2;
    pace = next > lo && next < hi ? next : (lo + hi) / 2;
  }
  grow(lo);
  let first = Infinity;
  for (const g of edges) first = Math.min(first, r(g.u, lo), r(g.v, lo));

  return edges.map((g) => {
    const [a, b] = r(g.u, lo) <= r(g.v, lo) ? [g.u, g.v] : [g.v, g.u];
    const span = g.len;
    const phase = rnd();
    // the later the front reaches it, the dimmer: the network thins out from Riyadh
    const fall = 1 - FAR_FALL * Math.min(1, Math.max(0, (r(a, lo) - first) / (FAR_END - first)));
    return {
      a: dirs[a],
      b: dirs[b],
      kind: g.kind,
      // lower than the region's links: they hug the ground, so the ones near the limb never stand up over it
      height: Math.min(arcHeight(span) * (g.kind === 0 ? 0.6 : 0.7), RADIUS * 0.06),
      delay: r(a, lo),
      dur: Math.max(MIN_DUR, span * lo),
      // the packets ride a little slower than the region's
      speed: Math.min(0.4, Math.max(0.05, 0.6 / (span * RADIUS))),
      phase,
      bright: ((g.kind === 0 ? 0.62 : 0.78) + 0.3 * Math.min(1, (size[a] + size[b]) * 0.7)) * fall,
      // sparser flow: a packet on the trunks and bridges, and on two links in three inside the webs
      flow: g.kind > 0 || rnd() < 0.66 ? 1 : 0,
    };
  });
}

/** The far network (fig. 8): drawn by its own instanced ribbons (./world.ts, shaders.ts FAR_ARC_*). */
export const FAR_ARCS = buildFarArcs();

function buildNodes(): Node[] {
  const out: Node[] = [];
  // inner ring of six, outer ring of twelve, each igniting around its ring like a clock hand
  for (let j = 0; j < 6; j++) {
    const bearing = Math.PI / 2 + (j / 6) * Math.PI * 2;
    out.push({ dir: fromHub(0.07, bearing), ring: 0, bearing, threshold: 0.3 + 0.2 * (j / 5) });
  }
  for (let j = 0; j < 12; j++) {
    const bearing = Math.PI / 2 + Math.PI / 12 + (j / 12) * Math.PI * 2;
    out.push({ dir: fromHub(0.13, bearing), ring: 1, bearing, threshold: 0.54 + 0.36 * (j / 11) });
  }
  return out;
}

export const NODE_LIST = buildNodes();

/** Every arc the ribbon draw renders: the network, then the routes to the hub, then the hops to the nodes. */
export const ARCS: Arc[] = (() => {
  const out = LINKS.slice();
  const linked = new Set(LINKS.filter((a) => a.toHub).map((a) => (a.a === 0 ? a.b : a.a)));
  for (let i = 1; i < CITIES.length; i++) {
    if (linked.has(i)) continue;
    const c = CITIES[i];
    out.push({
      a: i,
      b: 0,
      kind: 1,
      height: c.spokeH,
      delay: c.order,
      speed: c.speed,
      phase: c.seed,
      bright: 0.5 + 0.5 * c.size,
      toHub: 1,
    });
  }
  NODE_LIST.forEach((nd, j) => {
    out.push({
      a: 0,
      b: j,
      kind: 2,
      height: arcHeight(angle(HUB, nd.dir)),
      delay: 0,
      speed: 0.6,
      phase: j / NODES,
      bright: 0.7,
      toHub: 1,
    });
  });
  return out;
})();

// ---------------------------------------------------------------------------------------------------------------
// timeline (pure functions of story time T: journey.ts F, HANDOFF, BEATS)

export const ss = (a: number, b: number, x: number) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** The module draws only inside this window of story time (journey HANDOFF.WORLD_FROM, WORLD_TO). */
export const SHOW_FROM = HANDOFF.WORLD_FROM;
export const SHOW_TO = HANDOFF.WORLD_TO;
/** It fades out from here as the camera pulls away in fig. 11, gone by SHOW_TO. */
const FADE_FROM = F.again + 0.12;
const [C0, C1] = BEATS.theirs.cities;
const [N0, N1] = BEATS.theirs.network;

/** Planet presence: it fades in over the core show's sphere as the camera dives, and out as the camera pulls away. */
export const presenceAt = (T: number) =>
  ss(SHOW_FROM, HANDOFF.ARRIVE - 0.02, T) * (1 - ss(FADE_FROM, SHOW_TO - 0.005, T));
/** City lights (BEATS.theirs.cities): 0 none, 1 all (compared with each city's order; the hub lights first). */
export const cityKAt = (T: number) =>
  Math.max(-0.05, Math.min(1, (figK("theirs", T) - C0) / (C1 - C0))) * 1.04;
/** The network draws on once the cities it joins are lit (BEATS.theirs.network). */
export const netKAt = (T: number) => clamp01((figK("theirs", T) - N0) / (N1 - N0)) * 1.1;

/** Fig. 8: the impact of your point at the hub, a soft ring of light spreading over the night side (BEATS.theirs.impact). */
const [I0, I1] = BEATS.theirs.impact;
export const impactAt = (T: number) => (figK("theirs", T) - I0) / (I1 - I0 + 0.04);

// ---------------------------------------------------------------------------------------------------------------
// the storm (fig. 9): its direction, the shape of the field it meets, and its timeline

/**
 * The storm travels along STORM_DIR: in from deep space on the sun's side (screen right, a little behind the world),
 * past the world toward the left and the camera. "Noon" is the side of the world that faces it.
 */
export const STORM_DIR = new Vector3(-1, -0.1, 0.4).normalize();
export const NOON = new Vector3()
  .copy(STORM_DIR)
  .negate()
  .addScaledVector(MAG, STORM_DIR.dot(MAG))
  .normalize();
/** Dusk: completes the frame (MAG, NOON, DUSK) the field is drawn in (azimuth 0 at noon, pi/2 at dusk). */
export const DUSK = new Vector3().crossVectors(MAG, NOON).normalize();
/** The plane across the storm's travel: SA the field axis's share, SB the rest (streak offsets live in it). */
export const SA = new Vector3()
  .copy(MAG)
  .addScaledVector(STORM_DIR, -MAG.dot(STORM_DIR))
  .normalize();
export const SB = new Vector3().crossVectors(STORM_DIR, SA).normalize();

/** Along STORM_DIR (world units from the centre): where the streaks are born (upstream) and leave (downstream). */
export const STORM_S0 = 46;
export const STORM_S1 = 40;
/** The field's nose (the shield's distance upstream) at field 0 and at full field, in planet radii. */
export const NOSE = [1.0, 1.7] as const;
/** The auroral ovals: colatitude (rad) of their curtains around each magnetic pole (MAG); the storm pours in along L = R / sin². */
export const OVAL = 0.47;
export const CUSP_L = RADIUS / Math.sin(OVAL) ** 2;

/** Field lines (dipole loops r = L sin² of the colatitude): L in planet radii and azimuth from noon; the first four are
 *  the ink's paths field0..3 (midnight small, noon small, midnight large, noon large), then the rest by tier. */
export const LOOPS: { L: number; az: number }[] = [
  { L: 1.7, az: Math.PI },
  { L: 1.7, az: 0 },
  { L: 2.35, az: Math.PI },
  { L: 2.35, az: 0 },
  { L: 1.35, az: Math.PI },
  { L: 1.35, az: 0 },
  { L: 2.0, az: Math.PI },
  { L: 2.0, az: 0 },
  { L: 2.8, az: Math.PI },
  { L: 2.8, az: 0 },
  { L: 1.9, az: Math.PI - 0.6 },
  { L: 1.9, az: 0.6 },
  { L: 1.9, az: Math.PI + 0.6 },
  { L: 1.9, az: -0.6 },
];

/** Local progress of fig. 9 at story time T (unclamped). */
const kS = (T: number) => figK("storm", T);
const SBT = BEATS.storm;

/**
 * The front's place along STORM_DIR: in from far upstream (off frame) over BEATS.storm.front, at the field's nose as
 * the hit begins, and on past the world off frame; streaks exist only behind it.
 */
const FRONT_V = (STORM_S0 - RADIUS * 1.4) / (SBT.hit[0] - SBT.front[0]);
export const frontAt = (T: number) => -STORM_S0 + FRONT_V * Math.max(0, kS(T) - SBT.front[0]);
/** The storm blows from the front's arrival and thins away as the aurora comes up; what the field caught and pours
 *  into the poles runs on a little longer, into fig. 10. */
export const stormOnAt = (T: number) =>
  ss(SBT.front[0] - 0.01, SBT.front[0] + 0.02, kS(T)) * (1 - ss(0.58, 0.9, kS(T)));
export const pourOnAt = (T: number) =>
  ss(SBT.front[0] - 0.01, SBT.front[0] + 0.02, kS(T)) * (1 - ss(0.62, 0.94, kS(T)));
/** How hard it hits the world (BEATS.storm.hit), before the field: the lights flicker by hit (1 - field). */
export const hitAt = (T: number) =>
  ss(SBT.hit[0] - 0.01, SBT.hit[0] + 0.06, kS(T)) * (1 - ss(SBT.hit[1] - 0.12, SBT.hit[1], kS(T)));
/**
 * The field is there from the storm's arrival: it fades in with the front over the scroll (never on a gesture), at
 * its normal level once the front has met it, and strengthens on its own over BEATS.storm.field. The visitor's hold
 * (storm.ts) pushes it harder from wherever it is, for as long as they hold.
 */
export const arrivalAt = (T: number) => ss(SBT.front[0] + 0.02, SBT.hit[0] + 0.06, kS(T));
export const fieldRestAt = (T: number) =>
  arrivalAt(T) * (0.48 + 0.52 * ss(SBT.field[0], SBT.field[1], kS(T)));
/** The field lines show while the storm is on, step back for the aurora, and go with the storm. */
export const loopsOnAt = (T: number) =>
  (1 - 0.62 * ss(SBT.aurora[0] + 0.08, SBT.aurora[0] + 0.32, kS(T))) * (1 - ss(0.88, 1.02, kS(T)));
/**
 * The aurora (BEATS.storm.aurora): fed at the poles from the storm's arrival (a faint glow where it pours in, more
 * while the visitor pushes), the curtains, then gone in fig. 10. `field` is the field's strength against the storm.
 */
export const auroraAt = (T: number, field: number, push: number) => {
  const main = ss(SBT.aurora[0], SBT.aurora[0] + 0.16, kS(T));
  // (the feed is most of the glow before the curtains; a push brightens both, the curtains only a little: quiet)
  const feed = (0.2 + 0.3 * push) * arrivalAt(T) * (1 - 0.5 * main);
  return (main * (1 + 0.35 * push) + feed) * ss(0.2, 0.7, field) * (1 - ss(0.96, 1.14, kS(T)));
};
/** How far round each oval the curtains have lit, from noon (0) to the whole ring (1); a push spreads the glow. */
export const auroraSpreadAt = (T: number, push: number) =>
  Math.max(
    ss(SBT.aurora[0] - 0.04, SBT.aurora[0] + 0.34, kS(T)),
    (0.22 + 0.2 * push) * arrivalAt(T),
  );
