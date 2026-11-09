/**
 * GLSL of fig. 9, the storm (src/gl/world/storm.ts drives it): the sheet of streaks, the field's loops and the aurora's
 * curtains. Linear light out, additive; the post chain blooms what is above 1 and tone maps (AgX). The geometry of the
 * field (layout.ts STORM_DIR, NOON, DUSK, OVAL, CUSP_L, LOOPS) is shared with the TS side through uniforms, so the
 * ink's paths field0..3 (storm.ts fieldPoint) lie exactly on the loops drawn here.
 */
import { BAND } from "./band";
import { COMMON } from "./shaders";

// ---------------------------------------------------------------------------------------------------------------
// the storm: a sheet of fast thin streaks (instanced ribbons along each streak's path). Each streak flies along
// STORM_DIR at its own offset across the sheet; the field's shield (a paraboloid with its nose upstream, grown by
// the field) pushes it round the world, or, for a few, catches it and pours it down a field line into a pole. Ahead of
// the front there is nothing; a streak that meets the world (no field yet) ends in its air. The flow runs on uFlow,
// the storm's integrated clock, so the visitor's push (uPush: faster, longer, denser, brighter, more caught) changes
// its speed without moving any streak.

export const STORM_VERT = /* glsl */ `
${COMMON}
attribute float aId;
uniform vec3 uC;
uniform float uR;
uniform vec3 uD;
uniform vec3 uSA;
uniform vec3 uSB;
uniform vec3 uAx;
uniform vec3 uNoon;
uniform vec3 uDusk;
uniform float uFlow;
uniform float uPush;
uniform float uFront;
uniform float uOn;
uniform float uPourOn;
uniform float uField;
uniform float uRn;
uniform float uCuspL;
uniform float uOval;
uniform float uS0;
uniform float uS1;
uniform float uCapT;
uniform float uCapMax;
uniform float uStay;
uniform vec2 uRes;
uniform float uDpr;
varying float vV;
varying float vX;
varying float vA;
varying vec3 vCol;
varying float vPx;

// this streak (set once in main)
vec2 gB;
float gBl;
vec2 gDir;
float gWd;
float gWc;
vec3 gP0;
vec3 gE;
vec3 gAxS;
vec3 gNphi;
float gLin;
float gTe;
float gLfl;
float gU;

/**
 * Round the shield: the offset along the world's axis grows to the paraboloid's radius (soft upstream of the nose),
 * so the streaks level with the world part above and below it in calm parallel lanes; those far behind it pass.
 */
vec3 straightAt(float s) {
  float x = s + uRn * 1.2;
  // (pushed, the bow is pressed closer and its lanes turn sharper)
  float w = uRn * (0.45 - 0.12 * uPush);
  float sp = w * log(1.0 + exp(min(x / w, 30.0)));
  float rs2 = min(1.5 * uRn * sp, 2.6 * uRn * uRn);
  float g = exp(-pow(gB.y / (uR * 1.5), 2.0));
  float bx = (gB.x < 0.0 ? -1.0 : 1.0) * sqrt(gB.x * gB.x + gWd * g * rs2);
  return uC + uD * s + uSA * bx + uSB * gB.y;
}

/** Caught: in to the shield's high latitudes, then down the field line L = uCuspL to the oval. */
vec3 capturedAt(float q, out float alive) {
  alive = 1.0;
  gU = 0.0;
  if (q < gLin) return mix(gP0, gE, q / gLin);
  float u = (q - gLin) / gLfl;
  gU = u;
  alive = 1.0 - smoothstep(0.86, 1.0, u);
  float th = mix(gTe, uOval, clamp(u, 0.0, 1.0));
  float st = sin(th);
  float r = max(uCuspL * st * st, uR * 1.07);
  return uC + r * (cos(th) * gAxS + st * gNphi);
}

vec3 pathAt(float q, out float a) {
  vec3 p = straightAt(q - uS0);
  a = 1.0;
  if (gWc > 0.001) {
    float ac;
    vec3 pc = capturedAt(q, ac);
    p = mix(p, pc, gWc);
    a = mix(1.0, ac, gWc);
  }
  a *= smoothstep(uFront + 0.6, uFront - 2.5, q - uS0);
  a *= smoothstep(uR * 1.0, uR * 1.03, distance(p, uC));
  return p;
}

void hideS() {
  gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
  vA = 0.0;
  vV = 0.0;
  vX = 0.0;
  vPx = 1.0;
  vCol = vec3(0.0);
}

void main() {
  float id = aId;
  float row = position.x;
  float side = position.y;
  if (uOn <= 0.001 && uPourOn <= 0.001) {
    hideS();
    return;
  }
  // across the storm: a sheet, tall along the world's axis, thin in depth (mostly level with the world and behind
  // it, so it never rains over the night side), a little denser near the world
  float ux = hw(id, 1u) * 2.0 - 1.0;
  gB = vec2(sign(ux) * pow(abs(ux), 1.15) * 2.5, -0.7 + 2.3 * hw(id, 2u)) * uR;
  gBl = length(gB);
  gDir = gB / max(gBl, 1e-3);
  // each streak gives way to the field at its own strength; a few are caught and pour into a pole (those past uCapT
  // fly the caught path all along but only light while the visitor pushes)
  float hd = hw(id, 3u);
  gWd = smoothstep(hd * 0.4, hd * 0.4 + 0.32, uField);
  gWc = 0.0;
  gU = 0.0;
  float vis = 1.0;
  float hc = hw(id, 4u);
  if (gBl < uR * 1.8 && hc < uCapMax) {
    vis = 1.0 - smoothstep(uCapT - 0.03, uCapT + 0.03, hc);
    gWc = smoothstep(0.3, 0.7, uField);
    float az = (hw(id, 8u) - 0.5) * 2.3;
    gNphi = uNoon * cos(az) + uDusk * sin(az);
    gAxS = uAx * (gB.x >= 0.0 ? 1.0 : -1.0);
    gTe = asin(sqrt(clamp(uRn / uCuspL, 0.05, 0.97)));
    gE = uC + uRn * (cos(gTe) * gAxS + sin(gTe) * gNphi);
    gP0 = uC - uD * uS0 + uSA * gB.x + uSB * gB.y;
    gLin = distance(gP0, gE);
    gLfl = uCuspL * (gTe - uOval) * 1.15 + 0.01;
  }
  float speed = 30.0 + 24.0 * hw(id, 5u);
  float len = (2.0 + 3.6 * hw(id, 6u)) * (0.6 + speed / 135.0) * (1.0 + 0.6 * gWc) * (1.0 + 0.22 * uPush);
  float Lt = uS0 + uS1;
  float qh = fract(hw(id, 7u) + uFlow * speed / Lt) * Lt;
  float q = qh - len * (1.0 - row);
  float a0;
  float a1;
  vec3 p = pathAt(q, a0);
  float u = gU;
  vec3 p2 = pathAt(q + 0.2, a1);
  float life = smoothstep(0.0, 4.0, q) * smoothstep(Lt, Lt - 5.0, qh);
  // the front's leading band carries the light; behind it a thin wake; it thins downstream of the world, and toward
  // the sheet's edges
  float sh = qh - uS0;
  // the front's band is spent once it has passed the world
  float spent = 1.0 - smoothstep(0.0, uR * 2.6, uFront);
  float lead = (exp(-max(uFront - sh, 0.0) / 5.0) + 1.6 * exp(-max(uFront - sh, 0.0) / 1.2)) * spent;
  float wake = 1.0 - 0.75 * smoothstep(uR * 0.3, uR * 3.0, sh);
  float edge = 1.0 - smoothstep(uR * 1.3, uR * 2.5, gBl);
  // about a third of the streaks run on behind the front (and every caught one, which outlasts the sheet); pushed,
  // most of them do, each easing in
  float stay = max(1.0 - smoothstep(uStay - 0.06, uStay + 0.06, hw(id, 11u)), gWc);
  float on = mix(uOn, uPourOn, gWc);
  // a caught streak brightens as it comes down its field line into the oval
  float pour = gWc * smoothstep(0.0, 0.35, u);
  // pushed, the streaks the field turns light up along its storm side: the bow it holds (a band round the shield,
  // upstream of the world; the streak only brightens where it passes through it)
  vec3 rel = p - uC;
  float bow = gWd * (1.0 - gWc) * exp(-pow((length(rel) - uRn * 1.36) / (uRn * 0.3), 2.0)) *
    smoothstep(uRn * 0.5, -uRn * 0.4, dot(rel, uD));
  float I = (0.35 + 0.65 * hw(id, 9u)) * (1.4 * lead + 0.19 * stay * (1.0 + 0.4 * uPush)) * wake * (0.3 + 0.7 * edge) * on * life *
    (1.0 + 0.4 * gWc + (1.6 + 0.5 * uPush) * pour) * (1.0 + 2.4 * uPush * bow) * vis;
  vA = a0 * I;
  if (vA <= 0.0005 && a1 <= 0.0005) {
    hideS();
    return;
  }
  vec4 c0 = projectionMatrix * viewMatrix * vec4(p, 1.0);
  vec4 c1 = projectionMatrix * viewMatrix * vec4(p2, 1.0);
  if (c0.w < 0.1 || c1.w < 0.1) {
    hideS();
    return;
  }
  vec2 s0 = c0.xy / c0.w * uRes * 0.5;
  vec2 s1 = c1.xy / c1.w * uRes * 0.5;
  vec2 t = s1 - s0;
  t = length(t) > 1e-4 ? normalize(t) : vec2(1.0, 0.0);
  vec2 nrm = vec2(-t.y, t.x);
  float px = 1.3 * uDpr;
  vPx = px;
  vV = row;
  vX = side;
  float hue = hw(id, 10u);
  vec3 cold = hue < 0.2 ? vec3(0.66, 0.6, 1.0) : mix(vec3(0.55, 0.72, 1.0), vec3(0.86, 0.91, 1.0), (hue - 0.2) / 0.8);
  // caught streaks turn the aurora's colour as they come down
  vCol = mix(cold, vec3(0.3, 1.0, 0.74), gWc * smoothstep(0.2, 0.9, u));
  c0.xy += nrm * side * px / (uRes * 0.5) * c0.w;
  gl_Position = c0;
}
`;

