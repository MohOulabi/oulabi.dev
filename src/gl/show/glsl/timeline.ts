/**
 * The per-mote timeline, shared by the sim's two passes and the points draw: the core uniforms, and phases(), which
 * turns story time (uTs) and the mote id into the role weights of the frame. Every weight is a pure function of
 * those, so the sim and the render agree on every frame and scrolling back replays the show backwards.
 *
 * No story time is a literal here: each window is a TS constant exported by the figure controller that owns it
 * (src/gl/show/figures), written into the GLSL below. Change a time in its owner's file, never in this text.
 *
 * Roles along the show (docs/STORY.md, src/lib/journey.ts): the Riyadh sky -> after the bang, genesis (the nebula, the
 * disk, the planets condensing: figures/system.ts condense) and, for the top range of ids, the deep-space starfield.
 * Genesis parks on the world's night side, hidden, as the camera dives to the world (system park). The flock's motes
 * (id < uFlockN) rise from there as the murmuration (figures/flock.ts rise) and settle back, hidden, as the camera
 * pulls away (flock land); hidden, they wait at their own place in the sky (sky waitFrom, after the land for the
 * flock); in fig. 11 the galaxy lights them where they belong in it (figures/galaxy.ts form, formFlock; the
 * deep-space stars step out first: deep, formDeep); then everything returns to the sky (figures/sky.ts returnFlock,
 * returnAll): the galaxy's motes slide along their lines of sight into their places, the rest fades in where it waits.
 */
import { FLOCK_T } from "../figures/flock";
import { GALAXY_T } from "../figures/galaxy";
import { SKY_T } from "../figures/sky";
import { SYSTEM_T } from "../figures/system";
import { glf } from "./common";

/** A ramp over a window [a, b) as GLSL arguments "a, b". */
const w = (win: readonly [number, number]) => `${glf(win[0])}, ${glf(win[1])}`;

export const TIMELINE = /* glsl */ `
uniform float uTs;
uniform float uN;
uniform float uSide;
uniform float uFlockN;
uniform float uStarN;
uniform float uFreed;
uniform float uTime;
uniform float uGround;
uniform float uFieldR;
uniform vec3 uObs;
uniform vec4 uPlanet[5];

/** Each mote reaches the ramp at its own moment: s spreads the start over spread of the window. */
float rampS(float t, float a, float b, float s, float spread) {
  float L = (b - a) * (1.0 - spread);
  float st = a + s * spread * (b - a);
  return smoothstep(st, st + L, t);
}

struct Ph {
  float s;
  // the planets condense; genesis parks (hands over to the world)
  float pk;
  float park;
  // the flock's motes: rise from the world, land back on it (hidden)
  float rise;
  float land;
  // back to the sky; hidden, waiting at its place in the sky (0 or 1)
  float k8;
  float wait;
  // weights (sum to 1)
  float sky;
  float gen;
  float star;
  float hide;
  float flock;
  // the galaxy of fig. 11 (figures/galaxy.ts)
  float gal;
};

Ph phases(float id) {
  Ph p;
  float T = uTs;
  p.s = hsh(id, 3u);
  p.rise = 0.0;
  p.land = 0.0;
  bool isF = id < uFlockN;
  bool isX = id >= uN - uStarN;
  p.k8 = isF ? rampS(T, ${w(SKY_T.returnFlock)}, p.s, 0.55) : rampS(T, ${w(SKY_T.returnAll)}, p.s, 0.6);
  p.pk = rampS(T, ${w(SYSTEM_T.condense)}, p.s, 0.55);
  // genesis hands over to the world
  float park = isX ? 0.0 : rampS(T, ${w(SYSTEM_T.park)}, p.s, 0.5);
  p.park = park;
  if (isF) {
    p.rise = rampS(T, ${w(FLOCK_T.rise)}, p.s, 0.62);
    p.land = rampS(T, ${w(FLOCK_T.land)}, p.s, 0.5);
  }
  p.wait = isX ? 0.0 : step(isF ? ${glf(SKY_T.waitFlockFrom)} : ${glf(SKY_T.waitFrom)}, T);
  // fig. 11 (figures/galaxy.ts): the galaxy lights its motes where they belong, out of hiding (the deep-space stars
  // step out first, the flock's once they have landed); the sky takes them back (k8). Its place: glsl/finale.ts.
  float gk = isF ? rampS(T, ${w(GALAXY_T.formFlock)}, p.s, 0.5)
    : isX ? rampS(T, ${w(GALAXY_T.formDeep)}, p.s, 0.6) : rampS(T, ${w(GALAXY_T.form)}, p.s, 0.6);
  float gx = isX ? rampS(T, ${w(GALAXY_T.deep)}, p.s, 0.6) : 0.0;
  // stage chain: each weight is (this stage) * (1 - next stage), so the chain sums to 1
  float g = 0.0;
  float st = 0.0;
  float hd = 0.0;
  float fl = 0.0;
  float ga = 0.0;
  if (isX) {
    st = (1.0 - gx) * (1.0 - p.k8);
    hd = gx * (1.0 - gk) * (1.0 - p.k8);
    ga = gx * gk * (1.0 - p.k8);
  } else if (isF) {
    g = 1.0 - park;
    hd = park * (1.0 - p.rise) + p.land * (1.0 - gk) * (1.0 - p.k8);
    fl = p.rise * (1.0 - p.land);
    ga = p.land * gk * (1.0 - p.k8);
  } else {
    g = 1.0 - park;
    hd = park * (1.0 - gk) * (1.0 - p.k8);
    ga = park * gk * (1.0 - p.k8);
  }
  float fr = uFreed;
  p.sky = (1.0 - fr) + fr * p.k8;
  p.gen = fr * g;
  p.star = fr * st;
  p.hide = fr * hd;
  p.flock = fr * fl;
  p.gal = fr * ga;
  return p;
}
`;
