/**
 * The planetary system in GLSL (docs/STORY.md figs 4-7; figures/system.ts places the planets in uPlanet and their
 * orbits in uOrb). ORBITS: each orbit's lane in the dust (gapR, read by the disk's gaps in the motes, glsl/genesis.ts,
 * and in the gas, nebula.ts), so the lanes follow the messy, precessing ellipses of fig. 4 and settle with the rings of
 * fig. 5. SYSTEM: which planet a disk radius condenses into (the bands of constants.ts PLANETS, the belt between).
 * SYSTEM_SIM: a disk mote streams along its orbit to its planet, then gathers into the ball (the giant's share into
 * its rings); the belt follows the orbits either side of it and tightens as the visitor's hold deepens the sun's pull
 * (uPull, fig. 5); once its planet is solid a planet's dust rides with its ball (planetLock). SYSTEM_POINTS: the dust
 * takes the colour of the world it becomes, then the solid sphere takes over.
 */
import { BELT, GIANT_RING_N, PLANETS } from "../constants";
import { glf } from "./common";

const P = PLANETS;
const GN = GIANT_RING_N.map((v) => v.toFixed(3)).join(", ");

/**
 * The orbits' lanes (shared by the sim and the gas): uOrb[k] = (a (1 - e²), e cos ϖ, e sin ϖ, a) of planet k's
 * ellipse this frame (a its semi-major axis, e its eccentricity, ϖ its longitude of periapsis; 0 until the system has
 * placed them), so the lane needs no trigonometry per sample: r(φ) = a (1 - e²) / (1 + e cos(φ - ϖ)).
 */
export const ORBITS = /* glsl */ `
uniform vec4 uOrb[5];
/** The radius of planet k's orbit toward the disk-plane direction of w (an offset from the sun). */
float gapR(int k, vec3 w) {
  vec4 o = uOrb[k];
  return o.x / (1.0 + (o.y * w.x + o.z * w.z) / max(length(w.xz), 1e-3));
}
`;

/**
 * Shared by the sim and the points: the planet a disk radius condenses into (5 = the belt), and how solid the planets
 * are (0..1, figures/system.ts: a touch after the spheres, so no planet is ever empty).
 */
export const SYSTEM = /* glsl */ `
${ORBITS}
uniform float uPlanetSolid;
float bandOf(float rd) {
  if (rd < ${glf(P[0].band[1])}) return 0.0;
  if (rd < ${glf(P[1].band[1])}) return 1.0;
  if (rd < ${glf(P[2].band[1])}) return 2.0;
  if (rd < ${glf(BELT[1])}) return 5.0;
  if (rd < ${glf(P[3].band[1])}) return 3.0;
  return 4.0;
}
`;

export const SYSTEM_SIM = /* glsl */ `
uniform float uPull;

/** The belt: it follows the orbits either side of it (the world's, the giant's) and tightens under the pull. */
vec3 beltTarget(vec3 P) {
  vec3 w = P - uSun;
  if (uOrb[2].w > 0.0 && uOrb[3].w > 0.0) w.xz *= 0.5 * (gapR(2, w) / uOrb[2].w + gapR(3, w) / uOrb[3].w);
  w.xz *= 1.0 - 0.045 * uPull;
  w.y *= 1.0 - 0.6 * uPull;
  return uSun + w;
}

/** A disk mote streams along its orbit to the planet its band feeds, then gathers into the ball (pk: 0..1). */
vec3 clumpTarget(float id, vec3 P, float pk, vec3 q) {
  float b = bandOf(diskR(length(q.xz), 1.0));
  if (b > 4.5) return beltTarget(P);
  vec4 pl = uPlanet[int(b)];
  vec3 rel = P - uSun;
  vec3 prel = pl.xyz - uSun;
  float aM = atan(rel.z, rel.x);
  float aP = atan(prel.z, prel.x);
  float da = aP - aM;
  da -= 6.2831853 * floor((da + PI) / 6.2831853);
  float e1 = smoothstep(0.0, 0.72, pk);
  float e2 = smoothstep(0.38, 1.0, pk);
  float a = aM + da * e1;
  float r = mix(length(rel.xz), length(prel.xz), e1);
  vec3 orbitP = uSun + vec3(cos(a) * r, mix(rel.y, prel.y, e1), sin(a) * r);
  vec3 ball;
  if (b > 2.5 && b < 3.5 && hsh(id, 72u) < 0.42) {
    // the giant's rings
    vec3 n = normalize(vec3(${GN}));
    vec3 t1 = normalize(cross(n, vec3(0.0, 0.0, 1.0)));
    vec3 t2 = cross(n, t1);
    float ra = pl.w * (1.45 + 0.95 * sqrt(hsh(id, 73u)));
    float aa = hsh(id, 74u) * 6.2831853 + uTime * 0.3 * pow(ra / pl.w, -1.5) * uMotion;
    ball = pl.xyz + (t1 * cos(aa) + t2 * sin(aa)) * ra + n * (hsh(id, 75u) - 0.5) * 0.05 * pl.w;
  } else {
    ball = pl.xyz + hdir(id, 70u) * pl.w * (0.62 + 0.42 * pow(hsh(id, 71u), 0.35));
  }
  return mix(orbitP, ball, e2);
}

/**
 * How much a condensing mote (q: its rest home, as clumpTarget takes it) rides with its planet this frame (0..1): once
 * the planet is solid its dust (the giant's rings too)
 * stays on the ball. A spring trails a moving target by about 1.75 v / om (simShaders.ts), so while the scroll carries
 * the planets along their orbits (figs 4-7) the dust would follow each sphere as a second ball until the scroll
 * stopped. The belt keeps its spring (no body to double), and so does every mote once genesis lets it go (the park,
 * the wait in the sky).
 */
float planetLock(Ph ph, vec3 q) {
  if (uPlanetSolid <= 0.0 || bandOf(diskR(length(q.xz), 1.0)) > 4.5) return 0.0;
  return uPlanetSolid * ph.gen;
}
`;

export const SYSTEM_POINTS = /* glsl */ `
/** The colours the planets condense with (kind 0..4, 5 = belt dust). */
vec3 planetTint(float b) {
  if (b < 0.5) return vec3(1.0, 0.36, 0.1);
  if (b < 1.5) return vec3(1.0, 0.78, 0.45);
  if (b < 2.5) return vec3(0.45, 0.68, 1.0);
  if (b < 3.5) return vec3(1.0, 0.82, 0.55);
  if (b < 4.5) return vec3(0.62, 0.85, 1.0);
  return vec3(0.72, 0.6, 0.48);
}

/** Planets condense: the dust takes the colour of the world it becomes, then the solid sphere takes over. */
void planetLook(float id, vec4 N, Ph ph, inout vec3 c, inout float px, inout float vis) {
  float b = bandOf(diskR(length(N.xyz.xz), 1.0));
  vec3 tint = planetTint(b);
  c = mix(c, tint * (0.5 + 1.4 * pow(hsh(id, 66u), 2.0)) * (0.6 + 0.6 * uIgnite), ph.pk * (b > 4.5 ? 0.6 : 0.85));
  bool ring = b > 2.5 && b < 3.5 && hsh(id, 72u) < 0.42;
  if (b < 4.5) vis = 1.0 - uPlanetSolid * (ring ? 0.45 : 0.9);
  else {
    c *= 0.7;
    px *= 0.85;
  }
}
`;
