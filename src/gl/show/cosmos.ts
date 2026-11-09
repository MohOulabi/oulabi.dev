/**
 * The solid things of genesis (docs/STORY.md figs 3-11): the sun (a churning photosphere, a corona of streamers), the
 * shock of its first light through the disk, the planets the disk condenses into (each its own world, lit by the
 * sun), the giant's rings, faint orbit trails, and the young stars that light the nebula from within. The engine
 * sets the public fields from story time every frame; nothing here keeps state of its own beyond scratch vectors.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  type Data3DTexture,
  DoubleSide,
  Group,
  Line,
  Matrix3,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Quaternion,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  Vector4,
} from "three";
import { shared } from "@/gl/shared";
import { axisTurn, AXIS as EARTH_AXIS } from "@/gl/world/layout";
import { HANDOFF, PLANET } from "@/lib/journey";
import { clamp01 } from "@/lib/math";
import { DISK_INNER, DISK_SHRINK, GIANT_RING_N, PLANETS, SUN, SUN_R, WORLD } from "./constants";

/* ---- the genesis map on the CPU (mirrors glsl/genesis.ts GENESIS) ---- */
const diskR = (r0: number, c: number) => r0 * (1 - DISK_SHRINK * c) + DISK_INNER * c;
const diskWind = (r: number) => 2.6 * (Math.max(r, 4.5) / 30) ** -1.5;
const diskOmega = (r: number) => 0.075 * (Math.max(r, 4.5) / 30) ** -1.5;
const diskH = (r: number) => 0.026 + 0.055 * clamp01(r / 80);

/** A soft ceiling: x below `knee`, easing toward `max` above it (continuous, with a continuous slope). */
const softCap = (x: number, knee: number, max: number) =>
  x <= knee ? x : knee + (max - knee) * (1 - Math.exp(-(x - knee) / (max - knee)));
/** The capped turn (rad) for a single light carried into the heart of the disk (the knots, your point). */
const WIND_KNEE = 2.6;
const WIND_MAX = 1.2 * Math.PI;
const SPIN_MAX = 0.6;

/**
 * Rest offset -> world position (sun + collapsed offset), the same map the motes follow. `shift` (fig. 3) is what the
 * knots' fall and the field's slide add to it before the collapse (glsl/genesis.ts fallMap; figures/genesis.ts).
 * `capped`: for one light falling into the heart (a knot, your point) the shear's turn is held under about 1.2π and
 * the spin's under SPIN_MAX, so near the centre, where the shear grows without bound, it never whips round the sun in
 * a sliver of story time (its dust is spread over many motes; one marked light would read as a jump).
 */
export function genesisPoint(
  q: Vector3,
  c: number,
  spinC: number,
  expand: number,
  bangOff: Vector3,
  out: Vector3,
  shift?: Vector3,
  capped = false,
) {
  const e = Math.max(expand, 0.04);
  const qx = q.x * e + bangOff.x * (1 - e) + (shift ? shift.x : 0);
  const qy = q.y * e + bangOff.y * (1 - e) + (shift ? shift.y : 0);
  const qz = q.z * e + bangOff.z * (1 - e) + (shift ? shift.z : 0);
  const r0 = Math.hypot(qx, qz);
  const a0 = Math.atan2(qz, qx);
  const r = diskR(r0, c);
  const wind = capped ? softCap(diskWind(r), WIND_KNEE, WIND_MAX) : diskWind(r);
  const spin = capped ? Math.min(diskOmega(r) * spinC, SPIN_MAX) : diskOmega(r) * spinC;
  const a = a0 + c * (wind + spin);
  return out.set(
    SUN[0] + Math.cos(a) * r,
    SUN[1] + qy * (1 + (diskH(r) - 1) * c),
    SUN[2] + Math.sin(a) * r,
  );
}

/**
 * The orbits this frame, as the system's orbit model (figures/orbits.ts) writes them: per planet a, e, peri, inc,
 * node (stride 5), the orbit's frame (P toward periapsis, Q a quarter turn on) and the planet's angle from periapsis.
 */
export type OrbitState = {
  el: Float32Array;
  P: Vector3[];
  Q: Vector3[];
  nu: Float32Array;
  pos: Vector3[];
};

const BILLBOARD = /* glsl */ `
uniform vec3 uCenter;
uniform vec2 uSize;
varying vec2 vUv;
void main() {
  vUv = position.xy;
  vec4 mv = viewMatrix * vec4(uCenter, 1.0);
  mv.xy += position.xy * uSize;
  gl_Position = projectionMatrix * mv;
}
`;

