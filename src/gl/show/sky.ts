/**
 * The real sky over Riyadh (24.7136 N, 46.6753 E) at the visitor's local sidereal time.
 *
 * Stars: public/data/bsc5.json, built by scripts/bake-bsc5.mjs from the Yale Bright Star Catalogue, 5th Revised
 * Ed. (Hoffleit & Warren 1991; NASA ADC / CDS V/50, public domain): all 9,096 stars with coordinates, J2000
 * right ascension and declination, V magnitude and B-V colour index (colour by temperature).
 *
 * The rest of the motes: the Milky Way as faint stars along the real galactic plane (galactic -> equatorial with
 * the IAU J2000 pole), brighter toward the bulge in Sagittarius, cut by the Great Rift and patchy dust; faint
 * field stars concentrated toward the plane; gold dust near the eye; distant lights along the horizon.
 *
 * Frames: equatorial unit vectors e (x to the vernal equinox, z to the north celestial pole) are turned into
 * the world (x east, y up, z south; north is -z) by M(L) = A · Rz(-L) with L the local sidereal time.
 * Precession since J2000 (~0.4°) is ignored.
 */
import { Matrix3, Vector3 } from "three";
import { LAT, LON, ROLE } from "./constants";

const DEG = Math.PI / 180;

/** Local sidereal time at Riyadh, degrees (IAU 1982 GMST, linear form). */
export function lstDeg(dateMs: number) {
  const jd = dateMs / 86400000 + 2440587.5;
  const d = jd - 2451545.0;
  const gmst = 280.46061837 + 360.98564736629 * d;
  return (((gmst + LON) % 360) + 360) % 360;
}

/** Equatorial -> world rotation at local sidereal time `lst` (deg). */
export function skyMatrix(lst: number, out: Matrix3) {
  const L = lst * DEG;
  const p = LAT * DEG;
  const cL = Math.cos(L);
  const sL = Math.sin(L);
  const cp = Math.cos(p);
  const sp = Math.sin(p);
  // rows: x = east, y = up, z = south
  out.set(-sL, cL, 0, cp * cL, cp * sL, sp, sp * cL, sp * sL, -cp);
  return out;
}

/** The north celestial pole in the world (unit). */
export const POLE = new Vector3(0, Math.sin(LAT * DEG), -Math.cos(LAT * DEG));

export function eqVec(raDeg: number, decDeg: number, out: Vector3) {
  const a = raDeg * DEG;
  const d = decDeg * DEG;
  return out.set(Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d));
}

/** Galactic (l, b) -> equatorial (ra, dec), degrees, J2000. */
function galToEq(l: number, b: number): [number, number] {
  const aG = 192.85948 * DEG;
  const dG = 27.12825 * DEG;
  const lN = 122.93192 * DEG;
  const lr = l * DEG;
  const br = b * DEG;
  const sd = Math.sin(dG) * Math.sin(br) + Math.cos(dG) * Math.cos(br) * Math.cos(lN - lr);
  const dec = Math.asin(Math.max(-1, Math.min(1, sd)));
  const y = Math.cos(br) * Math.sin(lN - lr);
  const x = Math.cos(dG) * Math.sin(br) - Math.sin(dG) * Math.cos(br) * Math.cos(lN - lr);
  const ra = aG + Math.atan2(y, x);
  return [(((ra / DEG) % 360) + 360) % 360, dec / DEG];
}

const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** B-V colour index -> linear RGB (Ballesteros temperature, blackbody fit), softened toward white. */
function bvColour(bv: number, out: number[]) {
  const T = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
  const t = T / 100;
  let r: number;
  let g: number;
  let b: number;
  if (t <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(t) - 161.1195681661;
    b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * (t - 60) ** -0.1332047592;
    g = 288.1221695283 * (t - 60) ** -0.0755148492;
    b = 255;
  }
  const c = [r, g, b].map((x) => Math.min(255, Math.max(0, x)) / 255);
  const mx = Math.max(c[0], c[1], c[2]);
  for (let i = 0; i < 3; i++) out[i] = srgbToLinear(0.42 + 0.58 * (c[i] / mx));
  return out;
}