export const STORM_FRAG = /* glsl */ `
${BAND}
uniform float uDpr;
varying float vV;
varying float vX;
varying float vA;
varying vec3 vCol;
varying float vPx;

void main() {
  if (vA <= 0.0005) discard;
  float x = abs(vX);
  float core = exp(-pow(x * vPx / (0.5 * uDpr), 2.0));
  float glow = (1.0 - x) * 0.08;
  // the head leads, the tail thins away behind it
  float along = pow(vV, 1.7) + 0.5 * smoothstep(0.88, 1.0, vV);
  gl_FragColor = vec4(vCol * (core + glow) * along * vA * 0.75 * bandDim(), 1.0);
}
`;

// ---------------------------------------------------------------------------------------------------------------
// the field: dipole loops r = L sin²(colatitude) about the world's axis (instanced ribbons). They rise from the
// equator as the field comes up (L grows), each breathing at its own phase (uBr), pressed in on the storm's side
// (uComp) and drawn out on the night side (uTail), more so while the visitor pushes; beads of the storm run down them
// toward the poles on the storm's clock. storm.ts fieldPoint is the same curve in TS.

const LOOP = /* glsl */ `
vec3 loopPos(float u, float L, float az) {
  float Le = mix(1.04, L, uFe) * uR * (1.0 + uBr * sin(uTime * uBrW + L * 3.7 + az * 0.61));
  float sf2 = clamp(uR / Le, 0.0, 0.999);
  float tf = asin(sqrt(sf2));
  float th = mix(tf, PI - tf, u);
  float st = sin(th);
  float w = (st * st - sf2) / (1.0 - sf2);
  float c = cos(az);
  float r = Le * st * st * (1.0 + w * (uTail * max(-c, 0.0) - uComp * max(c, 0.0)));
  return uC + r * (cos(th) * uAx + st * (uNoon * c + uDusk * sin(az)));
}
`;

