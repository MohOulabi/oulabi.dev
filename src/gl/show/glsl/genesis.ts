/**
 * Genesis in GLSL (docs/STORY.md figs 1-3; figures/genesis.ts drives every uniform here).
 *
 * GENESIS: the maps between the nebula's rest space and the disk, shared by the motes (forward) and the gas volume
 * (inverse, nebula.ts), so the dust rides the gas. GENESIS_SIM: where a genesis mote wants to be (the cloud, the
 * disk, the sun's cavity and the gaps the planets sweep; the planets' clumps are glsl/system.ts), and the forces of
 * fig. 1 (the hold's spiral, the cursor's pull on the sky, the bang's impulse); STIR: fig. 2's hand through the gas and
 * the dust (one field for both).
 * GENESIS_POINTS: the dust's colour and size, the heat of the bang, the hold's lens and its shrink into the core.
 *
 * Fig. 3 (figures/genesis.ts center): the three knots are dense cores of the nebula (KNOT_DEFS, also read by the gas,
 * nebula.ts NEB_FIELD), each holding a share of the motes by its mass in a turning disk (genHome, knotHome), and as
 * they kindle gathering the dust around them, the heaviest from farthest (uKnot[1].w). The fall carries each knot's
 * motes into the chosen one (uKnot: the core's displacement, its outskirts lagging behind as a tidal tail) and slides
 * the whole field so the chosen knot reaches the sun (uFallOff), before the collapse map: fallMap for the motes,
 * unfallMap for the gas (whose knots are drawn where they are now). Fig. 2's hundred clumps (the versions) hold
 * another share of the motes.
 */
import { DISK_INNER, DISK_SHRINK } from "../constants";
import { CLUMPS, EDDY_DEEP, GROUP_DRIFT, KNOTS } from "../figures/genesis";
import { glf } from "./common";

const v3 = (p: readonly number[]) => `vec3(${glf(p[0])}, ${glf(p[1])}, ${glf(p[2])})`;
const f3 = (k: (i: number) => number) => `float[3](${glf(k(0))}, ${glf(k(1))}, ${glf(k(2))})`;

/**
 * The knots' constants (figures/genesis.ts KNOTS), shared by the genesis maps and the gas's field (guarded: both are
 * in the gas's shader). KNOT_P: rest offset from the sun; KNOT_E: the envelope (gas, dust and motes) radius;
 * KNOT_M / KNOT_G: the dust and the glowing gas gathered there; KNOT_C: the colour of its light; KNOT_EW: how fast
 * its light falls off in the gas (per envelope squared); KNOT_CUT: how far (envelopes squared) the gas term reaches.
 */
export const KNOT_DEFS = /* glsl */ `
#ifndef GEN_KNOTS
#define GEN_KNOTS
const vec3 KNOT_P[3] = vec3[3](${KNOTS.map((k) => v3(k.at)).join(", ")});
const float KNOT_E[3] = ${f3((i) => KNOTS[i].env)};
const float KNOT_M[3] = ${f3((i) => KNOTS[i].dust)};
const float KNOT_G[3] = ${f3((i) => KNOTS[i].glow)};
const vec3 KNOT_C[3] = vec3[3](${KNOTS.map((k) => v3(k.col)).join(", ")});
const float KNOT_B[3] = ${f3((i) => KNOTS[i].moteB)};
const float KNOT_EW[3] = ${f3((i) => 1 / (0.5 * KNOTS[i].reach ** 2))};
const float KNOT_CUT[3] = ${f3((i) => Math.max(4.4, 3 * 0.5 * KNOTS[i].reach ** 2))};
const vec3 KNOT_N[3] = vec3[3](${KNOTS.map((k) => v3(k.axis)).join(", ")});
const float KNOT_FL[3] = ${f3((i) => KNOTS[i].flat)};
const float KNOT_W[3] = ${f3((i) => KNOTS[i].spin)};
const float KNOT_SW[3] = ${f3((i) => KNOTS[i].sweep)};
#endif
`;

