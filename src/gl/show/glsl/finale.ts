/**
 * The finale in GLSL (docs/STORY.md figs 10-12, and the Riyadh sky of fig. 1 that it returns to; figures/flock.ts,
 * figures/galaxy.ts and figures/sky.ts drive the uniforms).
 *
 * LAND: the land under the returning sky (its towns, its edge against the sky, where their glow pools; the backdrop in
 * fx.ts draws it too). FINALE (shared): the deep-space starfield, the world's night side where the flock waits, and
 * the lights on the land (fieldHome: the returning sky's horizon motes land there). FINALE_SIM: the sky's targets, the
 * murmuration's slots, formations and forces (it parts around the cursor once it is free), the galaxy's hold on the
 * motes it draws. FINALE_POINTS: the sky's turn and look, the deep-space stars, the horizon's lights, the flock's look,
 * the galaxy's place and look. GAL_HOME: the one-off pass that gives every mote its home in the galaxy, along its own
 * line of sight. GALAXY_*: the galaxy's own sprites (its disk's glow, its core, the fifty-odd platform stars).
 *
 * The galaxy's shape (sky.ts GAL) is written in from TS; no story time is a literal here.
 */
import { CITIES } from "@/gl/world/layout";
import { GAL } from "../sky";
import { COMMON, glf } from "./common";

/**
 * The world's city lights (src/gl/world/layout.ts CITIES: the real cities of the Middle East, in the planet's rest
 * frame, w how far round it its motes may scatter, never past its coast): the flock's motes wait round them on the
 * night side and rise from them (fig. 10). A mote picks its city from CITY_PICK, a table that holds each city in
 * proportion to its light (squared: the big ones send up most of the flock).
 */
const CITY_PICK_N = 64;
const CITY_PICK = (() => {
  const w = CITIES.map((c) => c.size * c.size);
  const sum = w.reduce((a, b) => a + b, 0);
  const out: number[] = [];
  let k = 0;
  let acc = w[0] / sum;
  for (let j = 0; j < CITY_PICK_N; j++) {
    const u = (j + 0.5) / CITY_PICK_N;
    while (u > acc && k < CITIES.length - 1) acc += w[++k] / sum;
    out.push(k);
  }
  return out;
})();
const CITY_GLSL = /* glsl */ `
const vec4 CITY_AT[${CITIES.length}] = vec4[${CITIES.length}](${CITIES.map((c) => `vec4(${glf(c.dir.x)}, ${glf(c.dir.y)}, ${glf(c.dir.z)}, ${glf(c.spread)})`).join(", ")});
const int CITY_PICK[${CITY_PICK_N}] = int[${CITY_PICK_N}](${CITY_PICK.join(", ")});
`;

/**
 * The land north of the observer under the returning sky (fig. 12; fig. 1's sky stands over it too): the towns on it,
 * as azimuth (rad from north, + toward east), distance and radius (world units from the observer) and how much light
 * each holds. The lights of fig. 12 cluster in them (fieldHome) and the night's glow pools over them on the horizon
 * (fx.ts backdrop: townPools).
 */
const TOWNS: [number, number, number, number][] = [
  [-0.62, 300, 14, 0.4],
  [-0.46, 640, 34, 1.0],
  [-0.18, 820, 24, 0.65],
  [0.04, 470, 16, 0.5],
  [0.27, 700, 46, 1.4],
  [0.56, 380, 15, 0.45],
  [0.84, 860, 32, 0.85],
  [1.35, 600, 26, 0.6],
];

/**
 * The land's GLSL (no uniforms): the towns, the edge of the land against the sky (low dunes and a far escarpment, a
 * few tenths of a degree high, so the horizon is never a ruled line) and where the towns' glow pools along it. d is a
 * unit direction from the observer (world: x east, y up, z south).
 */
export const LAND = /* glsl */ `
#define TOWN_N ${TOWNS.length}
const vec4 TOWNS[TOWN_N] = vec4[TOWN_N](${TOWNS.map((t) => `vec4(${t.map(glf).join(", ")})`).join(", ")});
float landEdge(vec3 d) {
  float az = atan(d.x, -d.z);
  return 0.0012 + 0.0024 * (0.5 + 0.5 * sin(az * 3.1 + 0.7)) * (0.55 + 0.45 * sin(az * 7.3 + 2.1))
    + 0.0007 * sin(az * 17.0 + 1.3) + 0.00035 * sin(az * 43.0 + 0.4);
}
float townPools(vec3 d) {
  float az = atan(d.x, -d.z);
  float s = 0.0;
  for (int i = 0; i < TOWN_N; i++) {
    vec4 T = TOWNS[i];
    float w = T.z / T.y + 0.07;
    float da = az - T.x;
    s += T.w * exp(-da * da / (w * w));
  }
  return min(s, 1.6);
}
`;

/** equatorial -> galactic (the transpose of GAL.g2e), as a GLSL mat3 (column-major). */
const E2G = (() => {
  const e = GAL.g2e.elements;
  return `mat3(${[e[0], e[3], e[6], e[1], e[4], e[7], e[2], e[5], e[8]].map(glf).join(", ")})`;
})();