const SPHERE_VERT = /* glsl */ `
uniform float uSpin;
varying vec3 vN;
varying vec3 vW;
varying vec3 vO;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  float c = cos(uSpin);
  float s = sin(uSpin);
  vO = vec3(c * position.x + s * position.z, position.y, -s * position.x + c * position.z);
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

/** The planets: as SPHERE_VERT, each turned by its own uOrient (world -> the planet's own frame, set per frame). */
const PLANET_VERT = /* glsl */ `
uniform mat3 uOrient;
varying vec3 vN;
varying vec3 vW;
varying vec3 vO;
void main() {
  vN = normalize(mat3(modelMatrix) * normal);
  vO = uOrient * position;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

/**
 * A blazing star, not a pale moon: a white core through gold to a deep red-orange limb (limb darkening sets the
 * hue, so the colour survives the tone map: the core sits near 1.8 before it), fine churning granulation (two
 * octaves of cells, ±12 %, faded where a cell would be finer than a pixel), a few small spots with a warm penumbra
 * (never grey), and a thin bright chromosphere at the rim. uHot: the first seconds after ignition, white-hot.
 */
const SUN_FRAG = /* glsl */ `
uniform highp sampler3D tNoise;
uniform float uTime;
uniform float uI;
uniform float uHot;
varying vec3 vN;
varying vec3 vW;
varying vec3 vO;
void main() {
  vec3 n = normalize(vN);
  vec3 V = normalize(cameraPosition - vW);
  float mu = clamp(dot(n, V), 0.0, 1.0);
  vec3 o = normalize(vO);
  // the convection: cells drifting through a slow warp (worley in g and a: bright cells, dark lanes)
  vec4 w = texture(tNoise, o * 0.35 + vec3(0.0, uTime * 0.006, uTime * 0.004));
  vec3 p = o + (w.rgb - 0.5) * 0.14;
  float g1 = texture(tNoise, p * 3.2 + vec3(uTime * 0.012, 0.0, 0.0)).g;
  float g2 = texture(tNoise, p * 7.4 + vec3(0.0, uTime * 0.02, 0.0)).a;
  // (cells finer than a pixel would shimmer: the octaves fade out as the disc gets small on screen)
  float fw = length(fwidth(o));
  float d1 = 1.0 - smoothstep(0.05, 0.12, fw * 3.2);
  float d2 = 1.0 - smoothstep(0.05, 0.12, fw * 7.4);
  float gx = ((g1 - 0.5) * 0.7 * d1 + (g2 - 0.5) * 0.45 * d2) * 1.15;
  // spots: small and rare, a dark warm umbra in an orange penumbra
  float sn = texture(tNoise, o * 2.4 + vec3(0.3, 0.7, 0.1)).r;
  float pen = smoothstep(0.765, 0.8, sn) * d1;
  float umb = smoothstep(0.8, 0.83, sn) * d1;
  // limb darkening sets the colour: deep red-orange at the limb, orange-gold, a warm white-gold core. The ramp is
  // saturated well past what it should look like, because the tone map (AgX) pales whatever is bright: at uI 2.2
  // these land on about #9E3F1B, #DE9861 and #F7D7AA on screen
  float t = pow(mu, 0.45);
  vec3 limb = vec3(0.16, 0.014, 0.0);
  vec3 gold = vec3(0.62, 0.13, 0.004);
  vec3 core = vec3(1.75, 0.62, 0.045);
  vec3 c = mix(limb, gold, smoothstep(0.0, 0.55, t));
  c = mix(c, core, smoothstep(0.62, 1.0, t));
  // the cells: bright and yellower at their hearts, the lanes between them darker and redder (±12 %)
  c *= (1.0 + gx) * mix(vec3(1.0, 0.8, 0.6), vec3(1.0, 1.12, 1.25), clamp(0.5 + gx * 4.0, 0.0, 1.0));
  c = mix(c, c * vec3(1.0, 0.5, 0.2) * 0.7, pen);
  c = mix(c, vec3(0.06, 0.012, 0.0), umb * 0.85);
  // the chromosphere: a thin red rim just inside the limb
  c += vec3(0.9, 0.12, 0.02) * exp(-mu * 24.0) * 0.5;
  c = mix(c, vec3(1.6, 1.0, 0.5), uHot);
  gl_FragColor = vec4(c * uI, 1.0);
}
`;

const CORONA_FRAG = /* glsl */ `
uniform highp sampler3D tNoise;
uniform float uTime;
uniform float uI;
uniform float uR0;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  if (r > 1.0) discard;
  float a = atan(vUv.y, vUv.x);
  vec2 ring = vec2(cos(a), sin(a));
  // streamers: noise around the rim, stretched outward, slowly turning
  float s1 = texture(tNoise, vec3(ring * 0.32, uTime * 0.012) + vec3(0.5)).r;
  float s2 = texture(tNoise, vec3(ring * 0.9, uTime * 0.02 - r * 0.25) + vec3(0.2)).b;
  float streak = pow(clamp(s1 * 0.65 + s2 * 0.5, 0.0, 1.0), 3.0);
  float x = max(r - uR0, 0.0);
  float glow = exp(-x * 14.0) * 0.8 + exp(-x * 5.0) * 0.14;
  float rays = streak * exp(-x * 5.5) * 1.3;
  float inner = smoothstep(uR0 * 0.9, uR0 * 1.02, r);
  float v = (glow + rays) * inner * (1.0 - smoothstep(0.75, 1.0, r));
  // ember out in the streamers, gold near the limb (saturated: the tone map pales it to a warm glow)
  vec3 c = mix(vec3(1.0, 0.26, 0.04), vec3(1.0, 0.6, 0.2), exp(-x * 6.0));
  gl_FragColor = vec4(c * v * uI, 1.0);
}
`;

/**
 * The shock of first light, in the disk plane: a hairline front (its width fixed, a gentle ±8 % tear around it), gold
 * at its leading edge cooling to ember behind, thinning as it spreads (it is seen mostly in the dust it lights:
 * glsl/genesis.ts uShock), gone by the disk's visible edge.
 */
const SHOCK_FRAG = /* glsl */ `
uniform float uR;
uniform float uW;
uniform float uI;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  float ang = atan(vUv.y, vUv.x);
  float w = uW * (1.0 + 0.08 * sin(ang * 7.0 + 1.1) * sin(ang * 3.0 - 0.4));
  float x = (r - uR) / w;
  float ring = exp(-x * x);
  float wake = exp(-max(0.0, uR - r) / (uW * 14.0)) * step(r, uR) * 0.12;
  float fade = (1.0 - uR) * (1.0 - uR) * (1.0 - smoothstep(0.42, 0.6, uR));
  vec3 c = mix(vec3(1.0, 0.36, 0.1), vec3(1.0, 0.74, 0.4), smoothstep(-1.5, 0.6, x)) * ring + vec3(1.0, 0.4, 0.12) * wake;
  gl_FragColor = vec4(c * uI * fade, 1.0);
}
`;

const SHOCK_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const STAR_FRAG = /* glsl */ `
uniform float uI;
uniform vec3 uCol;
varying vec2 vUv;
void main() {
  vec2 a = abs(vUv);
  float r = length(vUv);
  float core = exp(-r * r * 160.0) * 3.0 + exp(-r * 11.0) * 0.5 + exp(-r * 3.4) * 0.08;
  // short diffraction spikes: a star picked out, never a line across the page
  float spikes = (exp(-a.y * 200.0) * exp(-a.x * 11.0) + exp(-a.x * 200.0) * exp(-a.y * 11.0)) * 0.45;
  float v = (core + spikes) * (1.0 - smoothstep(0.8, 1.0, r));
  vec3 c = mix(uCol, vec3(1.0), smoothstep(0.05, 0.0, r));
  gl_FragColor = vec4(c * v * uI, 1.0);
}
`;

/** One shader for every planet; uKind picks the world. The dissolve is the motes becoming solid. */
const PLANET_FRAG = /* glsl */ `
uniform highp sampler3D tNoise;
uniform vec3 uSunP;
uniform float uKind;
uniform float uFade;
uniform float uAlpha;
uniform float uTime;
uniform float uSunI;
uniform vec3 uAtmo;
/** The world: Earth's surface as the world module baked it (shared.earth: R the land about the coast at 0.5, G the
 *  cloud), its presence (0 until it is baked, easing in after) and the cloud's turn about y. */
uniform samplerCube uSurf;
uniform float uSurfK;
uniform float uCloud;
/** Earth's axis (geographic north) in its rest frame: the land's climate by latitude. */
uniform vec3 uAx;
varying vec3 vN;
varying vec3 vW;
varying vec3 vO;
vec3 turnY(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}
float n3(vec3 p, int ch) {
  vec4 t = texture(tNoise, p);
  return ch == 0 ? t.r : ch == 1 ? t.g : ch == 2 ? t.b : t.a;
}
void main() {
  vec3 o = normalize(vO);
  // materialise: fine grains of the sphere appear as the motes gather on it
  float grain = texture(tNoise, o * 7.0 + 0.13).g * 0.55 + texture(tNoise, o * 19.0 + 0.4).a * 0.45;
  grain = clamp((grain - 0.28) / 0.44, 0.0, 1.0);
  if (grain > uFade * 1.04 - 0.02) discard;
  vec3 N = normalize(vN);
  vec3 L = normalize(uSunP - vW);
  vec3 V = normalize(cameraPosition - vW);
  float ndl = dot(N, L);
  float lat = o.y;
  vec3 alb;
  vec3 glow = vec3(0.0);
  vec4 w = texture(tNoise, o * 0.45 + vec3(0.0, 0.0, uTime * 0.004));
  float amb = 0.006;
  if (uKind < 0.5) {
    // a young ember world: dark basalt, lava in the cracks (it glows on the night side). The cracks are the noise's
    // median contour, drawn a pixel wide whatever the planet's size (wider and fainter when it is small), so they
    // read as fine lava lines, never as dots
    float rock = texture(tNoise, o * 0.9).r;
    alb = mix(vec3(0.09, 0.06, 0.05), vec3(0.32, 0.18, 0.1), rock);
    float cb = texture(tNoise, o * 0.6 + (w.rgb - 0.5) * 0.2).b - 0.5;
    float cw = max(0.007, fwidth(cb));
    float crack = (1.0 - smoothstep(0.0, cw, abs(cb))) * min(1.0, 0.014 / cw);
    glow = vec3(1.0, 0.3, 0.05) * crack * 1.3;
  } else if (uKind < 1.5) {
    // a gold world under thick cloud: soft bands, slow swirls; the cloud deck holds a little warm light on the night
    // side, so it reads gold from any side, never grey
    float b = sin(lat * 9.0 + (w.r - 0.5) * 5.0 + texture(tNoise, o * 1.4).g * 1.5);
    alb = mix(vec3(0.7, 0.4, 0.13), vec3(1.0, 0.76, 0.4), 0.5 + 0.5 * b);
    amb = 0.03;
  } else if (uKind < 2.5) {
    // the world: Earth (o is its rest frame, the world module's): deep oceans, ochre land, white weather, the same land
    // and cloud the world module draws from fig. 8 on (a plain sea until the map is baked, then they ease in)
    vec4 e = texture(uSurf, o);
    float aa = fwidth(e.r) + 0.0015;
    float isLand = smoothstep(0.5 - aa, 0.5 + aa, e.r) * uSurfK;
    float elev = clamp((e.r - 0.5) * 2.2, 0.0, 1.0);
    vec3 sea = mix(vec3(0.012, 0.035, 0.08), vec3(0.03, 0.09, 0.16), texture(tNoise, o * 2.0).g);
    // the land by its climate (the world module's day side reads the same bands, world/shaders.ts): sand in the
    // subtropical deserts (the Sahara, Arabia), deep green in the tropics and the north, ice at the poles
    float sl = abs(dot(o, uAx));
    float vary = texture(tNoise, o * 3.1).r;
    float desert = exp(-pow((sl - 0.42) / 0.17, 2.0)) * smoothstep(0.52, 0.7, e.r + 0.12 * vary);
    vec3 green = mix(vec3(0.12, 0.15, 0.07), vec3(0.2, 0.21, 0.1), vary);
    vec3 sand = mix(vec3(0.46, 0.33, 0.19), vec3(0.64, 0.5, 0.31), clamp(elev * 0.6 + 0.5 * vary, 0.0, 1.0));
    vec3 ground = mix(green, sand, desert);
    ground = mix(ground, vec3(0.74, 0.77, 0.8), smoothstep(0.84, 0.93, sl));
    alb = mix(sea, ground, isLand);
    float cloud = texture(uSurf, turnY(o, uCloud)).g * uSurfK;
    alb = mix(alb, vec3(0.85, 0.87, 0.9), cloud * 0.8);
  } else if (uKind < 3.5) {
    // the giant: bands of cream, gold and ember, torn by turbulence, one great storm
    float tb = (texture(tNoise, o * vec3(0.6, 2.2, 0.6) + vec3(uTime * 0.002, 0.0, 0.0)).r - 0.5) * 0.9;
    float b = sin(lat * 15.0 + tb * 4.0) * 0.5 + 0.5;
    float b2 = sin(lat * 37.0 + tb * 7.0) * 0.5 + 0.5;
    alb = mix(vec3(0.7, 0.45, 0.24), vec3(0.96, 0.86, 0.66), b);
    alb = mix(alb, vec3(0.62, 0.24, 0.1), (1.0 - b2) * 0.35);
    vec3 sc = vec3(0.6, -0.32, 0.74);
    float storm = exp(-pow(length(o - normalize(sc)) / 0.12, 2.0));
    alb = mix(alb, vec3(0.78, 0.3, 0.14), storm * 0.8);
  } else {
    // ice: pale, banded faintly, cold
    float b = sin(lat * 7.0 + (w.g - 0.5) * 3.0) * 0.5 + 0.5;
    alb = mix(vec3(0.5, 0.66, 0.82), vec3(0.82, 0.9, 0.96), b);
  }
  float diff = max(ndl, 0.0);
  float wrap = smoothstep(-0.12, 0.35, ndl);
  vec3 col = alb * (diff * 1.35 + 0.012) * uSunI + alb * amb;
  // the atmosphere: forward-scattered light around the limb on the lit side, a thin line over the terminator
  float mu = max(dot(N, V), 0.0);
  float fres = pow(1.0 - mu, 3.2);
  col += uAtmo * fres * (wrap * 1.6 + 0.04) * uSunI;
  float back = pow(max(dot(-V, L), 0.0), 6.0) * fres * 2.5;
  col += uAtmo * back * uSunI;
  col += glow * (1.0 - smoothstep(-0.2, 0.2, ndl) * 0.85);
  gl_FragColor = vec4(col, uAlpha);
}
`;

const RING_VERT = /* glsl */ `
varying vec3 vW;
varying vec2 vP;
void main() {
  vP = position.xy;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

const RING_FRAG = /* glsl */ `
uniform highp sampler3D tNoise;
uniform vec3 uSunP;
uniform vec3 uPlanetP;
uniform float uPlanetR;
uniform float uIn;
uniform float uOut;
uniform float uFade;
uniform float uSunI;
varying vec3 vW;
varying vec2 vP;
void main() {
  float r = length(vP);
  float x = (r - uIn) / (uOut - uIn);
  if (x < 0.0 || x > 1.0) discard;
  float bands = texture(tNoise, vec3(x * 0.9, 0.31, 0.57)).r * 0.6 + texture(tNoise, vec3(x * 2.7, 0.71, 0.13)).b * 0.4;
  float a = smoothstep(0.32, 0.7, bands) * (0.35 + 0.65 * smoothstep(0.0, 0.1, x)) * (1.0 - smoothstep(0.88, 1.0, x));
  a *= 1.0 - 0.85 * exp(-pow((x - 0.62) / 0.03, 2.0));
  // the planet's shadow across the rings: soft at its edge (the sun is a disc, not a point), never fully black
  vec3 L = normalize(uSunP - vW);
  vec3 oc = vW - uPlanetP;
  float b = dot(oc, L);
  float dPerp = sqrt(max(dot(oc, oc) - b * b, 0.0));
  float shadow = b < 0.0 ? mix(0.15, 1.0, smoothstep(uPlanetR * 0.9, uPlanetR * 1.08, dPerp)) : 1.0;
  vec3 col = mix(vec3(0.62, 0.48, 0.32), vec3(0.95, 0.85, 0.68), bands) * (0.6 * shadow * uSunI + 0.01);
  gl_FragColor = vec4(col * a * uFade, a * uFade * 0.92);
}
`;

/** An orbit trail: the ellipse (a, e) in its tilted frame (P toward periapsis, Q a quarter turn on), aAng from periapsis. */
const ORBIT_VERT = /* glsl */ `
attribute float aAng;
uniform float uPA;
uniform float uA;
uniform float uE;
uniform vec3 uP;
uniform vec3 uQ;
varying float vT;
void main() {
  float d = uPA - aAng;
  d -= 6.2831853 * floor(d / 6.2831853);
  vT = d;
  float r = uA * (1.0 - uE * uE) / (1.0 + uE * cos(aAng));
  vec3 p = (uP * cos(aAng) + uQ * sin(aAng)) * r;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`;

const ORBIT_FRAG = /* glsl */ `
uniform float uI;
varying float vT;
void main() {
  float tail = exp(-vT * 1.4) * 0.85 + 0.12;
  gl_FragColor = vec4(vec3(1.0, 0.78, 0.5) * tail * uI, 1.0);
}
`;

type Sprite = { mesh: Mesh; m: ShaderMaterial };

function sprite(
  frag: string,
  uniforms: Record<string, { value: unknown }>,
  depthTest = true,
): Sprite {
  const m = new ShaderMaterial({
    uniforms: { uCenter: { value: new Vector3() }, uSize: { value: [1, 1] }, ...uniforms },
    vertexShader: BILLBOARD,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    depthTest,
    blending: AdditiveBlending,
  });
  const mesh = new Mesh(new PlaneGeometry(2, 2), m);
  mesh.frustumCulled = false;
  mesh.visible = false;
  mesh.renderOrder = 3;
  return { mesh, m };
}

const ATMO: [number, number, number][] = [
  [1.0, 0.45, 0.2],
  [1.0, 0.7, 0.32],
  [0.35, 0.62, 1.0],
  [1.0, 0.8, 0.55],
  [0.5, 0.85, 1.0],
];

/**
 * A point given in the view of a camera around the sun (azimuth and elevation in degrees, as poses/genesis.ts and
 * camera.ts sunOrbit place it; x right, y up, z toward the camera) as a rest offset from the sun.
 */
export function inView(
  az: number,
  el: number,
  x: number,
  y: number,
  z: number,
): [number, number, number] {
  const a = (az * Math.PI) / 180;
  const e = (el * Math.PI) / 180;
  const sa = Math.sin(a);
  const ca = Math.cos(a);
  const se = Math.sin(e);
  const ce = Math.cos(e);
  return [x * ca - y * sa * se + z * sa * ce, y * ce + z * se, -x * sa - y * ca * se + z * ca * ce];
}

/**
 * Young stars inside the nebula (rest offsets from the sun, intensity): they light the gas from within through fig. 2.
 * The first three are where fig. 3's knots kindle (figures/genesis.ts KNOTS takes its places from here, laid out in
 * the view of fig. 3's camera, az 24°, el 22°): each knot grows out of its young star as the star steps back, so
 * fig. 2 hands over to fig. 3 without a cut. 0 becomes the loud knot (hot, blue-white), 1 the heaviest (deep amber,
 * quieter), 2 the one between; the fourth just steps back.
 */
export const YOUNG: [number, number, number, number][] = [
  [...inView(24, 22, -26, 2, -4), 1.3],
  [...inView(24, 22, 1, -6, 5), 0.8],
  [...inView(24, 22, 25, 9, -3), 1.0],
  [-10, -24, -50, 0.9],
];
const YOUNG_COL: [number, number, number][] = [
  [0.78, 0.88, 1.0],
  [1.0, 0.62, 0.32],
  [1.0, 0.8, 0.56],
  [1.0, 0.9, 0.78],
];

/**
 * Earth's turn about its axis (rad, east positive) at story time T, in the core show's figs 4-7: EARTH_RATE per unit of
 * story time, easing to rest over EARTH_SETTLE and at rest (0: the world module's frame, Riyadh at its hub) from the
 * hand-off on, so the planet the probe falls toward is already the world it lands on.
 */
const EARTH_RATE = 0.9;
const EARTH_SETTLE = 0.6;
const EARTH_REST = HANDOFF.WORLD_HANDOFF[0];
function earthSpin(T: number) {
  const t0 = EARTH_REST - EARTH_SETTLE;
  if (T >= EARTH_REST) return 0;
  if (T >= t0) {
    const v = 1 - (T - t0) / EARTH_SETTLE;
    return -0.5 * EARTH_RATE * EARTH_SETTLE * v * v;
  }
  return -0.5 * EARTH_RATE * EARTH_SETTLE + EARTH_RATE * (T - t0);
}
/** How long the baked surface takes to ease in on the world planet (ms; the world module's own SURF_FADE). */
const SURF_FADE = 700;

export class Cosmos {
  readonly group = new Group();
  readonly sun: Mesh;
  readonly sunM: ShaderMaterial;
  readonly corona: Sprite;
  readonly shock: Mesh;
  readonly shockM: ShaderMaterial;
  readonly planets: Mesh[] = [];
  readonly planetM: ShaderMaterial[] = [];
  readonly ring: Mesh;
  readonly ringM: ShaderMaterial;
  readonly orbits: Line[] = [];
  readonly orbitM: ShaderMaterial[] = [];
  readonly young: Sprite[] = [];
  /**
   * The world's silhouette in the depth buffer (no colour), from the hand-off while the world module draws it opaque:
   * the sun, its corona and the stars stay behind the world whatever the world module draws over it (it sits just
   * inside PLANET.radius).
   */
  readonly occluder: Mesh;
  occluderOn = false;
  /** Planet positions (world) and radii this frame, for the sim and the gas (xyz, radius). */
  readonly planetV: Vector4[] = PLANETS.map(() => new Vector4());

  // inputs, set by the engine every frame
  ignite = 0;
  hot = 0;
  sunVis = 0;
  sunScale = 0;
  coronaI = 0;
  shockR = 0;
  shockI = 0;
  planetFade = 0;
  worldFade = 0;
  orbitsI = 0;
  youngI = 0;
  ringFade = 0;
  /** The other planets step back once the camera reaches the world (they would crowd figs 8-10). */
  othersFade = 1;
  /** Fig. 5: the visitor's hold deepens the sun's pull (0..1): it swells and brightens a touch. */
  sunBoost = 0;
  /** Fig. 7: the camera stops down as it rides close past the sun (1 far away, less up close). */
  sunExposure = 1;
  /** The orbits this frame (the system's orbit model; the trails follow their ellipses). */
  orbitSrc: OrbitState | null = null;

  private sphere = new SphereGeometry(1, 96, 48);
  private q1 = new Quaternion();

  constructor(noise: Data3DTexture) {
    this.sunM = new ShaderMaterial({
      uniforms: {
        tNoise: { value: noise },
        uTime: { value: 0 },
        uI: { value: 0 },
        uHot: { value: 0 },
        uSpin: { value: 0 },
      },
      vertexShader: SPHERE_VERT,
      fragmentShader: SUN_FRAG,
    });
    this.sun = new Mesh(this.sphere, this.sunM);
    this.sun.position.set(...SUN);
    this.sun.visible = false;
    this.sun.frustumCulled = false;
    this.group.add(this.sun);

    this.corona = sprite(CORONA_FRAG, {
      tNoise: { value: noise },
      uTime: { value: 0 },
      uI: { value: 0 },
      uR0: { value: 0.16 },
    });
    this.corona.m.uniforms.uCenter.value.set(...SUN);
    this.group.add(this.corona.mesh);

    this.shockM = new ShaderMaterial({
      uniforms: { uR: { value: 0.1 }, uW: { value: 0.01 }, uI: { value: 0 } },
      vertexShader: SHOCK_VERT,
      fragmentShader: SHOCK_FRAG,
      transparent: true,
      depthWrite: false,
      blending: AdditiveBlending,
      side: DoubleSide,
    });
    this.shock = new Mesh(new PlaneGeometry(2, 2), this.shockM);
    this.shock.position.set(...SUN);
    this.shock.rotation.x = -Math.PI / 2;
    this.shock.scale.setScalar(70);
    this.shock.visible = false;
    this.shock.renderOrder = 3;
    this.group.add(this.shock);

    PLANETS.forEach((p, k) => {
      const m = new ShaderMaterial({
        uniforms: {
          tNoise: { value: noise },
          uSunP: { value: new Vector3(...SUN) },
          uKind: { value: k },
          uFade: { value: 0 },
          uAlpha: { value: 1 },
          uTime: { value: 0 },
          uSunI: { value: 1 },
          uOrient: { value: new Matrix3() },
          uAtmo: { value: new Vector3(...ATMO[k]) },
          uSurf: { value: null },
          uSurfK: { value: 0 },
          uCloud: { value: 0 },
          uAx: { value: EARTH_AXIS },
        },
        vertexShader: PLANET_VERT,
        fragmentShader: PLANET_FRAG,
      });
      const mesh = new Mesh(this.sphere, m);
      mesh.scale.setScalar(p.r);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.planets.push(mesh);
      this.planetM.push(m);

      // orbit trail
      const n = 384;
      const g = new BufferGeometry();
      const pos = new Float32Array(n * 3);
      const ang = new Float32Array(n);
      for (let i = 0; i < n; i++) ang[i] = (i / n) * Math.PI * 2;
      g.setAttribute("position", new BufferAttribute(pos, 3));
      g.setAttribute("aAng", new BufferAttribute(ang, 1));
      const om = new ShaderMaterial({
        uniforms: {
          uPA: { value: 0 },
          uA: { value: p.orbit },
          uE: { value: 0 },
          uP: { value: new Vector3(1, 0, 0) },
          uQ: { value: new Vector3(0, 0, 1) },
          uI: { value: 0 },
        },
        vertexShader: ORBIT_VERT,
        fragmentShader: ORBIT_FRAG,
        transparent: true,
        depthWrite: false,
        blending: AdditiveBlending,
      });
      const line = new Line(g, om);
      line.position.set(...SUN);
      line.frustumCulled = false;
      line.visible = false;
      line.renderOrder = 1;
      this.group.add(line);
      this.orbits.push(line);
      this.orbitM.push(om);
    });

    const g = PLANETS[3];
    this.ringM = new ShaderMaterial({
      uniforms: {
        tNoise: { value: noise },
        uSunP: { value: new Vector3(...SUN) },
        uPlanetP: { value: new Vector3() },
        uPlanetR: { value: g.r },
        uIn: { value: g.r * 1.45 },
        uOut: { value: g.r * 2.4 },
        uFade: { value: 0 },
        uSunI: { value: 1 },
      },
      vertexShader: RING_VERT,
      fragmentShader: RING_FRAG,
      transparent: true,
      depthWrite: false,
      side: DoubleSide,
    });
    this.ring = new Mesh(new RingGeometry(g.r * 1.4, g.r * 2.45, 160, 1), this.ringM);
    this.q1.setFromUnitVectors(new Vector3(0, 0, 1), new Vector3(...GIANT_RING_N).normalize());
    this.ring.quaternion.copy(this.q1);
    this.ring.visible = false;
    this.ring.frustumCulled = false;
    this.ring.renderOrder = 2;
    this.group.add(this.ring);

    YOUNG.forEach((_, i) => {
      const s = sprite(STAR_FRAG, {
        uI: { value: 0 },
        uCol: { value: new Vector3(...YOUNG_COL[i]) },
      });
      this.young.push(s);
      this.group.add(s.mesh);
    });

    this.occluder = new Mesh(this.sphere, new MeshBasicMaterial({ colorWrite: false }));
    this.occluder.position.set(...PLANET.center);
    this.occluder.scale.setScalar(PLANET.radius * 0.996);
    this.occluder.renderOrder = -2;
    this.occluder.visible = false;
    this.occluder.frustumCulled = false;
    this.group.add(this.occluder);
  }

  /** Planet positions this frame from the system's orbit model (call first each frame: the sim and the gas read them). */
  place(o: OrbitState) {
    this.orbitSrc = o;
    for (let k = 0; k < PLANETS.length; k++) {
      const p = o.pos[k];
      this.planetV[k].set(p.x, p.y, p.z, PLANETS[k].r);
    }
  }

  /**
   * Per-frame: every visual from the fields the engine set. `pxScale` turns a CSS pixel size into world units at p;
   * `vmin` is the viewport's shorter side (CSS px), so sprites keep their proportion on a phone.
   */
  frame(T: number, time: number, pxScale: (p: Vector3) => number, vmin: number) {
    this.occluder.visible = this.occluderOn;
    const wv = this.planetV[WORLD];
    this.occluder.position.set(wv.x, wv.y, wv.z);
    // the sun
    const sunOn = this.sunVis > 0.002 && this.sunScale > 0.001;
    this.sun.visible = sunOn;
    if (sunOn) {
      this.sun.scale.setScalar(SUN_R * this.sunScale * (1 + 0.07 * this.sunBoost));
      this.sunM.uniforms.uTime.value = time;
      // (the core about 1.8 before the tone map, so its gold survives it; the bloom and the corona make it blaze)
      this.sunM.uniforms.uI.value =
        (2.2 + 1.6 * this.hot) * this.sunVis * (1 + 0.32 * this.sunBoost) * this.sunExposure;
      this.sunM.uniforms.uHot.value = this.hot;
      this.sunM.uniforms.uSpin.value = time * 0.02;
    }
    const cor = this.corona;
    cor.mesh.visible = this.coronaI > 0.002;
    if (cor.mesh.visible) {
      const R = SUN_R * Math.max(this.sunScale, 0.05) * 4.6 * (1 + 0.12 * this.sunBoost);
      cor.m.uniforms.uSize.value[0] = R;
      cor.m.uniforms.uSize.value[1] = R;
      cor.m.uniforms.uR0.value = 1 / 4.6;
      cor.m.uniforms.uTime.value = time;
      // (the corona keeps its full light up close: the star blazes, only its disc stops down)
      cor.m.uniforms.uI.value = this.coronaI * (1 + 0.55 * this.sunBoost);
    }
    // the shock of first light, in the disk plane: a hairline (about 0.2 world units, a pixel or two from fig. 3's
    // camera), the dust it lights carries most of it
    this.shock.visible = this.shockI > 0.002;
    if (this.shock.visible) {
      const S = 90;
      this.shock.scale.setScalar(S);
      this.shockM.uniforms.uR.value = Math.min(0.98, this.shockR / S);
      this.shockM.uniforms.uW.value = 0.0022;
      this.shockM.uniforms.uI.value = this.shockI;
    }

    // planets
    for (let k = 0; k < PLANETS.length; k++) {
      const pv = this.planetV[k];
      const mesh = this.planets[k];
      // they materialise grain by grain out of the dust; they leave (and the world hands over) by a plain cross-fade
      const alpha = k === WORLD ? this.worldFade : this.othersFade;
      mesh.visible = this.planetFade > 0.002 && alpha > 0.002;
      if (mesh.visible) {
        mesh.position.set(pv.x, pv.y, pv.z);
        const m = this.planetM[k];
        const u = m.uniforms;
        u.uFade.value = this.planetFade;
        u.uAlpha.value = alpha;
        const blend = alpha < 0.999;
        if (m.transparent !== blend) m.transparent = blend;
        u.uTime.value = time;
        const o = u.uOrient.value as Matrix3;
        if (k === WORLD) {
          // Earth turns about its own axis with the story, east, coming to rest in the world module's frame just before
          // the hand-off (its surface is the world module's: shared.earth)
          axisTurn(o, -earthSpin(T));
          const e = shared.earth;
          u.uSurf.value = e.surf;
          u.uSurfK.value =
            e.surf && e.at >= 0 ? clamp01((performance.now() - e.at) / SURF_FADE) : 0;
          u.uCloud.value = e.cloud;
        } else {
          // (the others spin about y with show time, as they always have)
          const a = time * (0.05 + 0.02 * k) + k * 1.7;
          const c = Math.cos(a);
          const sn = Math.sin(a);
          o.set(c, 0, sn, 0, 1, 0, -sn, 0, c);
        }
        u.uSunI.value = 0.25 + 0.75 * this.ignite;
      }
      const line = this.orbits[k];
      const src = this.orbitSrc;
      line.visible = this.orbitsI > 0.002 && src !== null && alpha > 0.002;
      if (line.visible && src) {
        const om = this.orbitM[k].uniforms;
        om.uPA.value = src.nu[k];
        om.uA.value = src.el[k * 5];
        om.uE.value = src.el[k * 5 + 1];
        (om.uP.value as Vector3).copy(src.P[k]);
        (om.uQ.value as Vector3).copy(src.Q[k]);
        om.uI.value = this.orbitsI * (k === WORLD ? 1.25 : 1) * alpha;
      }
    }
    const gp = this.planetV[3];
    this.ring.visible = this.ringFade > 0.002;
    if (this.ring.visible) {
      this.ring.position.set(gp.x, gp.y, gp.z);
      this.ringM.uniforms.uPlanetP.value.set(gp.x, gp.y, gp.z);
      this.ringM.uniforms.uFade.value = this.ringFade;
      this.ringM.uniforms.uSunI.value = 0.25 + 0.75 * this.ignite;
    }

    // young stars: a fixed size on screen (their light, not their body)
    for (let i = 0; i < this.young.length; i++) {
      const s = this.young[i];
      s.mesh.visible = this.youngI > 0.002;
      if (!s.mesh.visible) continue;
      const vf = Math.min(1.2, Math.max(0.42, vmin / 900));
      const size = pxScale(s.m.uniforms.uCenter.value as Vector3) * (50 + 70 * YOUNG[i][3]) * vf;
      s.m.uniforms.uSize.value[0] = size;
      s.m.uniforms.uSize.value[1] = size;
    }
  }

  dispose() {
    this.sphere.dispose();
    this.sunM.dispose();
    this.corona.mesh.geometry.dispose();
    this.corona.m.dispose();
    this.shock.geometry.dispose();
    this.shockM.dispose();
    for (const m of this.planetM) m.dispose();
    for (const l of this.orbits) l.geometry.dispose();
    for (const m of this.orbitM) m.dispose();
    this.ring.geometry.dispose();
    this.ringM.dispose();
    for (const s of this.young) {
      s.mesh.geometry.dispose();
      s.m.dispose();
    }
    (this.occluder.material as MeshBasicMaterial).dispose();
  }
}
