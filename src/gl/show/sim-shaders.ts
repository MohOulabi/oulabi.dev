/**
 * The sim's shaders, assembled from the owners' chunks (./glsl): the velocity pass (where each mote wants to be, and
 * every force on it), the position pass, and the one-off pass that seeds the nebula's rest homes. This file owns only
 * the assembly: the spring dispatcher that picks and blends the owners' targets by the timeline's weights, the
 * spring's stiffness per role, and the order the owners' forces apply in.
 */
import { COMMON } from "./glsl/common";
import { FINALE, FINALE_SIM } from "./glsl/finale";
import { GENESIS, GENESIS_SIM } from "./glsl/genesis";
import { SYSTEM, SYSTEM_SIM } from "./glsl/system";
import { TIMELINE } from "./glsl/timeline";

/** Uniforms every part of the sim reads. */
const SIM_COMMON = /* glsl */ `
uniform sampler2D tSky;
uniform sampler2D tNeb;
uniform float uDt;
uniform float uSnap;
uniform float uSpring;
uniform float uDrag;
uniform float uMotion;
// the pointer's ray (world)
uniform vec3 uRayO;
uniform vec3 uRayD;
`;

/**
 * The spring target of mote id: each owner's target, blended by the timeline's weights (the flock is a force). The
 * flock's motes wait on the world's night side (the park) before they rise; the rest of genesis hides where it is;
 * once hidden for good (ph.wait), both wait at their own place in the sky for the return. `lock`: how much a planet's
 * mote rides with its ball instead of springing toward it (glsl/system.ts planetLock).
 */
const SPRING = /* glsl */ `
vec3 springTarget(float id, Ph ph, vec4 S, vec4 N, out float lock) {
  lock = 0.0;
  if (uFreed < 0.5) return skyTarget(S);
  bool isF = id < uFlockN;
  bool isX = id >= uN - uStarN;
  vec3 tgt;
  if (isX) {
    tgt = farStar(id);
  } else if (ph.wait > 0.5) {
    // hidden for good (figs 9-12): it waits at its own place in the sky; genesis's targets would be thrown away
    tgt = skyTarget5(id, S);
  } else {
    tgt = genesisTarget(id, N, ph);
    if (ph.pk > 0.0) {
      vec3 q = genesisRest(id, N.xyz);
      tgt = clumpTarget(id, tgt, ph.pk, q);
      lock = planetLock(ph, q);
    }
    if (isF) tgt = mix(tgt, nightSide(id), ph.park);
  }
  tgt = galaxyTarget(id, tgt, ph);
  if (ph.k8 > 0.0) tgt = mix(tgt, skyTarget5(id, S), ph.k8);
  return tgt;
}
`;

export const VELOCITY = /* glsl */ `
${COMMON}
${TIMELINE}
${GENESIS}
${SYSTEM}
${FINALE}
${SIM_COMMON}
${GENESIS_SIM}
${SYSTEM_SIM}
${FINALE_SIM}
${SPRING}
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  float id = floor(gl_FragCoord.y) * resolution.x + floor(gl_FragCoord.x);
  vec3 p = texture2D(texturePosition, uv).xyz;
  vec3 v = texture2D(textureVelocity, uv).xyz;
  vec4 S = texture2D(tSky, uv);
  vec4 N = texture2D(tNeb, uv);
  Ph ph = phases(id);
  float pre = 1.0 - uFreed;

  // fig. 2's stir carries the genesis dust's place with the gas (glsl/genesis.ts STIR)
  float lock;
  vec3 tgt = stirTarget(springTarget(id, ph, S, N, lock), ph);
  // the spring's stiffness per role: the nebula floats; the disk and the planets pull tighter
  float h = hsh(id, 10u);
  float om = mix(2.5, 3.9, h);
  om = mix(om, mix(1.9, 2.9, h) * (1.0 + 1.1 * uCollapse + 0.7 * ph.pk), ph.gen);
  om = mix(om, 6.0, ph.hide);
  om = mix(om, 5.0, ph.sky * uFreed);
  // after the bang the springs return slowly, so the blast keeps its momentum
  om *= mix(1.0, uSpring, ph.gen + ph.star + pre);

  float g = holdPull(ph, tgt, om);
  vec3 a = (tgt - p) * om * om - v * (1.75 * om + uDrag);
  if (g > 0.0) a += holdSwirl(p, g);
  if (ph.flock > 0.001) a = mix(a, flockAccel(id, p, v, ph), ph.flock);
  a += cursorPull(p, S, pre);

  v += a * uDt;

  if (uImpulse > 0.0) v = bangKick(id, p, v, tgt);
  if (uBurst > 0.0 && ph.flock > 0.5) v += flockBurst(id, p);

  float sp = length(v);
  if (sp > 260.0) v *= 260.0 / sp;
  // once its planet is solid, a planet's dust lands on its place on the ball every frame (glsl/system.ts planetLock)
  if (lock > 0.0) v = mix(v, (tgt - p) / max(uDt, 1e-4), lock);
  // drawn at its place in the galaxy (fig. 11), a mote lands on its target unseen (glsl/finale.ts)
  v = galaxyJump(id, p, v, tgt, ph);
  // a jump in story time (a nav cut, a deep link): land on the target this frame, still next frame
  if (uSnap > 1.5) v = vec3(0.0);
  else if (uSnap > 0.5) {
    vec3 goal = ph.flock > 0.5 ? flockDesired(id, ph.s) : tgt;
    v = (goal - p) / max(uDt, 1e-4);
  }
  gl_FragColor = vec4(v, 0.0);
}
`;

export const POSITION = /* glsl */ `
uniform float uDt;
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec3 p = texture2D(texturePosition, uv).xyz;
  vec3 v = texture2D(textureVelocity, uv).xyz;
  gl_FragColor = vec4(p + v * uDt, 0.0);
}
`;

/**
 * One pass, once: the nebula's rest home of every mote (xyz relative to the sun, w = how dense the gas is there),
 * drawn from the same density the gas volume renders, so the dust lies in the gas's filaments and clouds.
 */
export const NEB_HOME = /* glsl */ `
${COMMON}
uniform highp sampler3D tNoise;
uniform float uNebR;
NEB_DENSITY
void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  float id = floor(gl_FragCoord.y) * resolution.x + floor(gl_FragCoord.x);
  vec3 best = vec3(0.0);
  float bestD = -1.0;
  // the best of a few tries: the dust gathers where the gas is thick, with a little scatter between
  for (int k = 0; k < 14; k++) {
    // later tries look nearer the heart, where the clouds are thick, so no mote is left on the outer rim
    float reach = 1.0 - 0.55 * float(k) / 13.0;
    vec3 q = hdir(id, 90u + uint(k) * 3u) * pow(hsh(id, 150u + uint(k)), 0.4) * uNebR * reach;
    q.y *= 0.74;
    float d = nebDensity(q) + 0.03 * hsh(id, 120u + uint(k));
    if (d > bestD) {
      bestD = d;
      best = q;
    }
  }
  gl_FragColor = vec4(best, nebDensity(best));
}
`;