/** The galaxy's shape, shared by the homes pass and the disk's glow (galactocentric q in RS units). */
const GAL_SHAPE = /* glsl */ `
const float GAL_RS = ${glf(GAL.RS)};
const float GAL_COTP = ${glf(1 / Math.tan(GAL.pitch))};
const float GAL_BAR = ${glf(GAL.bar)};
const float GAL_R0 = ${glf(GAL.r0)};
const float GAL_PH0 = ${glf(GAL.ph0)};

/** The arms: two major ones off the bar's ends (our star is out on one of them), two minor between. */
float galArms(vec2 q) {
  float R = length(q);
  float th = atan(q.y, q.x);
  float phi = th - log(max(R, 0.08) / GAL_R0) * GAL_COTP;
  float m2 = 0.5 + 0.5 * cos(2.0 * (phi - GAL_PH0));
  float arms = pow(m2, 5.0) + 0.7 * pow(1.0 - m2, 9.0);
  return arms * smoothstep(0.16, 0.42, R) * (1.0 - smoothstep(1.55, 2.0, R));
}

/** The bar: an elongated core along GAL_BAR. */
float galBar(vec2 q) {
  vec2 b = rot2(q, -GAL_BAR);
  return exp(-0.5 * (b.x * b.x / 0.09 + b.y * b.y / 0.0081));
}

/** How much light the galaxy holds at q (in its plane): the bulge, the bar, the disk lifted by the arms. */
float galRho(vec2 q) {
  float R = length(q);
  float bulge = exp(-0.5 * R * R / 0.0121);
  float disk = exp(-R / 0.5) * (1.0 - smoothstep(1.6, 2.0, R));
  return 2.6 * bulge + 1.1 * galBar(q) + disk * (0.16 + 2.6 * galArms(q));
}
`;

/** Shared by the sim and the points. */
export const FINALE = /* glsl */ `
/** Deep space (from the bang on): a far sphere around the sun, a third of it squeezed into a tilted galactic band. */
vec3 farStar(float id) {
  vec3 dir = hdir(id, 50u);
  if (hsh(id, 52u) < 0.42) {
    vec3 n = normalize(vec3(0.42, 0.78, -0.46));
    float k = dot(dir, n);
    dir = normalize(dir - n * k * (0.86 + 0.13 * hsh(id, 53u)));
  }
  return uSun + dir * (620.0 + 420.0 * hsh(id, 54u));
}

${CITY_GLSL}
/** The visitor's drag has turned the world this far about its axis (figures/flock.ts, from shared.earth.turn). */
uniform mat3 uWorldTurn;
/**
 * The world's night side (it faces +z): where the flock waits, hidden, before it rises: round its city lights, each
 * mote at one city, scattered over its towns (wider round the bigger ones, never onto the sea), so the lights are what
 * lift off, wherever the drag has turned them.
 */
vec3 nightSide(float id) {
  vec4 W = uPlanet[2];
  vec4 c = CITY_AT[CITY_PICK[min(${CITY_PICK_N - 1}, int(hsh(id, 81u) * ${glf(CITY_PICK_N)}))]];
  vec3 o = hdir(id, 80u);
  o -= c.xyz * dot(o, c.xyz);
  // (|o| <= 1: no mote strays further than the city's spread)
  vec3 d = normalize(c.xyz + o * c.w * sqrt(hsh(id, 82u)));
  return W.xyz + uWorldTurn * d * W.w * 1.004;
}

${LAND}

/**
 * Home of mote id among the lights on the land of the returning sky (fig. 12), on the ground north of the observer:
 * most in the towns (LAND), clustered round each one's heart; some strung along a road that runs out from near the
 * eye to the far towns; the rest lone farms over the plain, sparser near the eye. Only a share of them light
 * (lightsLook): tiny, far, a few hundred px of the frame under the horizon.
 */
vec3 fieldHome(float id) {
  float h = hsh(id, 5u);
  vec2 q;
  if (h < 0.6) {
    vec4 T = TOWNS[int(floor(hsh(id, 6u) * float(TOWN_N)))];
    float r = T.z * pow(hsh(id, 7u), 0.7);
    float a = hsh(id, 8u) * 6.2831853;
    q = vec2(sin(T.x), -cos(T.x)) * T.y + vec2(cos(a), sin(a) * 0.7) * r;
  } else if (h < 0.75) {
    float t = hsh(id, 9u);
    q = mix(vec2(-34.0, -22.0), vec2(330.0, -650.0), t * t) + (vec2(hsh(id, 10u), hsh(id, 11u)) - 0.5) * 3.0;
  } else {
    float az = (hsh(id, 12u) - 0.5) * 2.8;
    q = vec2(sin(az), -cos(az)) * (45.0 + 855.0 * sqrt(hsh(id, 13u)));
  }
  return vec3(uObs.x + q.x, uGround + 0.04 + 0.12 * hsh(id, 14u), uObs.z + q.y);
}

/**
 * How much of mote id's drawn place is its place in the galaxy (fig. 11): all of it for a mote that came out of
 * hiding (it lights where it belongs), its weight for one that slides from a visible place (into the sky, at the end).
 */
float galaxyHold(Ph ph) {
  return ph.gal > 0.0 ? min(1.0, ph.gal / max(1.0 - ph.hide, 1e-4)) : 0.0;
}
`;