/** Seeded PRNG (mulberry32), so the sky is the same on every visit. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(r: () => number) {
  const u = Math.max(1e-6, r());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

/** Smooth value noise on a 2D lattice (for patchy dust in the Milky Way). */
function valueNoise(x: number, y: number) {
  const h = (i: number, j: number) => {
    const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = h(i, j);
  const b = h(i + 1, j);
  const c = h(i, j + 1);
  const d = h(i + 1, j + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

const wrap180 = (l: number) => ((((l + 180) % 360) + 360) % 360) - 180;

/** One Milky Way mote: galactic (l, b), or null when dust hides it. */
function milkyWay(r: () => number): [number, number, number] | null {
  let l: number;
  let b: number;
  if (r() < 0.34) {
    // the bulge in Sagittarius
    l = gauss(r) * 13;
    b = gauss(r) * 5.2 - 1.2;
  } else {
    // the disc, brighter toward the inner galaxy
    for (;;) {
      l = r() * 360 - 180;
      const w = 0.22 + 0.78 * Math.exp(-((l / 62) ** 2));
      if (r() < w) break;
    }
    const inner = Math.exp(-((l / 70) ** 2));
    b = gauss(r) * (2.1 + 2.2 * inner + 1.6 * r());
  }
  // the Great Rift, Cygnus to Sagittarius, a little north of the plane
  if (l > -18 && l < 88) {
    const br = 0.6 + 0.022 * l;
    const rift = Math.exp(-(((b - br) / (1.1 + 0.012 * l)) ** 2));
    if (r() < rift * 0.86) return null;
  }
  // patchy dust lanes everywhere near the plane
  const n = valueNoise(l / 7 + 40, b / 3.2 + 9) * 0.65 + valueNoise(l / 2.5, b / 1.4) * 0.35;
  if (Math.abs(b) < 9 && r() < Math.max(0, n - 0.42) * 1.6) return null;
  const glow = 0.55 + 0.45 * Math.exp(-((wrap180(l) / 30) ** 2)) * Math.exp(-((b / 6) ** 2));
  // star clouds: the band is clumpy, brighter knots between the lanes
  const clump = 0.55 + 0.9 * valueNoise(l / 11 + 3, b / 5 + 17) ** 1.6;
  return [l, b, glow * clump];
}

export type SkyData = {
  /** RGBA per mote: celestial = equatorial unit × radius; dust/horizon = world offset from the observer. w = role. */
  sky: Float32Array;
  /** RGBA per mote: linear colour × intensity, a = size (px for celestial, world for dust/horizon). */
  col: Float32Array;
  stars: number;
  /** The view of fig. 1 (world unit vector from the observer): the richest stretch of sky, north-ish. */
  look: Vector3;
};

export function buildSky(side: number, catalogue: number[], lst: number): SkyData {
  const n = side * side;
  const sky = new Float32Array(n * 4);
  const col = new Float32Array(n * 4);
  const r = rng(0x5eed1);
  const v = new Vector3();
  const M = skyMatrix(lst, new Matrix3());
  const c3 = [0, 0, 0];

  // view: score directions around north by Milky Way glow and bright stars
  const samples: Vector3[] = [];
  const weights: number[] = [];
  const rs = rng(77);
  for (let k = 0; k < 2400; k++) {
    const mw = milkyWay(rs);
    if (!mw) continue;
    const [ra, dec] = galToEq(mw[0], mw[1]);
    samples.push(eqVec(ra, dec, new Vector3()).applyMatrix3(M));
    weights.push(mw[2]);
  }
  const starCount = Math.min(Math.floor(catalogue.length / 4), n);
  for (let s = 0; s < Math.min(starCount, 300); s++) {
    samples.push(eqVec(catalogue[s * 4], catalogue[s * 4 + 1], new Vector3()).applyMatrix3(M));
    weights.push(1.6 * 10 ** (-0.4 * (catalogue[s * 4 + 2] - 1)));
  }
  let best = -1;
  const look = new Vector3(0, Math.sin(28 * DEG), -Math.cos(28 * DEG));
  const cand = new Vector3();
  for (let az = -55; az <= 55; az += 5)
    for (let alt = 24; alt <= 32; alt += 2) {
      cand.set(
        Math.cos(alt * DEG) * Math.sin(az * DEG),
        Math.sin(alt * DEG),
        -Math.cos(alt * DEG) * Math.cos(az * DEG),
      );
      let score = 0;
      for (let k = 0; k < samples.length; k++) {
        const s = samples[k];
        if (s.y < 0.05) continue;
        const d = cand.dot(s);
        if (d > 0.82) score += weights[k] * (d - 0.82) * Math.min(1, s.y * 4);
      }
      score *= 1 - Math.abs(az) / 400; // prefer north (the pole, and the nebula's side of the sky)
      if (score > best) {
        best = score;
        look.copy(cand);
      }
    }

  // 1) the catalogue
  for (let i = 0; i < starCount; i++) {
    const ra = catalogue[i * 4];
    const dec = catalogue[i * 4 + 1];
    const mag = catalogue[i * 4 + 2];
    const bv = catalogue[i * 4 + 3];
    eqVec(ra, dec, v);
    const rad = 170 + 80 * r();
    sky.set([v.x * rad, v.y * rad, v.z * rad, ROLE.star], i * 4);
    bvColour(bv, c3);
    const flux = 10 ** (-0.4 * (mag - 1.0));
    const I = Math.min(7, Math.max(0.07, flux ** 0.52 * 2.1));
    const size = Math.min(9, Math.max(1.8, 1.9 + (6.5 - mag) * 0.78));
    col.set([c3[0] * I, c3[1] * I, c3[2] * I, size], i * 4);
  }

  // 2) the rest, by a stable role mix
  for (let i = starCount; i < n; i++) {
    const h = r();
    const o = i * 4;
    if (h < 0.56) {
      let mw = milkyWay(r);
      while (!mw) mw = milkyWay(r);
      const [ra, dec] = galToEq(mw[0], mw[1]);
      eqVec(ra, dec, v);
      const rad = 230 + 60 * r();
      sky.set([v.x * rad, v.y * rad, v.z * rad, ROLE.milky], o);
      const bulge = Math.exp(-((wrap180(mw[0]) / 28) ** 2));
      const warm = Math.min(1, bulge * 1.2 + r() * 0.25);
      // half are soft glow (the unresolved band), half resolved grain on top
      const glowMote = r() < 0.5;
      const I = glowMote
        ? mw[2] * (0.0045 + 0.008 * r()) * (1 + 1.3 * bulge)
        : mw[2] * (0.07 + 0.42 * r() ** 4) * (1 + 0.9 * bulge);
      const size = glowMote ? 10 + 12 * r() : 1.3 + 0.8 * r();
      col.set(
        [(0.78 + 0.22 * warm) * I, (0.82 + 0.06 * warm) * I, (1.0 - 0.32 * warm) * I, size],
        o,
      );
    } else if (h < 0.7) {
      // faint field stars, a little denser toward the plane
      let ra: number;
      let dec: number;
      if (r() < 0.45) {
        [ra, dec] = galToEq(r() * 360, gauss(r) * 16);
      } else {
        ra = r() * 360;
        dec = Math.asin(r() * 2 - 1) / DEG;
      }
      eqVec(ra, dec, v);
      const rad = 200 + 100 * r();
      sky.set([v.x * rad, v.y * rad, v.z * rad, ROLE.faint], o);
      bvColour(-0.1 + r() * 1.5, c3);
      const I = 0.05 + 0.18 * r() ** 2.5;
      col.set([c3[0] * I, c3[1] * I, c3[2] * I, 1.5 + 0.6 * r()], o);
    } else if (h < 0.73) {
      // gold dust near the eye, around the view of fig. 1 and the pole
      const axis = r() < 0.6 ? look : POLE;
      const rad = 6 + 48 * r() ** 1.3;
      v.set(gauss(r), gauss(r), gauss(r))
        .multiplyScalar(0.42)
        .add(axis)
        .normalize()
        .multiplyScalar(rad);
      sky.set([v.x, v.y, v.z, ROLE.dust], o);
      const I = 0.05 + 0.22 * r() ** 3;
      col.set([1.0 * I, 0.62 * I, 0.27 * I, 0.014 + 0.026 * r()], o);
    } else {
      // distant lights along the horizon
      const az = r() * Math.PI * 2;
      const d = 160 + 640 * r() ** 0.7;
      sky.set([Math.sin(az) * d, -1.7 + 0.05 * r(), -Math.cos(az) * d, ROLE.horizon], o);
      const gold = r() < 0.55;
      const I = 0.06 + 0.22 * r() ** 2.5;
      col.set(gold ? [1.0 * I, 0.62 * I, 0.27 * I, 0.9] : [0.86 * I, 0.9 * I, 1.0 * I, 0.8], o);
    }
  }
  return { sky, col, stars: starCount, look };
}

/** World direction (from the observer) -> RA/Dec (deg) at local sidereal time `lst`. */
export function worldToRaDec(dir: Vector3, lst: number): [number, number] {
  const M = skyMatrix(lst, new Matrix3()).transpose();
  const e = dir.clone().normalize().applyMatrix3(M);
  const ra = (((Math.atan2(e.y, e.x) / DEG) % 360) + 360) % 360;
  const dec = Math.asin(Math.max(-1, Math.min(1, e.z))) / DEG;
  return [ra, dec];
}

/*
 * The galaxy of fig. 11 (docs/STORY.md "Again"; figures/galaxy.ts): the Milky Way seen from outside, a barred spiral at
 * three quarters, our system's star out on one of its arms. It is built from the sky's own motes, each placed
 * along its own line of sight (glsl/finale.ts GAL_HOME), and set in the real galactic frame at the visit's sidereal
 * time, so when the camera falls back to the observer in fig. 12 every mote only slides along its line of sight into
 * its place in the sky: the galaxy, seen from inside, already is tonight's Milky Way.
 *
 * Local galactic coordinates (world units), origin at our star: x toward the galactic centre (l 0), y toward l 90, z
 * toward the north galactic pole. Galactocentric q = (x - RS, y) / RS: the centre at 0, our star at (-1, 0).
 */
export const GAL = {
  /** Our star's distance from the galactic centre (world units). */
  RS: 1000,
  /** Arms: log spirals of this pitch (rad); the bar's angle (rad, galactocentric; its near end at positive l). */
  pitch: (14 * Math.PI) / 180,
  bar: (-27 * Math.PI) / 180,
  /** Where the major arms leave the bar's ends (RS units) and their phase: set so one runs through our star. */
  r0: 0,
  ph0: 0,
  /** How far the disk reaches (RS units); the far field of stars behind it (world units from our star). */
  edge: 1.8,
  far: 6500,
  /** galactic -> equatorial (constant), and galactic -> world at the visit's sidereal time (the sky's rest frame). */
  g2e: new Matrix3(),
  M: new Matrix3(),
  /** The galactic axes in the world (unit): toward the centre, toward l 90, the north pole. */
  gx: new Vector3(1, 0, 0),
  gy: new Vector3(0, 1, 0),
  gn: new Vector3(0, 0, 1),
  /** Bumped when the frame is set, so views computed from it refresh. */
  version: 0,
};
{
  const cot = 1 / Math.tan(GAL.pitch);
  // a major arm leaves each end of the bar (phase = the bar's angle at R0) and one of them runs through our star
  // (R 1, angle π): R0 = exp(-(π - bar) / cot), near the bar's end
  GAL.r0 = Math.exp(-(Math.PI - GAL.bar) / cot);
  GAL.ph0 = GAL.bar;
  const c0 = eqVec(...galToEq(0, 0), new Vector3());
  const c1 = eqVec(...galToEq(90, 0), new Vector3());
  const c2 = eqVec(...galToEq(0, 90), new Vector3());
  GAL.g2e.set(c0.x, c1.x, c2.x, c0.y, c1.y, c2.y, c0.z, c1.z, c2.z);
}

/** Set the galaxy's world frame from the sky's rest rotation (skyMatrix at the visit's sidereal time). */
export function setGalaxyFrame(skyM: Matrix3) {
  GAL.M.multiplyMatrices(skyM, GAL.g2e);
  const e = GAL.M.elements;
  GAL.gx.set(e[0], e[1], e[2]).normalize();
  GAL.gy.set(e[3], e[4], e[5]).normalize();
  GAL.gn.set(e[6], e[7], e[8]).normalize();
  GAL.version++;
}

/** The arms' strength at galactocentric (qx, qy) (RS units), 0..~1: two major arms off the bar, two minor between. */
export function galArms(qx: number, qy: number) {
  const R = Math.hypot(qx, qy);
  const th = Math.atan2(qy, qx);
  const phi = th - Math.log(Math.max(R, 0.08) / GAL.r0) / Math.tan(GAL.pitch);
  const m2 = 0.5 + 0.5 * Math.cos(2 * (phi - GAL.ph0));
  const arms = m2 ** 5 + 0.7 * (1 - m2) ** 9;
  const a = Math.min(1, Math.max(0, (R - 0.16) / 0.26));
  const b = Math.min(1, Math.max(0, (R - 1.55) / 0.45));
  return arms * a * a * (3 - 2 * a) * (1 - b * b * (3 - 2 * b));
}