export const FIELD_VERT = /* glsl */ `
${COMMON}
attribute vec2 aLoop;
uniform vec3 uC;
uniform float uR;
uniform vec3 uAx;
uniform vec3 uNoon;
uniform vec3 uDusk;
uniform float uTime;
uniform float uPush;
uniform float uFe;
uniform float uBr;
uniform float uBrW;
uniform float uTail;
uniform float uComp;
uniform float uOn;
uniform vec2 uRes;
uniform float uDpr;
varying float vU;
varying float vX;
varying float vI;
varying float vPx;
varying float vPh;
${LOOP}

void main() {
  float u = position.x;
  float side = position.y;
  if (uOn <= 0.001) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vI = 0.0;
    return;
  }
  vec3 p0 = loopPos(u, aLoop.x, aLoop.y);
  float e = u < 0.99 ? 0.01 : -0.01;
  vec3 p1 = loopPos(u + e, aLoop.x, aLoop.y);
  vec4 c0 = projectionMatrix * viewMatrix * vec4(p0, 1.0);
  vec4 c1 = projectionMatrix * viewMatrix * vec4(p1, 1.0);
  if (c0.w < 0.1 || c1.w < 0.1) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vI = 0.0;
    return;
  }
  vec2 s0 = c0.xy / c0.w * uRes * 0.5;
  vec2 s1 = c1.xy / c1.w * uRes * 0.5;
  vec2 t = (s1 - s0) * sign(e);
  t = length(t) > 1e-4 ? normalize(t) : vec2(1.0, 0.0);
  vec2 nrm = vec2(-t.y, t.x);
  // pushed, the lines draw taut: finer and brighter
  float px = 2.2 * uDpr * (1.0 - 0.12 * uPush);
  vPx = px;
  vU = u;
  vX = side;
  // the outer loops a little fainter; each glows and dims a little with its breath
  float breath = sin(uTime * uBrW + aLoop.x * 3.7 + aLoop.y * 0.61);
  // pushed, they brighten, most on the storm's side, where they hold it off
  vI = uOn * (1.25 - 0.18 * aLoop.x) * (0.86 + 0.14 * breath) * (1.0 + uPush * (0.9 + 0.8 * max(cos(aLoop.y), 0.0)));
  vPh = fract(aLoop.x * 3.7 + aLoop.y * 0.61);
  c0.xy += nrm * side * px / (uRes * 0.5) * c0.w;
  gl_Position = c0;
}
`;

