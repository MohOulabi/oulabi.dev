/**
 * The few sprites around the motes: the night backdrop (ink, a warm light dome on the horizon; a plain void in
 * space), the core glow of the singularity (one sprite, so the crushed sky never overdraws; later the heart of the
 * collapsing disk), the capped flash of the bang and of the sun's first light (WCAG 2.3.1: single flashes seconds
 * apart, low peak, never saturated red), the ember shock ring, fig. 3's three knots, and the thread: the visitor's
 * point, one sharp light the engine draws wherever a figure marks anchor `yours` (src/lib/anchors.ts,
 * figures/thread.ts).
 */
import {
  AdditiveBlending,
  BackSide,
  Color,
  CustomBlending,
  Mesh,
  OneFactor,
  OneMinusSrcAlphaFactor,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
} from "three";
import { LAND } from "./glsl/finale";

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

function sprite(frag: string, uniforms: Record<string, { value: unknown }>) {
  const m = new ShaderMaterial({
    uniforms: { uCenter: { value: new Vector3() }, uSize: { value: [1, 1] }, ...uniforms },
    vertexShader: BILLBOARD,
    fragmentShader: frag,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  });
  const mesh = new Mesh(new PlaneGeometry(2, 2), m);
  mesh.frustumCulled = false;
  mesh.visible = false;
  return { mesh, m };
}

export class FX {
  readonly overlay = new Scene();
  readonly backdrop: Mesh;
  readonly backdropM: ShaderMaterial;
  readonly core = sprite(
    /* glsl */ `
uniform float uI;
uniform float uHot;
uniform float uStreak;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  float glow = exp(-r * 14.0) * 1.4 + exp(-r * 5.0) * 0.12 + exp(-r * r * 900.0) * 6.0 * (0.3 + uHot);
  // only the singularity of the hold and the bang has a glint, short and faint (uStreak; never the disk's heart)
  float streak = exp(-abs(vUv.y) * 260.0) * exp(-abs(vUv.x) * 14.0) * 0.15 * uStreak;
  float a = (glow + streak) * (1.0 - smoothstep(0.85, 1.0, r));
  vec3 c = mix(vec3(0.815, 0.479, 0.133) * 1.6, vec3(1.0, 0.96, 0.9) * 2.0, smoothstep(0.0, 0.35, uHot));
  gl_FragColor = vec4(c * a * uI, 1.0);
}`,
    { uI: { value: 0 }, uHot: { value: 0 }, uStreak: { value: 0 } },
  );
  readonly ring = sprite(
    /* glsl */ `
uniform float uI;
uniform float uW;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  float ang = atan(vUv.y, vUv.x);
  // a torn shock front: thickness and heat vary around the ring
  float w = uW * (0.7 + 0.6 * (0.5 + 0.5 * sin(ang * 7.0 + r * 9.0)) * (0.5 + 0.5 * sin(ang * 13.0 - 2.0)));
  float x = (r - 0.9) / w;
  float ring = exp(-x * x);
  float wake = exp(-max(0.0, 0.9 - r) / (uW * 9.0)) * step(r, 0.9) * 0.12;
  vec3 c = vec3(1.0, 0.145, 0.047) * 3.2 * ring + vec3(1.0, 0.55, 0.25) * ring * ring * 2.0 + vec3(0.815, 0.479, 0.133) * wake;
  gl_FragColor = vec4(c * uI * (1.0 - smoothstep(0.96, 1.0, r)), 1.0);
}`,
    { uI: { value: 0 }, uW: { value: 0.03 } },
  );
  /**
   * The thread: your point's light (the engine places and fades it from anchor `yours`; uPx is the quad's half-size
   * in CSS px). A tiny white-gold core (4 CSS px across, at every distance) with a soft gold halo, and a thin dark
   * lens round the core so it still reads over bright gas or the sun: premultiplied, so its alpha darkens what is
   * behind and its colour adds light. Its peak only whispers into the bloom.
   */
  readonly thread = sprite(
    /* glsl */ `
uniform float uI;
uniform float uPx;
uniform float uK;
varying vec2 vUv;
void main() {
  float r = length(vUv);
  float d = r * uPx;
  float core = (smoothstep(2.5, 1.3, d) * 1.5 + exp(-d * d * 0.7) * 1.1) * (1.0 + 0.45 * uK);
  float halo = exp(-d / 2.8) * 0.3 + exp(-d / 8.0) * 0.07;
  // the lens: a dark moat round the core; in the dense dust (uK) it widens and deepens, and a fine gold ring marks
  // the point like a star picked out on a plate
  float lens = smoothstep(1.8, 3.0, d) * smoothstep(mix(7.0, 11.5, uK), 3.8, d) * mix(0.8, 0.96, uK);
  float ring = exp(-pow((d - 12.5) / 0.75, 2.0)) * 0.42 * uK;
  float edge = 1.0 - smoothstep(0.75, 1.0, r);
  vec3 c = vec3(1.0, 0.95, 0.86) * core + vec3(1.0, 0.72, 0.36) * (halo * (1.0 - 0.6 * uK) + ring);
  gl_FragColor = vec4(c * uI * edge, min(1.0, lens * uI) * edge);
}`,
    { uI: { value: 0 }, uPx: { value: 22 }, uK: { value: 0 } },
  );
  /**
   * Fig. 3's knots (figures/genesis.ts center): a hot core, a soft glow of its own width, and on the loud one thin
   * spikes. uCore / uHalo are fractions of the quad; the colour whitens toward the core.
   */
  readonly knots = [0, 1, 2].map(() =>
    sprite(
      /* glsl */ `
uniform float uI;
uniform vec3 uCol;
uniform float uSpike;
uniform float uCore;
uniform float uHalo;
uniform float uWhite;
varying vec2 vUv;
void main() {
  vec2 a = abs(vUv);
  float r = length(vUv);
  float core = exp(-r * r / (uCore * uCore)) * 2.2 + exp(-r * r / (uCore * uCore * 0.12)) * 2.4 * uWhite;
  float glow = exp(-r / uHalo) * 0.5 + exp(-r * r * 7.0) * 0.12;
  float spikes = (exp(-a.y * 300.0) * exp(-a.x * 8.0) + exp(-a.x * 300.0) * exp(-a.y * 8.0)) * uSpike * 0.8;
  float v = (core + glow + spikes) * (1.0 - smoothstep(0.78, 1.0, r));
  vec3 c = mix(uCol, vec3(1.0, 0.98, 0.94), smoothstep(uCore * 1.4, 0.0, r) * uWhite);
  gl_FragColor = vec4(c * v * uI, 1.0);
}`,
      {
        uI: { value: 0 },
        uCol: { value: new Vector3(1, 1, 1) },
        uSpike: { value: 0 },
        uCore: { value: 0.1 },
        uHalo: { value: 0.2 },
        uWhite: { value: 0.8 },
      },
    ),
  );
  readonly flash: Mesh;
  readonly flashM: ShaderMaterial;