/** The genesis maps, shared by the motes (forward) and the gas volume (inverse), so the dust rides the gas. */
export const GENESIS = /* glsl */ `
uniform vec3 uSun;
uniform float uCollapse;
uniform float uSpinC;
uniform float uCavity;
uniform float uIgnite;
uniform float uExpand;
uniform vec3 uBangOff;
uniform float uWindK;
uniform float uGap;
// fig. 3: the field's slide (rest space) and the knots: [i] the core's displacement, [3 + i] its outskirts', [6 + i]
// the knot's place in the world now and the light it throws on the dust around it; [0].w the cloud's own light
// (lowered while the knots shine, so they carry the frame)
uniform vec3 uFallOff;
uniform vec4 uKnot[9];
${KNOT_DEFS}

/**
 * The knots' fall and the field's slide: a rest offset (after the bang's expansion) -> where it has fallen to. A
 * knot's motes (grp 1-3, as far as they have joined it: mem) go with it, its outskirts trailing; the rest of the cloud
 * only slides (the collapse then gathers it into the chosen knot).
 */
vec3 fallMap(vec3 q, float grp, float mem) {
  if (grp > 0.5 && grp < 3.5) {
    int i = int(grp) - 1;
    vec3 dk = q - KNOT_P[i];
    q += mix(uKnot[i].xyz, uKnot[3 + i].xyz, smoothstep(0.3, 2.5, dot(dk, dk) / (KNOT_E[i] * KNOT_E[i]))) * mem;
  }
  return q - uFallOff;
}
/** ...and back for the gas, whose knots are drawn where they are now (nebula.ts NEB_FIELD, GAS_KNOTS). */
vec3 unfallMap(vec3 q) {
  return q + uFallOff;
}

// ---- the motes' homes: most lie in the gas (tNeb); the knots hold a share by their mass, fig. 2's clumps another
const float KNOT_F0 = ${glf(KNOTS[0].share)};
const float KNOT_F1 = ${glf(KNOTS[0].share + KNOTS[1].share)};
const float KNOT_F2 = ${glf(KNOTS[0].share + KNOTS[1].share + KNOTS[2].share)};
const float CLUMP_F = ${glf(KNOTS[0].share + KNOTS[1].share + KNOTS[2].share + CLUMPS.share)};
const vec3 CLUMP_P[4] = vec3[4](${CLUMPS.at.map(v3).join(", ")});
/** Centre and radius of clump j (the first four are the ones the ink tags; the rest scatter through the cloud). */
vec4 clumpAt(float j) {
  if (j < 3.5) return vec4(CLUMP_P[int(j)], ${glf(CLUMPS.r)});
  vec3 d = hdir(j, 210u);
  return vec4(d * vec3(1.0, 0.74, 1.0) * (22.0 + 50.0 * pow(hsh(j, 213u), 0.8)), 1.7 + 1.8 * hsh(j, 214u));
}
/** Where a knot keeps the dust it holds: a ball for the loud one, a disk round the heavy ones (thicker at the core). */
vec3 knotHome(float id, int i) {
  vec3 o = hdir(id, 201u) * KNOT_E[i] * (0.1 + 1.2 * pow(hsh(id, 203u), mix(1.45, 0.95, KNOT_FL[i])));
  vec3 n = KNOT_N[i];
  o -= n * dot(o, n) * KNOT_FL[i] * smoothstep(0.1, 0.6, length(o) / KNOT_E[i]);
  // ...and it turns round the knot, faster inside, as an orbit does (show time: still under reduced motion)
  float a = uTime * KNOT_W[i] * pow(clamp(length(o) / KNOT_E[i], 0.3, 2.0), -1.5);
  float ca = cos(a);
  float sa = sin(a);
  return KNOT_P[i] + o * ca + cross(n, o) * sa + n * dot(n, o) * (1.0 - ca);
}
/**
 * The rest home of mote id (home: its place in the gas), the group it belongs to (grp: 0 none, 1-3 knot grp - 1,
 * 4 a clump), the group's centre (the group drifts as one), and how far it has joined it (mem 0..1). A knot holds its
 * own share of the motes from the start; as it kindles (uKnot[1].w) it gathers the dust around it, from as far as its
 * mass reaches (KNOT_SW envelopes), the nearest first, each mote in its own time.
 */
vec3 genHome(float id, vec3 home, out float grp, out vec3 cen, out float mem) {
  float h = hsh(id, 200u);
  grp = 0.0;
  cen = home;
  mem = 1.0;
  if (h < KNOT_F2) {
    int i = h < KNOT_F0 ? 0 : h < KNOT_F1 ? 1 : 2;
    cen = KNOT_P[i];
    grp = float(i + 1);
    return knotHome(id, i);
  }
  if (h < CLUMP_F) {
    float f = hsh(id, 204u);
    // the tagged four hold more of the clumps' motes than the rest
    float j = f < ${glf(CLUMPS.tagged)} ? floor(f / ${glf(CLUMPS.tagged)} * 4.0) : 4.0 + floor((f - ${glf(CLUMPS.tagged)}) / ${glf(1 - CLUMPS.tagged)} * ${glf(CLUMPS.n - 4)});
    vec4 cl = clumpAt(j);
    cen = cl.xyz;
    grp = 4.0;
    return cen + hdir(id, 205u) * cl.w * pow(hsh(id, 207u), 0.75);
  }
  mem = 0.0;
  float sw = uKnot[1].w;
  if (sw <= 0.0) return home;
  int i = -1;
  float best = 1.0;
  for (int k = 0; k < 3; k++) {
    float x = length(home - KNOT_P[k]) / (KNOT_E[k] * KNOT_SW[k]);
    if (x < best) {
      best = x;
      i = k;
    }
  }
  if (i < 0) return home;
  float st = 0.55 * best + 0.25 * hsh(id, 208u);
  mem = smoothstep(st, st + 0.3, sw);
  if (mem <= 0.0) return home;
  cen = KNOT_P[i];
  grp = float(i + 1);
  return mix(home, knotHome(id, i), mem);
}

// ---- the nebula's rest space (relative to the sun) <-> the disk ----
float diskR(float r0, float c) { return r0 * (1.0 - ${glf(DISK_SHRINK)} * c) + ${glf(DISK_INNER)} * c; }
float diskR0(float r, float c) { return max(r - ${glf(DISK_INNER)} * c, 0.0) / (1.0 - ${glf(DISK_SHRINK)} * c); }
/** Keplerian shear: the winding the collapse adds (rad), and the spin per second of the spin clock. */
float diskWind(float r) { return 2.6 * pow(max(r, 4.5) / 30.0, -1.5); }
float diskOmega(float r) { return 0.075 * pow(max(r, 4.5) / 30.0, -1.5); }
/** Half-thickness of the disk relative to the cloud, flared outward. */
float diskH(float r) { return 0.026 + 0.055 * clamp(r / 80.0, 0.0, 1.0); }
/** As the orbits settle (uWindK), the arms wind on into rings. */
float diskAngle(float r, float c) { return c * (diskWind(r) * (1.0 + 2.2 * uWindK) + diskOmega(r) * uSpinC); }

/** Rest offset q (nebula) -> offset from the sun after a collapse c (the motes). */
vec3 collapseMap(vec3 q, float c) {
  float r0 = length(q.xz);
  float a0 = atan(q.z, q.x);
  float r = diskR(r0, c);
  float a = a0 + diskAngle(r, c);
  return vec3(cos(a) * r, q.y * mix(1.0, diskH(r), c), sin(a) * r);
}
/** Offset from the sun -> rest offset (the gas inverts the map). */
vec3 restOf(vec3 w, float c) {
  float r = length(w.xz);
  float a = atan(w.z, w.x) - diskAngle(r, c);
  float r0 = diskR0(r, c);
  return vec3(cos(a) * r0, w.y / mix(1.0, diskH(r), c), sin(a) * r0);
}
/** Just after the bang the cloud is small and centred on the bang point; it grows into place as it cools. */
vec3 expandRest(vec3 q) {
  float e = max(uExpand, 0.04);
  return q * e + uBangOff * (1.0 - e);
}
vec3 unexpandRest(vec3 q) {
  float e = max(uExpand, 0.04);
  return (q - uBangOff * (1.0 - e)) / e;
}
/** Where a mote's home has fallen to (rest space, before the collapse): the planets condense by it (glsl/system.ts). */
vec3 genesisRest(float id, vec3 home) {
  float grp;
  vec3 cen;
  float mem;
  vec3 q = genHome(id, home, grp, cen, mem);
  return fallMap(expandRest(q), grp, mem);
}
`;