export const FIELD_FRAG = /* glsl */ `
${BAND}
uniform float uDpr;
uniform float uFlow;
uniform float uPour;
varying float vU;
varying float vX;
varying float vI;
varying float vPx;
varying float vPh;

void main() {
  if (vI <= 0.0) discard;
  float x = abs(vX);
  float core = exp(-pow(x * vPx / (0.5 * uDpr), 2.0));
  float glow = exp(-x * 2.6) * (1.0 - x) * 0.22;
  float ends = smoothstep(0.0, 0.05, vU) * smoothstep(1.0, 0.95, vU);
  // beads of the storm running from the top of the loop down to its feet
  float d = abs(vU - 0.5) * 2.0;
  float q = fract(uFlow * 0.16 + vPh);
  float bead = exp(-pow((d - q) / 0.025, 2.0)) * smoothstep(0.0, 0.2, q) * uPour;
  vec3 col = mix(vec3(0.5, 0.72, 1.0), vec3(0.42, 1.0, 0.8), d * d) * ((core + glow) * (0.22 + 1.6 * bead));
  gl_FragColor = vec4(col * vI * ends * mix(1.0, bandDim(), 0.8), 1.0);
}
`;

// ---------------------------------------------------------------------------------------------------------------
// the aurora: a curtain round each pole on the oval (instanced: north, south), standing from the high air, its foot
// folding slowly; rays of a cold green-teal with a faint gold upper fringe, brighter where the sheet is seen edge-on
// (a longer path through its light), lit from noon round both ways.

export const AURORA_VERT = /* glsl */ `
${COMMON}
attribute float aPole;
attribute float aLayer;
uniform vec3 uC;
uniform float uR;
uniform vec3 uAx;
uniform vec3 uNoon;
uniform vec3 uDusk;
uniform float uOval;
uniform float uTime;
uniform float uAur;
uniform float uSpread;
varying vec2 vUv;
varying float vEdge;
varying float vAct;
varying float vPole;
varying float vLayer;
varying vec3 vW;

float fold(float phi, float t, float pole) {
  return 0.085 * sin(3.0 * phi + 0.09 * t + pole) + 0.05 * sin(5.0 * phi - 0.14 * t + 2.0 * pole) + 0.024 * sin(11.0 * phi + 0.23 * t + pole) +
    0.009 * sin(23.0 * phi - 0.4 * t);
}
vec3 ovalDir(float phi, float pole, float layer) {
  float th = uOval - 0.055 * layer + fold(phi + layer * 0.7, uTime, pole + layer * 1.7);
  return cos(th) * uAx * pole + sin(th) * (uNoon * cos(phi) + uDusk * sin(phi));
}

void main() {
  if (uAur <= 0.001) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vAct = 0.0;
    return;
  }
  float phi = position.x * 6.2831853;
  float v = position.y;
  vec3 d = ovalDir(phi, aPole, aLayer);
  // the curtain's top rises and falls along it, slowly
  float hs = 0.62 + 0.22 * sin(2.0 * phi + 0.05 * uTime + aPole + aLayer * 2.0) + 0.16 * sin(5.0 * phi - 0.08 * uTime + aLayer);
  vec3 p = uC + d * uR * (1.03 + (0.46 - 0.12 * aLayer) * v * hs);
  // the sheet's normal: level, across its foot
  vec3 tang = normalize(ovalDir(phi + 0.01, aPole, aLayer) - d);
  vec3 nrm = normalize(cross(tang, d));
  vec3 V = normalize(cameraPosition - p);
  // seen edge-on, a sheet's rays pile into a solid wall: let it thin out there instead
  vEdge = 0.42 + 0.58 * smoothstep(0.02, 0.4, abs(dot(nrm, V)));
  float dphi = abs(atan(sin(phi), cos(phi))) / PI;
  vAct = smoothstep(uSpread * 1.1 + 0.06, uSpread * 1.1 - 0.14, dphi);
  vUv = vec2(position.x, v);
  vPole = aPole;
  vLayer = aLayer;
  vW = p;
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}
`;