/** The sim's share (after SIM_COMMON). */
export const FINALE_SIM = /* glsl */ `
// ---- the sky (figs 1 and 12) ----
uniform mat3 uSkyM;

vec3 skyTarget(vec4 S) {
  return S.w < 2.5 ? uObs + uSkyM * S.xyz : uObs + S.xyz;
}

/** The sky again: the horizon motes come in as a foreground disc of lights under the turning sky. */
vec3 skyTarget5(float id, vec4 S) {
  return S.w > 3.5 ? fieldHome(id) : skyTarget(S);
}

// ---- the flock (fig. 10) ----
uniform vec3 uFlockC;
uniform mat3 uFlockM;
uniform float uFlockS;
uniform float uFlockT;
uniform float uGather;
uniform float uBurst;
uniform vec3 uBurstP;
/** How far a burst reaches (world; huge for the release, a few units for a tap). */
uniform float uBurstR;
/** The formations it flies on its own, by weight: a stream, a sheet, a vortex, two flocks (the cloud takes the rest). */
uniform vec4 uForm;
/** Free of the cursor, it parts around it: how much (0..1), and the cursor's reach (world per unit of depth). */
uniform float uAvoid;
uniform float uAvoidR;

/** Where a bird wants to be: a slot in a morphing murmuration (one of its formations), a sphere when gathered. */
vec3 flockDesired(float id, float s) {
  vec3 o = hdir(id, 30u) * pow(hsh(id, 32u), 0.42);
  float t = uFlockT;
  vec3 q = o;
  q.xz = rot2(q.xz, 0.34 * t + 1.7 * q.y);
  q.yz = rot2(q.yz, 0.21 * t + 1.2 * q.x);
  vec3 w = vec3(
    snoise(q * 1.15 + vec3(0.0, 0.0, t * 0.12)),
    snoise(q * 1.15 + vec3(13.0, 7.0, t * 0.12)),
    snoise(q * 1.15 + vec3(29.0, 3.0, t * 0.12))
  );
  q += w * 0.42;
  vec3 body = q * vec3(12.5, 3.6, 7.0);
  float fw = uForm.x + uForm.y + uForm.z + uForm.w;
  if (fw > 0.001) {
    float u = hsh(id, 33u) * 2.0 - 1.0;
    // a stream: one long ribbon along the flight, a slow wave running down it
    vec3 stream = vec3(u * 13.5, 1.5 * sin(u * 3.4 + t * 1.1) + o.y * 1.2, 2.2 * sin(u * 2.2 - t * 0.8) + o.z * 1.5);
    // a sheet: wide and thin, a swell rolling through it
    vec3 sheet = vec3(o.x * 12.5, 0.5 * o.y + 1.3 * sin(o.x * 3.6 - t * 1.5) + 0.6 * sin(o.z * 4.0 + t * 0.9), o.z * 8.6);
    // a vortex: a slow ring, turning
    float a = hsh(id, 34u) * 6.2831853 + t * 0.55;
    float rr = 6.0 + o.x * 1.8;
    vec3 vortex = vec3(cos(a) * rr, o.y * 1.7 + sin(a * 2.0 + t * 0.4) * 1.1, sin(a) * rr * 0.72);
    // two flocks side by side, each in step with the other
    float side = hsh(id, 35u) < 0.5 ? -1.0 : 1.0;
    vec3 twin = vec3(side * 6.8 + o.x * 4.8, o.y * 2.2 + side * 1.2 * sin(t * 0.7), o.z * 4.0 + side * 1.8);
    body = body * max(0.0, 1.0 - fw) + stream * uForm.x + sheet * uForm.y + vortex * uForm.z + twin * uForm.w;
    body += w * 0.9 * fw;
  }
  body = uFlockM * body * uFlockS;
  vec3 sph = (o / max(length(o), 1e-3)) * (2.2 + 0.9 * length(o)) * uFlockS;
  body = mix(body, uFlockM * sph, uGather);
  return uFlockC + body;
}

/** The part of p off the cursor's ray (world), and how far along the ray it is. */
vec3 offRay(vec3 p, out float t) {
  vec3 r = p - uRayO;
  t = max(dot(r, uRayD), 0.0);
  return r - uRayD * t;
}

/**
 * The flock is a force, not a spring: steer toward the slot at a capped speed, with a little turbulence. Free of the
 * cursor, a slot inside its reach steps out of it and a bird inside it darts away, so a chase parts the murmuration
 * and it heals behind.
 */
vec3 flockAccel(float id, vec3 p, vec3 v, Ph ph) {
  vec3 des = flockDesired(id, ph.s);
  vec3 dart = vec3(0.0);
  if (uAvoid > 0.001) {
    float td;
    vec3 od = offRay(des, td);
    float dd = length(od);
    float R = uAvoidR * td;
    if (dd < R) des += (od / max(dd, 1e-3)) * (R - dd) * 1.15 * uAvoid;
    float tp;
    vec3 op = offRay(p, tp);
    float dp = length(op);
    float Rp = uAvoidR * tp * 1.3;
    if (dp < Rp) {
      float k = 1.0 - dp / Rp;
      dart = (op / max(dp, 1e-3)) * k * k * 75.0 * uAvoid;
    }
  }
  float stiff = 1.35 * mix(1.0, 3.4, uGather);
  vec3 vd = (des - p) * stiff;
  float sp = length(vd);
  float vmax = 30.0;
  if (sp > vmax) vd *= vmax / sp;
  vec3 n3 = p * 0.07 + vec3(0.0, 0.0, uFlockT * 0.15);
  vd += vec3(snoise(n3), snoise(n3 + 19.0), snoise(n3 + 37.0)) * 3.2 * (1.0 - uGather * 0.7);
  return (vd - v) * mix(2.4, 6.0, uGather) + dart;
}

/** The burst on release (everywhere) or on a tap (where it struck): a kick out from its point (added to the velocity). */
vec3 flockBurst(float id, vec3 p) {
  vec3 o = p - uBurstP;
  float l = length(o) + 0.5;
  float reach = exp(-(l * l) / (uBurstR * uBurstR));
  return (o / l) * uBurst * (14.0 + 18.0 * hsh(id, 29u)) / (1.0 + l * 0.04) * reach;
}

// ---- the galaxy (fig. 11) ----

/**
 * A deep-space star the galaxy has taken (it is drawn at its place in the galaxy, never where it is) waits at its
 * place in the sky, so the fall of fig. 12 only has to slide it along its line of sight. Called for every freed mote
 * before the return.
 */
vec3 galaxyTarget(float id, vec3 tgt, Ph ph) {
  if (id < uN - uStarN || (ph.gal <= 0.02 && ph.k8 <= 0.0)) return tgt;
  vec4 S = texture2D(tSky, (vec2(mod(id, uSide), floor(id / uSide)) + 0.5) / uSide);
  return skyTarget5(id, S);
}

/**
 * Around the galaxy a mote that is drawn nowhere it is (hidden, or wholly at its place in the galaxy) lands on its
 * target at once, unseen, both ways: the deep-space stars between the starfield and the galaxy, the flock's motes
 * once landed, everything the galaxy holds. So scrolling back finds each one home before it shows again.
 */
vec3 galaxyJump(float id, vec3 p, vec3 v, vec3 tgt, Ph ph) {
  bool unseen = 1.0 - ph.hide - ph.gal < 0.02;
  bool finale = ph.gal > 0.0 || (id >= uN - uStarN && ph.hide > 0.98) || (id < uFlockN && ph.land > 0.98);
  return unseen && finale ? (tgt - p) / max(uDt, 1e-4) : v;
}
`;