/**
 * Fig. 2's stir (figures/genesis.ts stir): a hand through smoke, one field shared by the gas (nebula.ts reads it
 * inverse: where the gas at p came from) and the dust (forward: where a mote's place is carried), so the dust rides
 * the gas. It is local to the hand: a soft ellipsoid round where the pointer's ray meets the visible gas (uStirP.xyz,
 * radius uStirP.w across the ray; along the ray uStirA.xyz only uStirA.w deep), never the whole ray. The stroke carries
 * the gas along (uStirD.xyz) and parts it (uStirD.w), both a bounded fraction of the radius, so the map never folds; a
 * drag leaves eddies (uVortA: centre, radius; uVortB: axis, the angle it has turned, rad, bounded), each as local
 * along its axis. uStirP.w = 0: no stir (the shaders skip it, eddies too).
 */
export const STIR = /* glsl */ `
#ifndef GEN_STIR
#define GEN_STIR
uniform vec4 uStirP;
uniform vec4 uStirA;
uniform vec4 uStirD;
uniform vec4 uVortA[6];
uniform vec4 uVortB[6];
/** The stroke's displacement at p: the carry along, and the parting away from the hand's line. */
vec3 stirStroke(vec3 p) {
  vec3 rel = p - uStirP.xyz;
  float z = dot(rel, uStirA.xyz);
  vec3 lat = rel - uStirA.xyz * z;
  float g = exp(-dot(lat, lat) / (uStirP.w * uStirP.w) - z * z / (uStirA.w * uStirA.w));
  return (uStirD.xyz + lat * (uStirD.w / uStirP.w)) * g;
}
/** Eddy k turns p round its axis by its angle times its reach (sgn -1 turns it back: the exact inverse). */
vec3 stirEddy(vec3 p, int k, float sgn) {
  vec4 A = uVortA[k];
  vec4 B = uVortB[k];
  vec3 rel = p - A.xyz;
  float z = dot(rel, B.xyz);
  vec3 rad = rel - B.xyz * z;
  float ang = sgn * B.w * exp(-(dot(rad, rad) + z * z * ${glf(1 / EDDY_DEEP ** 2)}) / (A.w * A.w));
  float c = cos(ang);
  float s = sin(ang);
  return A.xyz + B.xyz * z + rad * c + cross(B.xyz, rad) * s;
}
/** Forward: where the stir carries a rest point (the motes' places). */
vec3 stirFwd(vec3 p) {
  if (uStirP.w <= 0.0) return p;
  p += stirStroke(p);
  for (int k = 0; k < 6; k++) {
    if (uVortB[k].w != 0.0) p = stirEddy(p, k, 1.0);
  }
  return p;
}
/** Inverse: the rest point the gas at p was carried from (the eddies undone last first, then the stroke). */
vec3 stirBack(vec3 p) {
  if (uStirP.w <= 0.0) return p;
  for (int k = 5; k >= 0; k--) {
    if (uVortB[k].w != 0.0) p = stirEddy(p, k, -1.0);
  }
  vec3 q = p - stirStroke(p);
  return p - stirStroke(q);
}
#endif
`;

