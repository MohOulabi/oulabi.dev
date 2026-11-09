/**
 * The nebula's gas (docs/STORY.md figs 2-4): a volume of glowing gas and dark dust, raymarched at a fraction of the
 * screen into its own target and laid under the motes. Its density is one function (NEB_FIELD) of a baked, tiling
 * 3D noise (perlin-worley billows, perlin filaments, a domain warp), read in the nebula's rest space; the genesis
 * map (glsl/genesis.ts GENESIS) carries it from the cloud into the spinning disk, so the motes (which sample their homes
 * from the same density) ride the same gas. Lit from within by a few young stars, later by the sun; in fig. 3 its
 * three knots (GAS_KNOTS: dense cores drawn where their fall has taken them, each shining from its own heart, costing
 * only the rays that pass near one) carry the light while the cloud's own steps back. In fig. 2 the visitor's hand
 * stirs it, locally (glsl/genesis.ts STIR). Every input is story time, the pointer or a time-based clock.
 *
 * Its cost (docs/STORY.md: 12 ms a frame on the heaviest figure): the march runs few steps at a small buffer, its step
 * offsets jittered anew every frame, and a resolve pass accumulates the frames (TEMPORAL): last frame's result is
 * reprojected through the gas's own mean depth (the march writes it in alpha) and clamped to this frame's
 * neighbourhood, so the camera's moves and the gas's own changes never smear. The composite upsamples it with a
 * Catmull-Rom filter, so no pattern of the jitter or the buffer's pixels shows. The only state is that history.
 */