/** The points draw's share (after POINTS_COMMON). */
export const FINALE_POINTS = /* glsl */ `
uniform mat3 uWheel;
uniform float uStarDim;

/** The sky turns about the celestial pole with the drag; exact, so the trails are true arcs (sky8: its weight). */
vec3 skyTurn(vec3 p, bool celestial, float sky8) {
  if (celestial && sky8 > 0.0) p = mix(p, uObs + uWheel * (p - uObs), sky8);
  return p;
}

/** The sky: colour by temperature, twinkle by altitude, the Milky Way's soft glow, the far horizon lights. */
void skyLook(float id, vec4 S, vec4 SC, vec3 p, float dist, float wpx, Ph ph, float wSky, out vec3 c, out float px, out float soft) {
  bool celestial = S.w < 2.5;
  c = SC.rgb;
  px = celestial ? SC.a * uDpr : SC.a * wpx;
  // the Milky Way's soft glow motes are soft only at rest in the sky; flung by the bang they are sparks
  soft = 0.0;
  if (S.w > 0.5 && S.w < 1.5 && SC.a > 3.5) {
    soft = ph.sky / max(wSky, 1e-4);
    px = mix(1.7 * uDpr, px, soft);
    c *= mix(14.0, 1.0, soft);
  }
  float alt = (p.y - uObs.y) / max(length(p - uObs), 1.0);
  if (celestial) {
    c *= smoothstep(-0.01, 0.16, alt) * (0.55 + 0.45 * smoothstep(0.0, 0.5, alt));
    float tw = 1.0 + (0.12 + 0.25 * (1.0 - smoothstep(0.05, 0.6, alt))) * uMotion
      * sin(uTime * (1.3 + 2.1 * hsh(id, 40u)) + hsh(id, 41u) * 50.0) * sin(uTime * (0.7 + hsh(id, 42u)) + id);
    c *= tw;
  } else if (S.w > 3.5) {
    // distant lights on the horizon breathe
    c *= 0.75 + 0.25 * sin(uTime * (0.4 + hsh(id, 43u)) + id) * uMotion;
    c *= exp(-dist / 900.0);
  }
}

/** Deep space: sharp stars, a power law of brightness, colours by temperature. */
void starLook(float id, out vec3 c, out float px) {
  float hb = hsh(id, 55u);
  float ht = hsh(id, 56u);
  vec3 tint = ht < 0.2 ? vec3(0.7, 0.8, 1.0) : ht < 0.75 ? vec3(1.0, 0.97, 0.92) : ht < 0.93 ? vec3(1.0, 0.82, 0.6) : vec3(1.0, 0.62, 0.4);
  float band = hsh(id, 52u) < 0.42 ? 0.6 : 1.0;
  c = tint * (0.05 + 1.6 * pow(hb, 9.0)) * band * uStarDim;
  px = (1.1 + 1.9 * pow(hb, 6.0)) * uDpr;
}

/**
 * The lights on the land of the returning sky (home: fieldHome(id)): only a share light (about the same count on every
 * tier), sodium amber and a few white, pin-points of 1 to 2.5 CSS px that shimmer a little through the air, dimming
 * into a warm haze with distance; brighter as they lift on their way home. They step back while the record is read
 * over the sky. (h8, wpx: kept for the call's shape.)
 */
void lightsLook(float id, vec3 p, vec3 home, float h8, float dist, float wpx, out vec3 c, out float px) {
  float h = hsh(id, 5u);
  float share = (h < 0.6 ? 0.065 : h < 0.75 ? 0.025 : 0.016) * 262144.0 / uN;
  if (hsh(id, 19u) > share) {
    c = vec3(0.0);
    px = 0.0;
    return;
  }
  c = (hsh(id, 20u) < 0.74 ? vec3(1.0, 0.58, 0.2) : vec3(0.9, 0.93, 1.0)) * (0.3 + 1.5 * pow(hsh(id, 21u), 2.2));
  c *= 0.82 + 0.18 * sin(uTime * (0.5 + 2.2 * hsh(id, 22u)) + hsh(id, 23u) * 60.0) * uMotion;
  float lift = clamp(p.y - home.y, -0.5, 4.0);
  c *= 1.0 + max(lift, 0.0) * 1.1;
  float fog = exp(-dist / 430.0);
  c = mix(vec3(1.0, 0.62, 0.3) * 0.45 * dot(c, vec3(0.33)), c, fog) * (0.4 + 0.6 * fog) * 1.5;
  c *= 1.0 - 0.75 * clamp((1.0 - uDim) / 0.58, 0.0, 1.0);
  px = (1.0 + 1.5 * pow(hsh(id, 24u), 3.0)) * uDpr;
}

/**
 * The flock: the world's city lights, risen (the world dims them as they lift: src/gl/world/world.ts). Warm gold
 * with a few white-hot ones, soft and a little larger than dust, and waves of density running through the body like
 * a real murmuration's (two slow travelling waves in its own frame: where they meet, the flock packs bright).
 */
void flockLook(float id, float wpx, out vec3 c, out float px) {
  vec3 o = hdir(id, 30u) * pow(hsh(id, 32u), 0.42);
  float h = hsh(id, 15u);
  // amber like the lights on the ground (kept below white, so the tone map leaves it gold, not cream)
  vec3 tint = h < 0.06 ? vec3(1.0, 0.86, 0.66) : mix(vec3(1.0, 0.52, 0.15), vec3(1.0, 0.68, 0.32), hsh(id, 17u));
  float w1 = 0.5 + 0.5 * sin(dot(o, vec3(2.4, 0.8, 1.3)) * 2.1 - uTime * 1.1);
  float w2 = 0.5 + 0.5 * sin(dot(o, vec3(-1.2, 1.6, 2.1)) * 1.6 - uTime * 0.6 + 1.7);
  float w14 = w1 * w1 * w1 * w1;
  float w26 = w2 * w2 * w2;
  float dens = 0.14 + 1.7 * w14 + 0.55 * w26 * w26;
  c = tint * (0.16 + 0.84 * pow(hsh(id, 16u), 2.6)) * dens * 0.8;
  px = (0.05 + 0.05 * hsh(id, 18u)) * wpx;
}

/** The flock glints as it turns (a factor on the colour; sp: the mote's speed). */
float flockGlint(float sp, Ph ph) {
  return 1.0 + ph.flock * smoothstep(6.0, 22.0, sp) * 0.5;
}

// ---- the galaxy (fig. 11) ----
${GAL_SHAPE}
uniform sampler2D tGal;
/** Local galactic -> world (the sky's rest frame at the visit's sidereal time), and the galaxy's origin (our star). */
uniform mat3 uGalM;
uniform vec3 uGalO;
/** Light per mote (fewer motes on the lower tiers each carry more), and the knots' fade as the eye falls home. */
uniform float uGalI;
uniform float uGalNear;

/** Draw mote p at its place in the galaxy (galaxyHold); returns its home (xyz local, w: class + intensity). */
vec4 galaxyPlace(vec2 uv, Ph ph, inout vec3 p) {
  vec4 G = texture2D(tGal, uv);
  p = mix(p, uGalO + uGalM * G.xyz, galaxyHold(ph));
  return G;
}

/**
 * The galaxy's light: blue-white arms, a warm old core, pink knots of young stars along the arms, our neighbourhood
 * dim around our star, the far field behind. Sharp points of a fixed size, like stars.
 */
void galaxyLook(float id, vec4 G, vec3 p, out vec3 c, out float px) {
  float cls = floor(G.w);
  float I = fract(G.w);
  vec2 q = vec2(G.x / ${glf(GAL.RS)} - 1.0, G.y / ${glf(GAL.RS)});
  float R = length(q);
  float core = exp(-R * R / 0.03);
  float h = hsh(id, 60u);
  vec3 tint = h < 0.5 ? vec3(0.72, 0.83, 1.0) : h < 0.86 ? vec3(1.0, 0.96, 0.9) : vec3(1.0, 0.8, 0.58);
  if (cls < 0.5) {
    c = vec3(0.0);
    px = 0.0;
  } else if (cls < 1.5 || cls > 4.5) {
    // young blue-white stars on the arms, the old disk between them yellower, the core warm; as the eye comes home
    // the arms soften toward the sky's own grain, and the motes that will be its soft glow let go
    float arm = smoothstep(0.08, 0.6, galArms(q));
    vec3 young = h < 0.62 ? vec3(0.6, 0.75, 1.0) : vec3(0.92, 0.95, 1.0);
    vec3 old = h < 0.5 ? vec3(1.0, 0.9, 0.74) : vec3(0.95, 0.93, 0.9);
    vec3 tone = mix(mix(old, young, arm), vec3(1.0, 0.72, 0.42), smoothstep(0.05, 0.7, core));
    float home = cls > 4.5 ? 1.0 - 0.88 * uGalNear : 1.0 - 0.4 * uGalNear;
    c = tone * I * (0.62 - 0.4 * core) * home;
    px = (1.25 + 1.4 * I * I) * uDpr * (1.0 - 0.2 * uGalNear);
  } else if (cls < 2.5) {
    c = vec3(1.0, 0.95, 0.88) * I * 0.45;
    px = (1.2 + 1.3 * I) * uDpr;
  } else if (cls < 3.5) {
    c = vec3(1.0, 0.42, 0.56) * I * 0.55 * (1.0 - uGalNear);
    px = (1.3 + 0.9 * I) * uDpr;
  } else {
    c = tint * I * 0.55;
    px = (1.1 + 1.6 * I * I * I) * uDpr;
  }
  // home under the sky, the earth hides the galaxy's half below the horizon
  float alt = (p.y - uObs.y) / max(length(p - uObs), 1.0);
  c *= uGalI * mix(1.0, smoothstep(-0.012, 0.03, alt), uGalNear);
}
`;

