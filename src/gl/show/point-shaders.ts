/**
 * The one additive points draw: every mote of the sim as a soft round sprite with a hot core, assembled from the
 * owners' chunks (./glsl). Each role's colour and size is its owner's function (the sky and the deep-space stars,
 * the horizon's lights and the flock: finale; the nebula's dust, the bang's heat and the hold's lens: genesis; the
 * planets condensing: system). This file owns the assembly: the role weights from the timeline, the mix, and what
 * applies to every mote (the ground, the near fade, the watchdog's keep, the minimum size).
 */
import { COMMON } from "./glsl/common";
import { FINALE, FINALE_POINTS } from "./glsl/finale";
import { GENESIS, GENESIS_POINTS } from "./glsl/genesis";
import { SYSTEM, SYSTEM_POINTS } from "./glsl/system";
import { TIMELINE } from "./glsl/timeline";

/** Uniforms every part of the draw reads. */
const POINTS_COMMON = /* glsl */ `
uniform sampler2D tPos;
uniform sampler2D tVel;
uniform sampler2D tSky;
uniform sampler2D tSkyCol;
uniform sampler2D tNeb;
uniform float uProj;
uniform float uDpr;
uniform float uAspect;
uniform float uDim;
uniform float uKeep;
uniform float uKeepFade;
uniform float uMaxPx;
uniform float uMotion;
uniform float uTrail;
varying vec3 vCol;
varying float vSoft;
`;

export const POINTS_VERT = /* glsl */ `
${COMMON}
${TIMELINE}
${GENESIS}
${SYSTEM}
${FINALE}
${POINTS_COMMON}
${GENESIS_POINTS}
${SYSTEM_POINTS}
${FINALE_POINTS}

void main() {
  float id = position.x;
  vec2 uv = (vec2(mod(id, uSide), floor(id / uSide)) + 0.5) / uSide;
  vec3 p = texture2D(tPos, uv).xyz;
  vec3 vel = texture2D(tVel, uv).xyz;
  vec4 S = texture2D(tSky, uv);
  vec4 SC = texture2D(tSkyCol, uv);
  Ph ph = phases(id);
  bool celestial = S.w < 2.5;
  float sky8 = ph.k8 * uFreed;

  p = skyTurn(p, celestial, sky8);
  // fig. 11: the galaxy draws its motes at their place in it (finale)
  vec4 G = vec4(0.0);
  if (ph.gal > 0.0) G = galaxyPlace(uv, ph, p);
  bool horizon = S.w > 3.5;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = max(-mv.z, 0.05);
  float wpx = uProj / dist;

  // role weights; after the bang the sky colour hands over to the new roles as the light cools
  float h8 = horizon ? sky8 : 0.0;
  float post = ph.gen + ph.star;
  float wSky = ph.sky - h8 + post * (1.0 - uFreedK);
  float wGen = ph.gen * uFreedK;
  float wStar = ph.star * uFreedK;
  // the horizon's motes come back as the foreground lights of the returning sky
  float wLights = h8 * 1.1;

  // each role's colour and size, by its owner
  vec3 cSky;
  float pxSky;
  float soft;
  skyLook(id, S, SC, p, dist, wpx, ph, wSky, cSky, pxSky, soft);

  vec3 cGen = vec3(0.0);
  float pxGen = 0.0;
  float genVis = 1.0;
  if (wGen > 0.0) {
    vec4 N = texture2D(tNeb, uv);
    genesisLook(id, N, p, wpx, cGen, pxGen);
    if (ph.pk > 0.0) planetLook(id, vec4(genesisRest(id, N.xyz), N.w), ph, cGen, pxGen, genVis);
    cGen *= uGenDim;
  }

  vec3 cStar = vec3(0.0);
  float pxStar = 0.0;
  if (wStar > 0.0) starLook(id, cStar, pxStar);

  vec3 cLights = vec3(0.0);
  float pxLights = 0.0;
  if (wLights > 0.0) lightsLook(id, p, fieldHome(id), h8, dist, wpx, cLights, pxLights);

  vec3 cFlock;
  float pxFlock;
  flockLook(id, wpx, cFlock, pxFlock);

  vec3 cGal = vec3(0.0);
  float pxGal = 0.0;
  if (ph.gal > 0.0) galaxyLook(id, G, p, cGal, pxGal);

  vec4 clip = projectionMatrix * mv;
  vec3 col = cSky * wSky + cGen * wGen * genVis + cStar * wStar + cLights * wLights + cFlock * ph.flock + cGal * ph.gal;
  float px = pxSky * wSky + pxGen * wGen + pxStar * wStar + pxLights * wLights + pxFlock * ph.flock + pxGal * ph.gal;

  float sp = length(vel);
  bangHeat(sp, ph, wSky, post, col, px);
  col *= flockGlint(sp, ph);

  float bright = 1.0;
  holdLens(celestial, wSky, clip, bright);
  holdShrink(p, ph, px, bright);

  bright *= uDim * (1.0 - ph.hide);
  // the ground hides what is under it, only where there is a ground (under the sky: before the bang, and fig. 12)
  float grounded = (1.0 - uFreed) + sky8;
  bright *= mix(1.0, smoothstep(uGround - 1.2, uGround - 0.2, p.y), min(grounded, 1.0));
  bright *= smoothstep(0.6, 3.5, dist) * mix(1.0, smoothstep(2.0, 9.0, dist), step(24.0, px));
  if (float(gl_VertexID) >= uKeep) bright *= uKeepFade;

  // tiny sprites keep their energy; huge near ones are capped
  float minPx = 1.5 * max(1.0, uDpr * 0.75);
  if (px < minPx) {
    bright *= (px * px) / (minPx * minPx);
    px = minPx;
  }
  px = min(px, uMaxPx);
  vec3 outc = col * bright;
  if (max(outc.r, max(outc.g, outc.b)) < 0.0004) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    vCol = vec3(0.0);
    vSoft = 0.0;
    return;
  }
  gl_Position = clip;
  gl_PointSize = px;
  vCol = outc;
  // (a glow mote settling out of the galaxy into the sky is soft all the way: finale)
  vSoft = soft * min(1.0, wSky + ph.gal) * (1.0 - smoothstep(0.0, 0.2, uHeat));
}
`;

export const POINTS_FRAG = /* glsl */ `
varying vec3 vCol;
varying float vSoft;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0;
  float r2 = dot(c, c);
  if (r2 > 1.0) discard;
  float core = exp(-r2 * mix(10.0, 2.2, vSoft));
  float halo = exp(-r2 * 3.4) * 0.2 * (1.0 - vSoft);
  float a = (core + halo) * (1.0 - r2);
  float l = dot(vCol, vec3(0.3, 0.5, 0.2));
  vec3 col = vCol * a + vec3(l) * core * core * 0.55 * (1.0 - vSoft);
  gl_FragColor = vec4(col, 1.0);
}
`;