/** The sim's share: genesis targets and forces (after SIM_COMMON: uses uMotion and the pointer's ray). */
export const GENESIS_SIM = /* glsl */ `
// the hold and the bang
uniform float uHoldK;
uniform vec3 uHoldP;
uniform vec3 uHoldAxis;
uniform float uImpulse;
uniform vec3 uBangP;
uniform float uPointer;
${STIR}

/** A knot or a clump drifts as one (figures/genesis.ts groupDrift mirrors it for the ink). */
vec3 groupDrift(vec3 c) {
  float t = uTime;
  return vec3(sin(t * 0.11 + c.x * 0.07 + 1.3), 0.6 * sin(t * 0.083 + c.z * 0.07), cos(t * 0.097 + c.y * 0.07)) * ${glf(GROUP_DRIFT)};
}

/** Genesis: the nebula (rest home in tNeb), gathered into the disk, cleared by the sun, its gaps swept by the planets. */
vec3 genesisTarget(float id, vec4 N, Ph ph) {
  float grp;
  vec3 cen;
  float mem;
  vec3 home = genHome(id, N.xyz, grp, cen, mem);
  vec3 q = fallMap(expandRest(home), grp, mem);
  float c = uCollapse;
  vec3 w = collapseMap(q, c);
  // the cloud billows (time-based), stilled as the disk forms; the knots and the clumps drift as one
  float bw = (1.0 - c) * uMotion;
  if (bw > 0.001) {
    if (grp > 0.5) w += groupDrift(cen) * bw * mem;
    if (mem < 1.0) {
      vec3 nq = N.xyz * 0.017 + vec3(0.0, 0.0, uTime * 0.03);
      w += vec3(snoise(nq), snoise(nq + 17.0), snoise(nq + 41.0)) * 4.5 * bw * (1.0 - mem);
    }
  }
  // radiation pressure: the new sun clears the inner disk and the dust piles up into a glowing ring at the rim
  if (uCavity > 0.0) {
    float r = length(w.xz);
    float rc = uCavity * (1.0 + 0.18 * hsh(id, 61u) * hsh(id, 62u));
    if (r < rc) {
      w.xz *= rc / max(r, 0.05);
      w.y *= 0.3;
    }
  }
  // the planets sweep their orbits clear: the dust piles into bright rings either side of each gap
  if (uGap > 0.0) {
    float r = length(w.xz);
    float nr = r;
    for (int k = 0; k < 5; k++) {
      float R0 = gapR(k, w);
      float wk = 2.0 + 0.075 * R0;
      float dr = r - R0;
      float a = abs(dr);
      if (a < wk * 1.4) nr = R0 + sign(dr + 1e-4) * mix(a, max(a, wk * (1.08 + 0.3 * hsh(id, 64u + uint(k)))), uGap);
    }
    w.xz *= nr / max(r, 1e-3);
  }
  return uSun + w;
}

/** Press and hold: the whole sky spirals into one point under the finger. Returns how far this mote is taken. */
float holdPull(Ph ph, inout vec3 tgt, inout float om) {
  float g = 0.0;
  if (uFreed < 0.5 && uHoldK > 0.0) {
    g = smoothstep(ph.s * 0.42, ph.s * 0.42 + 0.58, uHoldK);
    tgt = mix(tgt, uHoldP, g);
    om = mix(om, 5.2 + 4.5 * uHoldK * uHoldK, g);
  }
  return g;
}
/** ...and the spiral it turns in on as it goes. */
vec3 holdSwirl(vec3 p, float g) {
  vec3 rel = p - uHoldP;
  return cross(uHoldAxis, rel) * (2.2 * g) / (1.0 + length(rel) * 0.02);
}

/** Cursor gravity: before the bang, near dust drifts toward the pointer's ray. */
vec3 cursorPull(vec3 p, vec4 S, float pre) {
  if (S.w > 2.5 && S.w < 3.5 && pre > 0.0) {
    vec3 w = p - uRayO;
    vec3 q = uRayO + uRayD * max(dot(w, uRayD), 0.0);
    vec3 dq = q - p;
    float dl2 = dot(dq, dq);
    return dq / (dl2 + 2.0) * 22.0 * uPointer * pre;
  }
  return vec3(0.0);
}

/**
 * Fig. 2's stir moves a genesis mote's place with the gas (STIR, forward), so its spring carries it there and back:
 * the dust follows the hand a moment behind the gas, as heavier things do, and never further than the gas goes.
 */
vec3 stirTarget(vec3 tgt, Ph ph) {
  return ph.gen > 0.0 ? mix(tgt, stirFwd(tgt), ph.gen) : tgt;
}

/**
 * The bang: one radial impulse with momentum (the new velocity). Light the hold had not gathered yet (a quick bang)
 * is sent straight on toward its place in the cloud instead of further out, so the blast blooms from the point.
 */
vec3 bangKick(float id, vec3 p, vec3 v, vec3 tgt) {
  vec3 out1 = p - uBangP;
  vec3 dir = normalize(normalize(out1 + hdir(id, 20u) * 0.6) * 0.4 + hdir(id, 22u) * 0.6);
  float spd = mix(9.0, 64.0, pow(hsh(id, 24u), 1.7));
  float far = smoothstep(24.0, 70.0, length(out1)) * (1.0 - step(uN - uStarN, id));
  return mix(v * 0.15 + dir * spd, (tgt - p) * 0.75 + dir * spd * 0.25, far) * uImpulse;
}
`;