/**
 * One pass, once: every mote's home in the galaxy (xyz local galactic, world units from our star; w: class +
 * intensity), drawn from its place in the sky (tSky), so from our star each one lies on its own line of sight.
 * Classes: 1 the Milky Way (where its line of sight crosses the arms and the core; 5 the same for the sky's soft glow
 * motes), 2 our neighbourhood (the bright and the faint stars: a thin lens around our star), 3 knots of young stars
 * along the arms (the gold dust), 4 the far field behind the galaxy (deep-space stars that are not the Milky Way),
 * 0 none (the horizon's lights).
 */
export const GAL_HOME = /* glsl */ `
${COMMON}
uniform sampler2D tSky;
uniform sampler2D tSkyCol;
uniform float uN;
uniform float uStarN;
const mat3 E2G = ${E2G};
const float GAL_FAR = ${glf(GAL.far)};
${GAL_SHAPE}

/** How thick the disk may be at galactocentric radius R (RS units): thin, swelling into the bulge. */
float galZ(float R) {
  return 0.045 + 0.1 * exp(-R * R / 0.025);
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  float id = floor(gl_FragCoord.y) * resolution.x + floor(gl_FragCoord.x);
  vec4 S = texture2D(tSky, uv);
  vec4 C = texture2D(tSkyCol, uv);
  bool isX = id >= uN - uStarN;
  float role = S.w;
  vec3 P = vec3(0.0);
  float cls = 0.0;
  float I = 0.0;
  if (role < 2.5) {
    vec3 d = normalize(E2G * normalize(S.xyz));
    float lc = length(d.xy);
    vec2 d2 = d.xy / max(lc, 1e-4);
    float tb = d.z / max(lc, 0.05);
    if (role > 0.5 && role < 1.5) {
      // the Milky Way: where its line of sight crosses the galaxy's light (the best of a dozen tries, then a closer
      // look); some motes care less, and fill the disk between the arms
      bool loose = hsh(id, 61u) < 0.3;
      float bestR = 0.2;
      float best = -1.0;
      for (int k = 0; k < 12; k++) {
        float r = 0.02 + 3.1 * pow(hsh(id, 62u + uint(k)), 1.15);
        float u = hsh(id, 90u + uint(k));
        float sc = galRho(d2 * r - vec2(1.0, 0.0)) * pow(r, 0.95) * (loose ? u * u * u : 0.35 + 0.65 * u);
        if (sc > best) {
          best = sc;
          bestR = r;
        }
      }
      float r0 = bestR;
      for (int k = 0; k < 6; k++) {
        float r = max(0.02, r0 + (hsh(id, 110u + uint(k)) - 0.5) * 0.14);
        float u = hsh(id, 120u + uint(k));
        float sc = galRho(d2 * r - vec2(1.0, 0.0)) * pow(r, 0.95) * (loose ? u * u * u : 0.35 + 0.65 * u);
        if (sc > best) {
          best = sc;
          bestR = r;
        }
      }
      vec2 q = d2 * bestR - vec2(1.0, 0.0);
      float z = bestR * tb;
      z = z / (1.0 + abs(z) / galZ(length(q)));
      P = vec3(d2 * bestR, z) * GAL_RS;
      // (class 5: one of the sky's soft glow motes, which lets its galaxy light go as the eye comes home)
      cls = C.a > 3.5 ? 5.0 : 1.0;
      I = 0.22 + 0.78 * pow(hsh(id, 63u), 3.0);
    } else if (isX) {
      // deep-space stars that are not the Milky Way: the far field behind the galaxy, on their own line of sight
      P = d * GAL_FAR;
      cls = 4.0;
      I = 0.15 + 0.85 * pow(hsh(id, 64u), 4.0);
    } else {
      // the bright stars and the faint ones: our neighbourhood, a thin lens around our star on its spur (only the
      // brightest show from outside; the rest light as the sky takes them)
      vec3 lp = d * (0.012 + 0.11 * pow(hsh(id, 65u), 1.4));
      lp.z = lp.z / (1.0 + abs(lp.z) / 0.012);
      P = lp * GAL_RS;
      cls = 2.0;
      float lum = max(C.r, max(C.g, C.b));
      I = role < 0.5 ? clamp(lum * 0.1 - 0.02, 0.0, 0.6) : (hsh(id, 66u) < 0.12 ? 0.05 + 0.12 * hsh(id, 67u) : 0.0);
    }
  } else if (role < 3.5) {
    // the gold dust: knots of young stars glowing pink along the arms (a hundred and sixty of them)
    float j = floor(hsh(id, 70u) * 160.0);
    vec2 best = vec2(0.5, 0.0);
    float bs = -1.0;
    for (int k = 0; k < 10; k++) {
      float R = 0.3 + 1.25 * sqrt(hsh(j, 71u + uint(k) * 2u));
      float a = hsh(j, 72u + uint(k) * 2u) * 6.2831853;
      vec2 q = vec2(cos(a), sin(a)) * R;
      float s = galArms(q) * (0.6 + 0.4 * hsh(j, 95u + uint(k)));
      if (s > bs) {
        bs = s;
        best = q;
      }
    }
    vec3 o = hdir(id, 73u) * pow(hsh(id, 75u), 0.6) * vec3(0.024, 0.024, 0.008);
    vec2 q = best + o.xy;
    P = vec3((q.x + 1.0) * GAL_RS, q.y * GAL_RS, o.z * GAL_RS);
    cls = 3.0;
    I = hsh(id, 77u) < 0.55 ? 0.2 + 0.8 * pow(hsh(id, 76u), 2.0) : 0.0;
  }
  gl_FragColor = vec4(P, cls + min(I, 0.999));
}
`;