  constructor() {
    const tm = this.thread.m;
    tm.blending = CustomBlending;
    tm.blendSrc = OneFactor;
    tm.blendDst = OneMinusSrcAlphaFactor;
    this.backdropM = new ShaderMaterial({
      uniforms: {
        uGlow: { value: 0.2 },
        uGlowCol: { value: new Color(0.815, 0.479, 0.133) },
        uDim: { value: 1 },
        uSpace: { value: 0 },
      },
      vertexShader: /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 c = projectionMatrix * viewMatrix * vec4(cameraPosition + position, 1.0);
  gl_Position = c.xyww;
}`,
      fragmentShader: /* glsl */ `
${LAND}
uniform float uGlow;
uniform vec3 uGlowCol;
uniform float uDim;
uniform float uSpace;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 zen = vec3(0.0013, 0.0015, 0.0026);
  vec3 hor = vec3(0.0036, 0.004, 0.0062);
  vec3 c = mix(hor, zen, smoothstep(-0.02, 0.45, y));
  // the land's edge against the sky: low dunes and a far escarpment (glsl/finale.ts LAND), never a ruled line
  float yh = y - landEdge(d);
  // the warm light dome of the towns' lights over it, pooling where the towns are, soft at its foot
  float pool = townPools(d);
  float dome = (exp(-max(yh, 0.0) * 20.0) * 0.75 + exp(-max(yh, 0.0) * 5.5) * 0.2) * (0.38 + 0.5 * pool);
  dome *= smoothstep(-0.02, 0.004, yh);
  c += mix(uGlowCol, vec3(0.86, 0.89, 0.94), 0.3) * uGlow * 0.07 * dome;
  // the land: darker than the sky, a haze of the glow over its far reaches fading toward the eye
  float yg = min(yh, 0.0);
  vec3 g = vec3(0.0011, 0.001, 0.0009) + uGlowCol * uGlow * (0.009 * exp(yg * 50.0) + 0.006 * pool * exp(yg * 160.0));
  c = mix(c, g, smoothstep(0.0012, -0.0035, yh));
  // space (after the bang, until the sky returns): no horizon, no ground, the faintest blue-black
  c = mix(c, vec3(0.0011, 0.0012, 0.002), uSpace);
  gl_FragColor = vec4(c * uDim, 1.0);
}`,
      depthWrite: false,
      depthTest: false,
      side: BackSide,
    });
    this.backdrop = new Mesh(new SphereGeometry(10, 48, 24), this.backdropM);
    this.backdrop.frustumCulled = false;
    this.backdrop.renderOrder = -10;

    this.flashM = new ShaderMaterial({
      uniforms: { uI: { value: 0 }, uC: { value: [0, 0] }, uAspect: { value: 1.6 } },
      vertexShader: /* glsl */ `
varying vec2 vUv;
void main() { vUv = position.xy; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: /* glsl */ `
uniform float uI;
uniform vec2 uC;
uniform float uAspect;
varying vec2 vUv;
void main() {
  vec2 d = (vUv - uC) * vec2(uAspect, 1.0);
  float v = 0.07 + 1.8 * exp(-dot(d, d) * 3.2);
  gl_FragColor = vec4(vec3(1.0, 0.8, 0.55) * uI * v, 1.0);
}`,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: AdditiveBlending,
    });
    this.flash = new Mesh(new PlaneGeometry(2, 2), this.flashM);
    this.flash.frustumCulled = false;
    this.flash.visible = false;

    for (const k of this.knots) this.overlay.add(k.mesh);
    this.overlay.add(this.core.mesh, this.ring.mesh, this.thread.mesh, this.flash);
  }

  dispose() {
    for (const s of [this.core, this.ring, this.thread, ...this.knots]) {
      s.mesh.geometry.dispose();
      s.m.dispose();
    }
    this.flash.geometry.dispose();
    this.flashM.dispose();
    this.backdrop.geometry.dispose();
    this.backdropM.dispose();
  }
}