/** The points draw's share: the dust's look, the bang's heat, the hold's lens and shrink (after POINTS_COMMON). */
export const GENESIS_POINTS = /* glsl */ `
uniform float uFreedK;
uniform float uHeat;
uniform float uLensE;
uniform vec2 uLensC;
uniform float uHoldK;
uniform vec3 uHoldP;
uniform float uCoreR;
uniform float uGenDim;
// the sun's shock of first light through the disk: radius from the sun (world units), strength, front width
uniform vec4 uShock;
// fig. 2: each tagged clump's bud as the ink writes its version (figures/genesis.ts clumps)
uniform vec4 uClumpB;

/** The nebula's dust and the disk (N: the mote's rest home and the gas density there). */
void genesisLook(float id, vec4 N, vec3 p, float wpx, out vec3 c, out float px) {
  float grp;
  vec3 cen;
  float mem;
  vec3 home = genHome(id, N.xyz, grp, cen, mem);
  float hc = hsh(id, 63u);
  vec3 base = hc < 0.42 ? vec3(1.0, 0.34, 0.1) : hc < 0.8 ? vec3(1.0, 0.68, 0.34) : hc < 0.93 ? vec3(1.0, 0.92, 0.8) : vec3(0.45, 0.62, 1.0);
  float bright = 0.1 + 2.0 * pow(hsh(id, 64u), 3.4);
  bright *= 0.3 + 0.6 * clamp(mix(N.w, 1.0, grp > 0.5 ? mem : 0.0), 0.0, 1.6);
  // the cluster at the heart lights the dust around it, gold-white; the outskirts stay ember
  float heart = 1.0 / (1.0 + dot(home, home) / 1300.0);
  base = mix(base * vec3(1.0, 0.7, 0.6), mix(base, vec3(1.0, 0.86, 0.66), 0.5), smoothstep(0.2, 0.7, heart));
  // a sparkle in the cloud, not a spray: most dust stays faint, the heart a little brighter
  bright *= (0.4 + 0.75 * heart) * 0.75;
  // fig. 2's clumps read as clumps (the tagged four bud as their versions are written); a knot's dust is as dense as
  // its mass, each mote of it faint
  float bud = 0.0;
  if (grp > 3.5) {
    bright *= 1.35;
    float fj = hsh(id, 204u);
    if (fj < ${glf(CLUMPS.tagged)}) bud = uClumpB[int(floor(fj / ${glf(CLUMPS.tagged)} * 4.0))];
    bright *= 1.0 + 2.4 * bud;
  }
  else if (grp > 0.5) bright *= mix(1.0, KNOT_B[int(grp) - 1], mem);
  bright *= uKnot[0].w;
  // fig. 3: each knot lights the dust around it in its own colour (its light, not its mass: the loud one shines)
  float kl = 0.0;
  vec3 kc = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    vec4 K = uKnot[6 + i];
    if (K.w <= 0.0) continue;
    vec3 dl = p - K.xyz;
    float e = KNOT_E[i] * 1.25;
    float f = K.w / (1.0 + dot(dl, dl) / (e * e));
    kl += f;
    kc += KNOT_C[i] * f;
  }
  if (kl > 0.001) {
    base = mix(base, kc / kl, min(kl, 1.0) * 0.6);
    bright *= 1.0 + kl * 1.6;
  }
  // the new sun lights the disk: hotter and whiter toward it, the cleared rim burning brightest
  vec3 rel = p - uSun;
  float rs = length(rel);
  float lit = uIgnite * (1.5 / (1.0 + rs * rs / 380.0));
  bright *= 1.0 - 0.45 * uCollapse;
  // the disk's dust runs warm: gold and ember, white only where the sun is close
  base = mix(base, hc < 0.55 ? vec3(1.0, 0.42, 0.14) : vec3(1.0, 0.7, 0.36), 0.6 * uCollapse);
  float rim = uIgnite * exp(-pow((length(rel.xz) - uCavity * 1.08) / (0.12 * max(uCavity, 1.0)), 2.0)) * 3.0;
  // before the sun, the collapsing heart glows
  float core = (1.0 - uIgnite) * uCollapse * 1.6 / (1.0 + rs * rs / 90.0);
  // the shock of first light: the dust flares as the front passes it (gold at the front, ember just behind)
  float shock = 0.0;
  if (uShock.y > 0.0) {
    float sx = (length(rel.xz) - uShock.x) / uShock.z;
    shock = uShock.y * (exp(-sx * sx) * 4.0 + exp(-max(-sx, 0.0) * 0.35) * step(sx, 0.0) * 0.4) * (1.0 - smoothstep(0.55, 1.0, uShock.x / 60.0));
  }
  c = base * bright * (1.0 + lit + core) + vec3(1.0, 0.86, 0.6) * (rim + lit * 0.4) * bright + vec3(1.0, 0.66, 0.32) * shock * bright;
  px = (0.085 + 0.07 * hsh(id, 65u)) * wpx * (1.0 + 0.3 * bud);
}

/** Heat from the bang: the fastest motes burn ember, then cool to lamplight (sp: the mote's speed). */
void bangHeat(float sp, Ph ph, float wSky, float post, inout vec3 col, inout float px) {
  float heat = uHeat * (0.3 + 0.7 * smoothstep(3.0, 40.0, sp));
  // blackbody-ish: the fastest burn yellow-white, the rest cool through orange to a deep ember
  vec3 hot = mix(vec3(1.0, 0.3, 0.06) * 2.4, vec3(1.0, 0.78, 0.46) * 3.8, smoothstep(0.3, 1.0, heat));
  hot = mix(hot, vec3(1.0, 0.08, 0.01) * 2.6, smoothstep(0.7, 1.0, uHeat) * 0.6);
  col = mix(col, hot * (0.55 + min(dot(col, vec3(0.4)), 1.5)), smoothstep(0.0, 0.45, heat) * 0.92 * (1.0 - ph.sky * (1.0 - uFreed)));
  px = mix(px, min(px, 3.2 * uDpr), smoothstep(0.0, 0.3, uHeat));
  // the flung light burns bright for the first seconds
  col *= 1.0 + 2.4 * uHeat * (wSky + post);
}

/** Gravity bends starlight around the pointer (an Einstein ring), stronger as the sky is pulled in. */
void holdLens(bool celestial, float wSky, inout vec4 clip, inout float bright) {
  if (celestial && uLensE > 0.0 && wSky > 0.0) {
    vec2 ndc = clip.xy / clip.w;
    vec2 d = (ndc - uLensC) * vec2(uAspect, 1.0);
    float r = length(d) + 1e-5;
    float e2 = uLensE * uLensE * wSky;
    float q = sqrt(r * r + 4.0 * e2);
    float rp = 0.5 * (r + q);
    float mu = (rp / r) * 0.5 * (1.0 + r / q);
    ndc = uLensC + (d * (rp / r)) / vec2(uAspect, 1.0);
    clip.xy = ndc * clip.w;
    bright *= min(mu, 3.0);
  }
}

/** The hold: sprites shrink toward the singularity (overdraw) and vanish into the core glow. */
void holdShrink(vec3 p, Ph ph, inout float px, inout float bright) {
  if (uHoldK > 0.0 && uFreed < 0.5) {
    float g = smoothstep(ph.s * 0.42, ph.s * 0.42 + 0.58, uHoldK);
    px *= mix(1.0, 0.3, g);
    float dc = length(p - uHoldP);
    bright *= mix(1.0, smoothstep(uCoreR * 0.6, uCoreR * 2.5, dc), g);
  }
}
`;