/** The galaxy's sprites share the local frame of the motes. */
const GAL_FRAME = /* glsl */ `
uniform mat3 uGalM;
uniform vec3 uGalO;
`;

/** The disk's glow (fig. 11): a quad in the galaxy's plane, the light between the stars, warm at the core. */
export const GALAXY_DISK_VERT = /* glsl */ `
${GAL_FRAME}
varying vec2 vQ;
void main() {
  // the quad is in RS units around the centre
  vQ = position.xy;
  vec3 local = vec3((position.x + 1.0) * ${glf(GAL.RS)}, position.y * ${glf(GAL.RS)}, 0.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(uGalO + uGalM * local, 1.0);
}
`;

export const GALAXY_DISK_FRAG = /* glsl */ `
${COMMON}
${GAL_SHAPE}
uniform float uI;
/** The arms' share of the glow (more on the lower tiers, where fewer motes draw them). */
uniform float uArms;
varying vec2 vQ;
void main() {
  float R = length(vQ);
  float arms = galArms(vQ);
  float disk = exp(-R / 0.5) * (1.0 - smoothstep(1.5, 2.0, R));
  float bar = galBar(vQ);
  float core = exp(-R * R / 0.012);
  vec3 c = vec3(0.55, 0.66, 0.95) * disk * (0.12 + 0.9 * arms) * uArms;
  c += vec3(1.0, 0.72, 0.42) * (bar * 0.05 + core * 0.16 + exp(-R * R / 0.09) * 0.03);
  gl_FragColor = vec4(c * uI, 1.0);
}
`;