export const AURORA_FRAG = /* glsl */ `
uniform float uTime;
uniform float uAur;
uniform float uRich;
uniform vec3 uC;
uniform float uR;
varying vec2 vUv;
varying float vEdge;
varying float vAct;
varying float vPole;
varying float vLayer;
varying vec3 vW;

float h1(float n) {
  return fract(sin(n * 127.1 + 31.7) * 43758.5453);
}
/** Value noise along the ring, periodic in n cells. */
float vn(float x, float n) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(h1(mod(i, n)), h1(mod(i + 1.0, n)), f);
}
/**
 * The skyline of the rays' tops at xw along the ring (0..1 of the ray's reach): broad folds with finer ones on them,
 * irregular. (One fine octave alone rose and fell cell by cell in even ramps, and the gold fringe traced it as a
 * regular sawtooth.)
 */
float skyline(float xw, float t) {
  return 0.62 * vn(xw * 38.0 - t * 0.06, 38.0) + 0.38 * vn(xw * 97.0 - t * 0.15 + 7.0, 97.0);
}

void main() {
  if (vAct <= 0.002) discard;
  float x = vUv.x;
  float v = vUv.y;
  float t = uTime;
  // rays: fine and medium striations drifting along the curtain, a broad slow swell of brightness
  float sd = vPole * 17.0 + vLayer * 41.0;
  // a slow warp along the curtain, so the rays bunch and spread like folds of light, never stand evenly like a fence
  // (periodic round the ring: the warp is the same at both ends)
  float xw = x + 0.014 * (vn(x * 24.0 + t * 0.04 + sd, 24.0) - 0.5) + 0.004 * (vn(x * 61.0 - t * 0.07, 61.0) - 0.5);
  float n1 = uRich > 0.5 ? vn(xw * 420.0 + t * 0.7 + sd, 420.0) : 0.5;
  float n2 = vn(xw * 150.0 - t * 0.32 + sd * 0.3, 150.0);
  float n3 = vn(x * 16.0 + t * 0.05 + vLayer * 5.0, 16.0);
  // soft rays: a veil of light with brighter striations in it, not stripes on black
  float ray = 0.3 + 0.7 * pow(0.4 * n1 + 0.6 * n2, 1.35);
  // each ray reaches its own height; the green falls away upward and the tallest rays end in a gold fringe
  float sk = skyline(xw, t);
  float top = 0.42 + 0.58 * sk * (0.6 + 0.4 * n3);
  // how steeply the skyline climbs here (per unit of the ring): the fringe keeps to its level crests
  float slope = abs(skyline(xw + 0.0015, t) - skyline(xw - 0.0015, t)) / 0.003;
  // the foot comes up out of the air, it does not stand on a line
  float lower = smoothstep(0.0, 0.2, v) * (1.0 + 0.12 * exp(-v * 10.0));
  // ...and where the curtain goes behind the world, it sinks behind the limb softly: the depth test alone cuts it off
  // along the limb in one hard, flat edge
  vec3 rd = normalize(vW - cameraPosition);
  float L = length(vW - cameraPosition);
  float dmin = length(cameraPosition + rd * clamp(dot(uC - cameraPosition, rd), 0.0, L) - uC);
  float limb = smoothstep(uR * 1.005, uR * 1.09, dmin);
  float body = exp(-v * 2.2 / top);
  // the fringe: a soft warm edge just under each ray's own top, on the taller rays only, on the crests of the skyline
  // (on its steep flanks it would draw the skyline's zigzag as a line)
  float fringe = exp(-pow((v - top * 0.9) / 0.14, 2.0)) * smoothstep(0.32, 0.62, v) * (0.3 + 0.7 * ray) * (1.0 - smoothstep(6.0, 22.0, slope));
  float breathe = 0.35 + 0.65 * (0.5 + 0.5 * sin(x * 12.566 - t * 0.18 + vPole + vLayer * 2.0)) * (0.3 + 0.7 * n3);
  vec3 teal = vec3(0.12, 0.72, 0.52);
  vec3 gold = vec3(0.95, 0.58, 0.24);
  vec3 col = (teal * lower * body * ray + gold * fringe * 0.2) * breathe;
  col *= vAct * uAur * vEdge * limb * (1.0 - smoothstep(0.82, 1.0, v)) * (0.78 - 0.36 * vLayer);
  gl_FragColor = vec4(col, 1.0);
}
`;