import {
  AdditiveBlending,
  type Camera,
  type Data3DTexture,
  HalfFloatType,
  LinearFilter,
  Matrix4,
  Mesh,
  NoBlending,
  OrthographicCamera,
  PlaneGeometry,
  RepeatWrapping,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  Vector3,
  Vector4,
  WebGL3DRenderTarget,
  type WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { story } from "@/lib/story";
import { NEB_R, PLANETS, SUN } from "./constants";
import { COMMON } from "./glsl/common";
import { GENESIS, KNOT_DEFS, STIR } from "./glsl/genesis";
import { ORBITS } from "./glsl/system";

/** Lights in the gas: the young stars (cosmos.ts YOUNG). Fig. 3's knots shine from their own gas (uKnotI). */
const GAS_LIGHTS = 4;

const N3 = 64;

/** Tileable perlin and worley noise, baked once into a 64³ texture on the GPU (one draw per slice). */
const BAKE = /* glsl */ `
${COMMON}
uniform float uLayer;
uniform float uN;
vec3 h3(vec3 c) {
  uint x = uint(c.x) * 73856093u ^ uint(c.y) * 19349663u ^ uint(c.z) * 83492791u;
  return vec3(float(pcgH(x)), float(pcgH(x + 1u)), float(pcgH(x + 2u))) * 2.3283064e-10;
}
float perlinT(vec3 x, float P) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  vec3 u = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float n[8];
  for (int k = 0; k < 8; k++) {
    vec3 o = vec3(float(k & 1), float((k >> 1) & 1), float((k >> 2) & 1));
    vec3 g = normalize(h3(mod(i + o, P)) * 2.0 - 1.0);
    n[k] = dot(g, f - o);
  }
  float x00 = mix(n[0], n[1], u.x);
  float x10 = mix(n[2], n[3], u.x);
  float x01 = mix(n[4], n[5], u.x);
  float x11 = mix(n[6], n[7], u.x);
  return mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z);
}
float worleyT(vec3 x, float P) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  float md = 9.0;
  for (int dz = -1; dz <= 1; dz++)
    for (int dy = -1; dy <= 1; dy++)
      for (int dx = -1; dx <= 1; dx++) {
        vec3 o = vec3(float(dx), float(dy), float(dz));
        vec3 fp = o + h3(mod(i + o + 1000.0, P) + 31.0) - f;
        md = min(md, dot(fp, fp));
      }
  return 1.0 - clamp(sqrt(md), 0.0, 1.0);
}
float fbmP(vec3 p, float P) {
  return perlinT(p * P, P) * 0.6 + perlinT(p * P * 2.0, P * 2.0) * 0.28 + perlinT(p * P * 4.0, P * 4.0) * 0.12;
}
float fbmW(vec3 p, float P) {
  return worleyT(p * P, P) * 0.62 + worleyT(p * P * 2.0, P * 2.0) * 0.26 + worleyT(p * P * 4.0, P * 4.0) * 0.12;
}
void main() {
  vec3 p = vec3(gl_FragCoord.xy, uLayer + 0.5) / uN;
  gl_FragColor = vec4(
    clamp(fbmP(p, 4.0) * 0.85 + 0.5, 0.0, 1.0),
    fbmW(p, 4.0),
    clamp(fbmP(p + 0.37, 8.0) * 0.85 + 0.5, 0.0, 1.0),
    fbmW(p + 0.19, 8.0)
  );
}
`;

export function bakeNoise(gl: WebGLRenderer): WebGL3DRenderTarget {
  const rt = new WebGL3DRenderTarget(N3, N3, N3, {
    type: UnsignedByteType,
    depthBuffer: false,
    generateMipmaps: false,
    minFilter: LinearFilter,
    magFilter: LinearFilter,
  });
  const t = rt.texture as Data3DTexture;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.wrapR = RepeatWrapping;
  const m = new ShaderMaterial({
    uniforms: { uLayer: { value: 0 }, uN: { value: N3 } },
    vertexShader: "void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: BAKE,
    depthTest: false,
    depthWrite: false,
    blending: NoBlending,
  });
  const scene = new Scene();
  const quad = new Mesh(new PlaneGeometry(2, 2), m);
  quad.frustumCulled = false;
  scene.add(quad);
  const cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const prev = gl.getRenderTarget();
  for (let z = 0; z < N3; z++) {
    m.uniforms.uLayer.value = z;
    gl.setRenderTarget(rt, z);
    gl.render(scene, cam);
  }
  gl.setRenderTarget(prev);
  quad.geometry.dispose();
  m.dispose();
  return rt;
}

/**
 * The density of the nebula at rest offset q (world units from the sun): the dust clouds, the glowing gas and a
 * slow "temperature" field (where the gas runs warm, where it turns to a cold blue).
 */
export const NEB_FIELD = /* glsl */ `
${KNOT_DEFS}
#ifdef GAS_KNOTS
uniform vec3 uKnotI;
/** Set by the march once per pixel: the knots its ray passes near. Written by nebField: the knots' own light here. */
bool gKnotRay[3];
vec3 gKnotEm;
#endif
// every channel of tNoise is about 0.5 +- 0.11 (perlin fbm in r and b, inverted worley fbm in g and a).
// Returns the dust clouds' density (opaque billows, lit only where light reaches them); glow is the ionised gas
// that fills the cloud and shines on its own; temp is a slow field for where it runs cold and blue.
float nebField(vec3 q, out float glow, out float temp) {
  vec3 u = q * (1.0 / 170.0);
  vec4 lo = texture(tNoise, u * 0.5 + vec3(0.17, 0.53, 0.29));
  // big slow swirls, then the billows inside them
  vec3 uw = u + (lo.rgb - 0.5) * 0.6;
  vec4 a = texture(tNoise, uw);
  vec4 b = texture(tNoise, uw * 2.6 + vec3(0.41, 0.07, 0.66));
  // the cloud's envelope: lobed and irregular, a little flattened; "heart" is how deep inside a point lies
  float rr = length(q * vec3(1.0, 1.35, 1.0)) / uNebR;
  float shape = 1.0 - rr + (lo.a - 0.5) * 1.1 + (lo.g - 0.5) * 0.7;
  float heart = smoothstep(0.0, 0.75, shape);
  // clouds: a z-score threshold, generous in the heart, sparse at the edges
  float f = a.r * 0.42 + a.g * 0.33 + b.r * 0.15 + b.g * 0.1;
  float z = (f - 0.49) / 0.065;
  float th = 0.7 - 1.7 * heart;
  float cloud = smoothstep(th, th + 1.5, z) * smoothstep(-0.04, 0.14, shape);
  // cauliflower edges: fine worley cells eat into the thin parts of the clouds
  float fine = texture(tNoise, uw * 6.7 + vec3(0.13, 0.77, 0.31)).g;
  float ero = (1.0 - b.a * 0.55 - fine * 0.45) * 0.66;
  cloud = clamp((cloud - ero * (1.0 - cloud * 0.6)) / (1.0 - ero * 0.4), 0.0, 1.0);
  // filaments: where two noise isosurfaces cross, thin glowing threads; veils where only one does
  float s1 = 1.0 - smoothstep(0.0, 0.034, abs(b.b - 0.5));
  float s2 = 1.0 - smoothstep(0.0, 0.05, abs(a.b - 0.5));
  float fil = s1 * s2 * smoothstep(-0.25, 0.25, shape);
  float veil = s1 * smoothstep(-0.1, 0.35, shape);
  // dark knots inside the clouds
  float knot = smoothstep(0.58, 0.72, a.a * 0.55 + b.a * 0.45) * smoothstep(0.0, 0.4, shape);
  float d = cloud * 1.35 + knot * 0.8 + fil * 0.3;
  // the glowing gas: brightest in the heart, patchy, threaded with the filaments and the veils
  float g = (0.25 + 0.75 * heart) * smoothstep(-0.12, 0.3, shape) * max(0.22 + 3.2 * (lo.b - 0.5) + 2.4 * (a.r - 0.5), 0.0);
  glow = g * (1.0 - 0.6 * cloud) + fil * 1.1 + veil * 0.1;
#ifdef GAS_KNOTS
  // fig. 3's knots (the gas only: the motes have their own share): dense cores where they are now (KNOT_P plus the
  // fall, uKnot), stretched back along their fall into a tail; the dust as heavy as the mass, lumpy where the noise
  // eats in; each shines from its core as far as its light reaches (the loud one far, the heaviest only its heart).
  // Only the knots this pixel's ray passes near (gKnotRay, set once per pixel by the march)
  gKnotEm = vec3(0.0);
  for (int i = 0; i < 3; i++) {
    if (!gKnotRay[i]) continue;
    vec3 A = KNOT_P[i] + uKnot[i].xyz;
    vec3 ab = uKnot[3 + i].xyz - uKnot[i].xyz;
    vec3 dk = q - A;
    float L2 = dot(ab, ab);
    if (L2 > 1e-4) dk -= ab * clamp(dot(dk, ab) / L2, 0.0, 1.0);
    float r2 = dot(dk, dk) / (KNOT_E[i] * KNOT_E[i]);
    if (r2 < (uKnotI[i] > 0.0 ? KNOT_CUT[i] : 4.4)) {
      float lump = clamp(0.62 + 2.4 * (a.g - 0.5) + 1.6 * (b.r - 0.5) + 1.2 * (fine - 0.5), 0.12, 1.5);
      float thin = 1.0 / (1.0 + 0.04 * L2 / (KNOT_E[i] * KNOT_E[i]));
      d += KNOT_M[i] * exp(-r2 * 1.15) * lump * thin;
      glow += KNOT_G[i] * exp(-r2 * 1.8) * (0.6 + 0.4 * lump) * thin;
      gKnotEm += KNOT_C[i] * (uKnotI[i] * exp(-r2 * KNOT_EW[i]) * (0.75 + 0.25 * lump));
    }
  }
#endif
  temp = lo.r;
  return d;
}
float nebDensity(vec3 q) {
  float g;
  float te;
  float d = nebField(q, g, te);
  return d + g * 0.35;
}
`;

const VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const P = PLANETS;

const MARCH = /* glsl */ `
${COMMON}
uniform highp sampler3D tNoise;
uniform float uNebR;
uniform mat4 uInvProj;
uniform mat4 uCamM;
uniform vec3 uCamPos;
uniform float uSteps;
uniform float uGas;
uniform float uHeatG;
uniform float uTime;
uniform float uShadow;
uniform float uFrame;
uniform vec2 uJitter;
uniform vec4 uLight[${GAS_LIGHTS}];
uniform vec4 uPlanet[5];
${GENESIS}
${STIR}
${ORBITS}
#define GAS_KNOTS
${NEB_FIELD}
varying vec2 vUv;

/** Dust lit by starlight: dark rust in the dim, gold on the faces, cream only where the light is strongest. */
vec3 dustColour(float il) {
  vec3 c = mix(vec3(0.36, 0.07, 0.03), vec3(1.0, 0.38, 0.1), smoothstep(0.08, 0.45, il));
  c = mix(c, vec3(1.0, 0.64, 0.26), smoothstep(0.45, 1.2, il));
  return mix(c, vec3(1.0, 0.88, 0.7), smoothstep(1.6, 3.4, il));
}
/** The glowing gas: ember red, gold-white toward the heart, a cold blue where it runs thin and far. */
vec3 glowColour(float temp, float hq, float il) {
  vec3 c = mix(vec3(0.82, 0.12, 0.035), vec3(1.0, 0.4, 0.1), smoothstep(0.25, 0.7, hq));
  c = mix(c, vec3(1.0, 0.64, 0.28), smoothstep(0.7, 0.97, hq) * 0.75);
  float cold = smoothstep(0.56, 0.72, temp) * (1.0 - smoothstep(0.55, 0.9, hq));
  return mix(c, vec3(0.18, 0.46, 1.0) * (0.8 + 0.5 * il), cold * 0.85);
}

float ign(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }

void main() {
  // (the ray moves inside its pixel from frame to frame: the resolve averages them, so the small buffer's edges are
  // smooth, never stair-stepped)
  vec2 ndc = vUv * 2.0 - 1.0 + uJitter;
  vec4 v = uInvProj * vec4(ndc, 1.0, 1.0);
  vec3 rd = normalize((uCamM * vec4(v.xyz / v.w, 0.0)).xyz);
  vec3 ro = uCamPos;
  float c = uCollapse;
  float e = max(uExpand, 0.04);
  // bounds: a sphere around the cloud (it grows from the bang point), cut to the slab the disk flattens into
  // (fig. 3: the field slides by uFallOff as the chosen knot comes to the sun; the collapse winds the slide in)
  vec3 cen = uSun + uBangOff * (1.0 - e) - uFallOff * (1.0 - c);
  float R = uNebR * 1.05 * e + 6.0 + length(uFallOff) * c;
  vec3 oc = ro - cen;
  float bq = dot(oc, rd);
  float cq = dot(oc, oc) - R * R;
  float disc = bq * bq - cq;
  if (disc <= 0.0) { gl_FragColor = vec4(0.0); return; }
  float sq = sqrt(disc);
  float t0 = max(-bq - sq, 0.0);
  float t1 = -bq + sq;
  float H = (uNebR * 0.82 * e) * mix(1.0, 0.085, c) + 2.0 + abs(uFallOff.y) * c;
  float yo = ro.y - cen.y;
  if (abs(rd.y) > 1e-4) {
    float ta = (-H - yo) / rd.y;
    float tb = (H - yo) / rd.y;
    t0 = max(t0, min(ta, tb));
    t1 = min(t1, max(ta, tb));
  } else if (abs(yo) > H) { gl_FragColor = vec4(0.0); return; }
  if (t1 <= t0) { gl_FragColor = vec4(0.0); return; }
  float dt = (t1 - t0) / uSteps;
  // the step offset, new every frame (the resolve pass averages the frames, so no fixed pattern is left)
  float jit = fract(ign(gl_FragCoord.xy) + 0.61803399 * mod(uFrame, 64.0));
  // fig. 3's knots: only those this ray passes near cost anything (uKnot[6 + i]: where each is in the world now; once
  // the disk winds them in, every ray may)
  for (int i = 0; i < 3; i++) {
    vec3 ko = uKnot[6 + i].xyz - ro;
    float kt = dot(ko, rd);
    float kr = KNOT_E[i] * sqrt(uKnotI[i] > 0.0 ? KNOT_CUT[i] : 4.4) + length(uKnot[3 + i].xyz - uKnot[i].xyz) + 2.0 + 40.0 * c;
    gKnotRay[i] = c > 0.3 || dot(ko, ko) - kt * kt < kr * kr;
  }
  vec3 acc = vec3(0.0);
  float tr = 1.0;
  float sunI = uIgnite;
  // the mean depth of the light gathered (for the resolve's reprojection)
  float wl = 0.0;
  float wt = 0.0;
  for (int i = 0; i < 72; i++) {
    if (float(i) >= uSteps) break;
    float t = t0 + (float(i) + jit) * dt;
    vec3 p = stirBack(ro + rd * t);
    vec3 w = p - uSun;
    float r = length(w.xz);
    vec3 q = unexpandRest(unfallMap(restOf(w, c)));
    float glow;
    float temp;
    float d = nebField(q, glow, temp);
    vec3 kem = gKnotEm;
    if (d <= 0.001 && glow <= 0.001) continue;
    // the disk: compressed by the collapse (column density is kept), cleared by the sun, carved into rings
    float J = 1.0 / (mix(1.0, diskH(r), c) * (1.0 - 0.2 * c) * (1.0 - 0.2 * c));
    J = mix(1.0, J, 0.85) / (e * e);
    float shape = 1.0;
    if (uCavity > 0.0) {
      shape *= smoothstep(uCavity * 0.82, uCavity * 1.06, r);
      shape *= 1.0 + 2.6 * exp(-pow((r - uCavity * 1.1) / (0.16 * uCavity), 2.0)) * uIgnite;
    }
    if (uGap > 0.0) {
      for (int k = 0; k < 5; k++) {
        float R0 = uPlanet[k].w > 0.0 ? gapR(k, w) : 0.0;
        float wk = 2.0 + 0.075 * R0;
        float x = (r - R0) / wk;
        // a clear gap where the planet sweeps, the dust piled into bright rings at its edges
        float y = abs(x) - 1.25;
        shape *= (1.0 - 0.95 * uGap * exp(-x * x * 1.6)) * (1.0 + 0.8 * uGap * exp(-y * y * 6.0));
      }
    }
    d *= shape * J;
    glow *= shape * J;
    // light: a cluster at the heart lights the cloud from inside, the young stars their own pockets, later the
    // new sun (world space), and the heat of the bang
    float hq = 1.0 / (1.0 + dot(q, q) / 950.0);
    // (uKnot[0].w: the cloud's own light, lowered while fig. 3's knots shine)
    float il = 0.03 + 0.95 * hq * uKnot[0].w;
    vec3 toL = -q * (il / max(length(q), 1.0));
    for (int k = 0; k < ${GAS_LIGHTS}; k++) {
      if (uLight[k].w <= 0.0) continue;
      vec3 dl = uLight[k].xyz - q;
      float f = uLight[k].w / (1.0 + dot(dl, dl) / 500.0);
      il += f;
      toL += normalize(dl) * f;
    }
    il *= (1.0 - 0.75 * sunI);
    float sd = length(w);
    il += sunI * (2.6 / (1.0 + sd * sd / 420.0) + 0.1);
    il += uHeatG * 2.5;
    // light reaches the faces of the clouds that look toward it: one step toward the light
    float lit = il;
    if (uShadow > 0.0 && il > 0.12 && d > 0.02) {
      vec3 ld = normalize(mix(toL, -w, sunI) + vec3(1e-4));
      float g2;
      float t2;
      float d2 = nebField(q + ld * 5.0, g2, t2) * J * shape;
      lit *= mix(1.0, exp(-d2 * 1.1), uShadow);
    }
    // the dust shines only where it is lit (gold rims, dark bodies); the gas glows on its own
    // the glowing gas thins as the disk forms: the disk is dust, lit by its sun
    vec3 em = dustColour(lit) * (lit * 0.12 + lit * lit * 0.55) * d
      + glowColour(temp, hq, il) * glow * (0.08 + 0.45 * il) * (1.0 - 0.7 * c)
      + kem * (0.6 * d + 0.35) * shape * J;
    // integrate the step exactly (a thick step does not over-count its light, whatever the step count). The
    // collapse packs the dust (its light), but the disk stays translucent so its arms and rings still show
    float sig = (d * 0.085 + glow * 0.004) * pow(J, -0.35);
    em *= 1.0 - 0.5 * c;
    float ext = exp(-sig * dt);
    vec3 add = tr * em * (sig > 1e-4 ? (1.0 - ext) / sig : dt);
    acc += add;
    float l = dot(add, vec3(0.3, 0.5, 0.2));
    wl += l;
    wt += l * t;
    tr *= ext;
    if (tr < 0.02) break;
  }
  gl_FragColor = vec4(acc * uGas, wl > 1e-6 ? wt / wl : 0.0);
}
`;

/**
 * The resolve: this frame's march blended into the history. The history is fetched where this pixel's gas was last
 * frame (its mean depth, reprojected; an empty pixel stands at the cloud's distance), clamped to the range of this
 * frame's 3×3 neighbourhood (so what changed, or was uncovered, never ghosts), then blended at uAlpha.
 */
const RESOLVE = /* glsl */ `
uniform sampler2D tCur;
uniform sampler2D tHist;
uniform mat4 uPrevVP;
uniform mat4 uInvProj;
uniform mat4 uCamM;
uniform vec3 uCamPos;
uniform vec2 uTexel;
uniform float uAlpha;
uniform float uReset;
varying vec2 vUv;
void main() {
  vec4 cc = texture2D(tCur, vUv);
  if (uReset > 0.5) {
    gl_FragColor = cc;
    return;
  }
  vec3 mn = cc.rgb;
  vec3 mx = cc.rgb;
  for (int j = -1; j <= 1; j++) {
    for (int i = -1; i <= 1; i++) {
      if (i == 0 && j == 0) continue;
      vec3 s = texture2D(tCur, vUv + vec2(float(i), float(j)) * uTexel).rgb;
      mn = min(mn, s);
      mx = max(mx, s);
    }
  }
  vec4 v = uInvProj * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
  vec3 rd = normalize((uCamM * vec4(v.xyz / v.w, 0.0)).xyz);
  vec3 P = uCamPos + rd * (cc.a > 0.0 ? cc.a : 160.0);
  vec4 pc = uPrevVP * vec4(P, 1.0);
  vec2 puv = pc.xy / pc.w * 0.5 + 0.5;
  if (pc.w <= 0.0 || puv.x < 0.0 || puv.y < 0.0 || puv.x > 1.0 || puv.y > 1.0) {
    gl_FragColor = cc;
    return;
  }
  vec3 h = clamp(texture2D(tHist, puv).rgb, mn, mx);
  gl_FragColor = vec4(mix(h, cc.rgb, uAlpha), cc.a);
}
`;

/**
 * Lays the gas under the motes (full screen, hidden behind anything solid: the sun, the planets), upsampled with a
 * Catmull-Rom filter in five bilinear taps (sharp, and no blocky diamonds of the small buffer).
 */
const COMPOSITE = /* glsl */ `
uniform sampler2D tGas;
uniform vec2 uSize;
varying vec2 vUv;
vec3 catmullRom(vec2 uv) {
  vec2 sp = uv * uSize;
  vec2 t1 = floor(sp - 0.5) + 0.5;
  vec2 f = sp - t1;
  vec2 w0 = f * (-0.5 + f * (1.0 - 0.5 * f));
  vec2 w1 = 1.0 + f * f * (-2.5 + 1.5 * f);
  vec2 w2 = f * (0.5 + f * (2.0 - 1.5 * f));
  vec2 w3 = f * f * (-0.5 + 0.5 * f);
  vec2 w12 = w1 + w2;
  vec2 p0 = (t1 - 1.0) / uSize;
  vec2 p3 = (t1 + 2.0) / uSize;
  vec2 p12 = (t1 + w2 / w12) / uSize;
  float a = w12.x * w0.y;
  float b = w0.x * w12.y;
  float c = w12.x * w12.y;
  float d = w3.x * w12.y;
  float e = w12.x * w3.y;
  vec3 r = texture2D(tGas, vec2(p12.x, p0.y)).rgb * a + texture2D(tGas, vec2(p0.x, p12.y)).rgb * b
    + texture2D(tGas, p12).rgb * c + texture2D(tGas, vec2(p3.x, p12.y)).rgb * d + texture2D(tGas, vec2(p12.x, p3.y)).rgb * e;
  return max(r / (a + b + c + d + e), 0.0);
}
void main() {
  vec3 g = catmullRom(vUv);
  // a toe: the faint haze sinks toward black, the lit clouds keep their light (contrast, like a long exposure)
  g = g * g / (g + 0.035) * 1.12;
  gl_FragColor = vec4(g, 1.0);
}
`;

/** Steps per ray this frame (the resolve gathers about five frames' worth). */
const STEPS = { high: 36, medium: 26, low: 18 } as const;
/** The gas buffer: a pixel budget per tier (so a phone is not a mosaic), capped at a fraction of the CSS size. */
const PIXELS = { high: 300_000, medium: 170_000, low: 90_000 } as const;
const SCALE_MAX = { high: 0.58, medium: 0.5, low: 0.5 } as const;
/** How much of each new frame the resolve takes (the rest is the reprojected history). */
const TEMPORAL = 0.2;
/** The ray's offsets inside its pixel, frame by frame (Halton 2, 3). */
const halton = (i: number, b: number) => {
  let f = 1;
  let r = 0;
  for (let n = i; n > 0; n = Math.floor(n / b)) {
    f /= b;
    r += f * (n % b);
  }
  return r;
};
const HALTON = Array.from({ length: 16 }, (_, i) => [halton(i + 1, 2), halton(i + 1, 3)] as const);

export class Gas {
  /** This frame's march (rgb: light; a: its mean depth), and the accumulated result (ping-pong; the composite reads it). */
  readonly rt: WebGLRenderTarget;
  private hist: WebGLRenderTarget[];
  private hi = 0;
  readonly mat: ShaderMaterial;
  private resolveM: ShaderMaterial;
  readonly composite: Mesh;
  private scene = new Scene();
  private resolveScene = new Scene();
  private cam = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private quad: Mesh;
  private resolveQuad: Mesh;
  private tier: "high" | "medium" | "low";
  /** 1 = full scale for the tier; the watchdog lowers it. */
  quality = 1;
  on = false;
  // the history: last frame's view-projection, whether it holds anything, the frame count (the jitter's sequence)
  private prevVP = new Matrix4();
  private hasHist = false;
  private frame = 0;
  private lastTs = 0;

  constructor(noise: Data3DTexture, tier: "high" | "medium" | "low") {
    this.tier = tier;
    const target = () =>
      new WebGLRenderTarget(4, 4, {
        type: HalfFloatType,
        minFilter: LinearFilter,
        magFilter: LinearFilter,
        depthBuffer: false,
        generateMipmaps: false,
      });
    this.rt = target();
    this.hist = [target(), target()];
    const lights: Vector4[] = [];
    for (let i = 0; i < GAS_LIGHTS; i++) lights.push(new Vector4());
    const planets: Vector4[] = [];
    for (let i = 0; i < P.length; i++) planets.push(new Vector4());
    this.mat = new ShaderMaterial({
      uniforms: {
        tNoise: { value: noise },
        uNebR: { value: NEB_R },
        uInvProj: { value: new Matrix4() },
        uCamM: { value: new Matrix4() },
        uCamPos: { value: new Vector3() },
        uSteps: { value: STEPS[tier] },
        uGas: { value: 0 },
        uHeatG: { value: 0 },
        uTime: { value: 0 },
        uGap: { value: 0 },
        uShadow: { value: tier === "low" ? 0 : 1 },
        uFrame: { value: 0 },
        uJitter: { value: new Vector2() },
        uLight: { value: lights },
        uPlanet: { value: planets },
        uOrb: { value: P.map(() => new Vector4()) },
        // fig. 2's stir (glsl/genesis.ts STIR; figures/genesis.ts writes it into the sim's uniforms and these)
        uStirP: { value: new Vector4() },
        uStirA: { value: new Vector4(0, 0, -1, 1) },
        uStirD: { value: new Vector4() },
        uVortA: { value: Array.from({ length: 6 }, () => new Vector4()) },
        uVortB: { value: Array.from({ length: 6 }, () => new Vector4()) },
        uSun: { value: new Vector3(...SUN) },
        uCollapse: { value: 0 },
        uSpinC: { value: 0 },
        uCavity: { value: 0 },
        uIgnite: { value: 0 },
        uExpand: { value: 1 },
        uBangOff: { value: new Vector3() },
        uWindK: { value: 0 },
        uFallOff: { value: new Vector3() },
        uKnot: { value: Array.from({ length: 9 }, () => new Vector4()) },
        uKnotI: { value: new Vector3() },
      },
      vertexShader: VERT,
      fragmentShader: MARCH,
      depthTest: false,
      depthWrite: false,
      blending: NoBlending,
    });
    this.quad = new Mesh(new PlaneGeometry(2, 2), this.mat);
    this.quad.frustumCulled = false;
    this.scene.add(this.quad);

    this.resolveM = new ShaderMaterial({
      uniforms: {
        tCur: { value: this.rt.texture },
        tHist: { value: null },
        uPrevVP: { value: this.prevVP },
        uInvProj: { value: this.mat.uniforms.uInvProj.value },
        uCamM: { value: this.mat.uniforms.uCamM.value },
        uCamPos: { value: this.mat.uniforms.uCamPos.value },
        uTexel: { value: new Vector2(1, 1) },
        uAlpha: { value: TEMPORAL },
        uReset: { value: 1 },
      },
      vertexShader: VERT,
      fragmentShader: RESOLVE,
      depthTest: false,
      depthWrite: false,
      blending: NoBlending,
    });
    this.resolveQuad = new Mesh(new PlaneGeometry(2, 2), this.resolveM);
    this.resolveQuad.frustumCulled = false;
    this.resolveScene.add(this.resolveQuad);

    const cm = new ShaderMaterial({
      uniforms: { tGas: { value: this.hist[0].texture }, uSize: { value: new Vector2(4, 4) } },
      vertexShader: /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.999999, 1.0);
}`,
      fragmentShader: COMPOSITE,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.composite = new Mesh(new PlaneGeometry(2, 2), cm);
    this.composite.frustumCulled = false;
    this.composite.renderOrder = -5;
    this.composite.visible = false;
  }

  get uniforms() {
    return this.mat.uniforms;
  }

  /**
   * Compile the raymarch and the resolve before the reveal, so the bang never hitches on them, as the variants they
   * really render with (into a half-float target: linear output, no tone map).
   */
  compile(gl: WebGLRenderer) {
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(this.rt);
    const a = gl.compileAsync(this.scene, this.cam);
    const b = gl.compileAsync(this.resolveScene, this.cam);
    gl.setRenderTarget(prev);
    return Promise.all([a, b]);
  }

  /** Raymarch the gas for this frame and fold it into the history (call before the scene renders). */
  render(gl: WebGLRenderer, cam: Camera, widthCss: number, heightCss: number) {
    const u = this.mat.uniforms;
    this.composite.visible = this.on;
    if (!this.on) {
      this.hasHist = false;
      return;
    }
    const s =
      Math.min(
        SCALE_MAX[this.tier],
        Math.sqrt(PIXELS[this.tier] / Math.max(1, widthCss * heightCss)),
      ) * this.quality;
    const w = Math.max(16, Math.round(widthCss * s));
    const h = Math.max(16, Math.round(heightCss * s));
    if (this.rt.width !== w || this.rt.height !== h) {
      this.rt.setSize(w, h);
      for (const t of this.hist) t.setSize(w, h);
      this.hasHist = false;
    }
    (u.uInvProj.value as Matrix4).copy(cam.projectionMatrixInverse);
    (u.uCamM.value as Matrix4).copy(cam.matrixWorld);
    (u.uCamPos.value as Vector3).setFromMatrixPosition(cam.matrixWorld);
    // the flattened disk is a short march through a thin slab: fewer steps, and no self-shadow toward its sun
    const c = u.uCollapse.value as number;
    u.uSteps.value = Math.max(
      12,
      Math.round(STEPS[this.tier] * (0.6 + 0.4 * this.quality) * (1 - 0.35 * c)),
    );
    u.uShadow.value = this.tier === "low" ? 0 : 1 - Math.min(1, Math.max(0, (c - 0.8) / 0.2));
    const j = this.frame % HALTON.length;
    (u.uJitter.value as Vector2).set(
      (HALTON[j][0] - 0.5) * (2 / w),
      (HALTON[j][1] - 0.5) * (2 / h),
    );
    u.uFrame.value = this.frame++;
    const prev = gl.getRenderTarget();
    gl.setRenderTarget(this.rt);
    gl.render(this.scene, this.cam);

    // the resolve: a jump in story time (a nav cut, a deep link) starts the history afresh
    const ru = this.resolveM.uniforms;
    if (Math.abs(story.Ts - this.lastTs) > 0.4) this.hasHist = false;
    this.lastTs = story.Ts;
    const next = 1 - this.hi;
    ru.tHist.value = this.hist[this.hi].texture;
    ru.uReset.value = this.hasHist ? 0 : 1;
    (ru.uTexel.value as Vector2).set(1 / w, 1 / h);
    gl.setRenderTarget(this.hist[next]);
    gl.render(this.resolveScene, this.cam);
    gl.setRenderTarget(prev);
    this.hi = next;
    this.hasHist = true;
    this.prevVP.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    const cu = (this.composite.material as ShaderMaterial).uniforms;
    cu.tGas.value = this.hist[next].texture;
    (cu.uSize.value as Vector2).set(w, h);
  }

  dispose() {
    this.rt.dispose();
    for (const t of this.hist) t.dispose();
    this.mat.dispose();
    this.resolveM.dispose();
    this.quad.geometry.dispose();
    this.resolveQuad.geometry.dispose();
    this.composite.geometry.dispose();
    (this.composite.material as ShaderMaterial).dispose();
  }
}