/** The core (fig. 11): the bulge's glow, a sprite facing the eye (uCenter, uSize world; the fx BILLBOARD's layout). */
export const GALAXY_CORE_FRAG = /* glsl */ `
uniform float uI;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  float g = exp(-r * r * 9.0) * 0.5 + exp(-r * 5.5) * 0.18 + exp(-r * r * 60.0) * 0.6;
  vec3 c = mix(vec3(1.0, 0.62, 0.3), vec3(1.0, 0.86, 0.66), exp(-r * r * 20.0));
  gl_FragColor = vec4(c * g * uI * (1.0 - smoothstep(0.8, 1.0, r)), 1.0);
}
`;

/**
 * The platform stars (fig. 11): fifty-odd sharp lights across the galaxy with a soft cross glint, warmer than the rest.
 * The named ones (the platforms you can open) breathe, slowly and each in its own time, toward the journal's gold:
 * never a blink, just enough to read as different from the dust. As the pointer comes near one it brightens and a
 * thin ring draws round it (paper white), gold and a little wider on the one it names.
 * position: local galactic; aLook: x size (CSS px), y brightness, z the breath's phase 0..1 (-1: unnamed, it does not
 * breathe, nor ring as the pointer nears: only while the pointer names it); aLive: x lit 0..1, y hover 0..1, z near 0..1
 * (written per frame).
 */
export const PLATFORM_VERT = /* glsl */ `
${GAL_FRAME}
uniform float uDpr;
uniform float uI;
uniform float uTime;
attribute vec3 aLook;
attribute vec3 aLive;
varying vec3 vCol;
varying float vHover;
varying float vBreath;
varying float vBody;
varying float vRingR;
varying float vRingW;
varying vec3 vRing;
void main() {
  vec4 mv = viewMatrix * vec4(uGalO + uGalM * position, 1.0);
  gl_Position = projectionMatrix * mv;
  float lit = aLive.x;
  float hov = aLive.y;
  float near = aLive.z;
  float named = step(0.0, aLook.z);
  // the breath: 0..1, a period of 4.5 to 6.6 s
  float br = named * (0.5 - 0.5 * cos(uTime * (0.95 + 0.45 * aLook.z) + aLook.z * 40.0));
  float body = aLook.x * (0.55 + 0.45 * lit) * (1.0 + 0.12 * br + 0.2 * near + 0.3 * hov) * uDpr;
  // the ring (CSS px radius) needs a sprite that holds it
  float ringPx = (14.0 + 3.0 * hov) * uDpr;
  float size = max(body, 2.0 * ringPx + 4.0 * uDpr);
  gl_PointSize = size;
  vBody = body / size;
  vRingR = 2.0 * ringPx / size;
  vRingW = 2.0 * 0.6 * uDpr / size;
  vec3 warm = mix(vec3(1.0, 0.84, 0.62), vec3(1.0, 0.74, 0.4), 0.6 * br);
  vCol = mix(warm, vec3(1.0, 0.93, 0.8), hov) * aLook.y * lit * (0.8 + 0.4 * br + 0.4 * near + 0.55 * hov) * uI;
  vBreath = br;
  // (an unnamed star rings only while the pointer names it: its card's hairline runs to that ring)
  vRing = mix(vec3(0.93, 0.95, 0.97), vec3(0.91, 0.72, 0.4), hov) * lit * uI * max(0.42 * near * named, 0.66 * hov);
  vHover = hov;
  if (lit * uI < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
`;

export const PLATFORM_FRAG = /* glsl */ `
varying vec3 vCol;
varying float vHover;
varying float vBreath;
varying float vBody;
varying float vRingR;
varying float vRingW;
varying vec3 vRing;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  // the ring: a hairline at vRingR (shares of the sprite's half-size)
  float ring = 1.0 - smoothstep(0.5 * vRingW, 1.5 * vRingW, abs(length(q) - vRingR));
  vec3 col = vRing * ring;
  // the star, in its own share of the sprite
  vec2 c = q / vBody;
  float r2 = dot(c, c);
  if (r2 < 1.0) {
    float core = exp(-r2 * 70.0) * 2.2 + exp(-r2 * 16.0) * 0.45;
    // (the breath swells the soft glow most: the sharp core stays a point)
    float halo = exp(-r2 * 5.0) * (0.12 + 0.1 * vHover + 0.16 * vBreath);
    vec2 a = abs(c);
    float glint = (exp(-a.y * 46.0) * exp(-a.x * 4.2) + exp(-a.x * 46.0) * exp(-a.y * 4.2)) * (0.55 + 0.35 * vHover);
    float e = 1.0 - smoothstep(0.7, 1.0, sqrt(r2));
    col += vCol * (core + halo + glint) * e;
  }
  if (col.r + col.g + col.b < 0.0004) discard;
  gl_FragColor = vec4(col, 1.0);
}
`;
