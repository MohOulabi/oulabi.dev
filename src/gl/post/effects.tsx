"use client";

import { useFrame, useThree } from "@react-three/fiber";
import {
  BlendFunction,
  BloomEffect,
  Effect,
  EffectComposer,
  EffectPass,
  Pass,
  RenderPass,
  ToneMappingEffect,
  ToneMappingMode,
} from "postprocessing";
import { useEffect, useMemo } from "react";
import {
  type Camera,
  HalfFloatType,
  LinearFilter,
  NoToneMapping,
  type Scene,
  ShaderMaterial,
  Scene as ThreeScene,
  Uniform,
  Vector2,
  type WebGLRenderer,
  WebGLRenderTarget,
} from "three";
import { precompile } from "@/gl/precompile";
import { fx } from "@/gl/show/state";
import type { GLTier } from "@/lib/tier";

/**
 * The finish, after tone mapping: a whisper of vignette, then a dither in display space (±1 code value,
 * triangular, static) so the dark gradients of the night never band. Not grain.
 */
const FINISH = /* glsl */ `
uniform float uVignette;

float hash(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec2 q = (uv - 0.5) * vec2(aspect, 1.0);
  float v = 1.0 - uVignette * smoothstep(0.4, 1.2, length(q));
  vec3 c = max(inputColor.rgb * v, 0.0);
  vec2 f = gl_FragCoord.xy;
  float n = hash(f) + hash(f + 19.19) - 1.0;
  vec3 s = pow(c, vec3(1.0 / 2.2)) + n / 255.0;
  outputColor = vec4(pow(max(s, 0.0), vec3(2.2)), inputColor.a);
}
`;

class FinishEffect extends Effect {
  constructor(vignette: number) {
    super("FinishEffect", FINISH, {
      blendFunction: BlendFunction.SET,
      uniforms: new Map([["uVignette", new Uniform(vignette)]]),
    });
  }
}

const FS_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 1.0, 1.0);
}
`;

/**
 * Clamps the light going into the bloom (a crushed sky must not bloom to infinity) and, in the sky (fig. 12), keeps
 * a long exposure: acc = max(acc * decay, frame), a decaying ping-pong buffer (lighten stacking, like star-trail
 * photography). The decay comes from the drag speed (src/gl/show/figures/sky.ts).
 */
class TrailPass extends Pass {
  private acc: WebGLRenderTarget[];
  private i = 0;
  private accMat: ShaderMaterial;
  private outMat: ShaderMaterial;

  constructor() {
    super("TrailPass");
    this.needsSwap = true;
    const rt = () =>
      new WebGLRenderTarget(1, 1, {
        type: HalfFloatType,
        minFilter: LinearFilter,
        magFilter: LinearFilter,
        depthBuffer: false,
      });
    this.acc = [rt(), rt()];
    this.accMat = new ShaderMaterial({
      uniforms: {
        tIn: { value: null },
        tPrev: { value: null },
        uDecay: { value: 0 },
        uMax: { value: 14 },
        uPole: { value: new Vector2(0.5, 0.8) },
        uTurn: { value: 0 },
        uHor: { value: 0 },
        uAspect: { value: 1.6 },
      },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
uniform sampler2D tIn;
uniform sampler2D tPrev;
uniform float uDecay;
uniform float uMax;
uniform vec2 uPole;
uniform float uTurn;
uniform float uHor;
uniform float uAspect;
varying vec2 vUv;
void main() {
  vec3 c = min(texture2D(tIn, vUv).rgb, vec3(uMax));
  // the sky turned uTurn since the last frame: fill the arc in between, so a fast drag draws a line, not dots
  if (abs(uTurn) > 1e-5 && vUv.y > uHor) {
    vec2 q = (vUv - uPole) * vec2(uAspect, 1.0);
    for (int k = 1; k < 6; k++) {
      float a = uTurn * float(k) / 6.0;
      vec2 r = vec2(cos(a) * q.x - sin(a) * q.y, sin(a) * q.x + cos(a) * q.y);
      vec2 uv = uPole + r / vec2(uAspect, 1.0);
      if (uv.y > uHor) c = max(c, min(texture2D(tIn, uv).rgb, vec3(uMax)));
    }
  }
  vec3 p = texture2D(tPrev, vUv).rgb * uDecay;
  gl_FragColor = vec4(max(c, p), 1.0);
}`,
      depthTest: false,
      depthWrite: false,
    });
    this.outMat = new ShaderMaterial({
      uniforms: {
        tIn: { value: null },
        tAcc: { value: null },
        uMix: { value: 0 },
        uMax: { value: 14 },
      },
      vertexShader: FS_VERT,
      fragmentShader: /* glsl */ `
uniform sampler2D tIn;
uniform sampler2D tAcc;
uniform float uMix;
uniform float uMax;
varying vec2 vUv;
void main() {
  vec3 c = min(texture2D(tIn, vUv).rgb, vec3(uMax));
  if (uMix > 0.0) c = mix(c, max(c, texture2D(tAcc, vUv).rgb), uMix);
  gl_FragColor = vec4(c, 1.0);
}`,
      depthTest: false,
      depthWrite: false,
    });
    this.fullscreenMaterial = this.outMat;
  }

  render(renderer: WebGLRenderer, inputBuffer: WebGLRenderTarget, outputBuffer: WebGLRenderTarget) {
    const on = fx.trail > 0.001;
    if (on) {
      const next = 1 - this.i;
      const a = this.accMat.uniforms;
      a.tIn.value = inputBuffer.texture;
      a.tPrev.value = this.acc[this.i].texture;
      a.uDecay.value = fx.trailReset ? 0 : fx.trailDecay;
      a.uMax.value = fx.maxLum;
      (a.uPole.value as Vector2).set(fx.trailPole[0], fx.trailPole[1]);
      a.uTurn.value = fx.trailReset ? 0 : fx.trailTurn;
      a.uHor.value = fx.trailHorizon;
      a.uAspect.value = fx.aspect;
      this.fullscreenMaterial = this.accMat;
      renderer.setRenderTarget(this.acc[next]);
      renderer.render(this.scene, this.camera);
      this.i = next;
    }
    fx.trailReset = false;
    const o = this.outMat.uniforms;
    o.tIn.value = inputBuffer.texture;
    o.tAcc.value = this.acc[this.i].texture;
    o.uMix.value = on ? fx.trail : 0;
    o.uMax.value = fx.maxLum;
    this.fullscreenMaterial = this.outMat;
    renderer.setRenderTarget(this.renderToScreen ? null : outputBuffer);
    renderer.render(this.scene, this.camera);
  }

  setSize(width: number, height: number) {
    for (const r of this.acc) r.setSize(width, height);
  }

  /** Compiles the long exposure's program now (it first draws in fig. 12), as it draws: into its buffer. */
  warm(renderer: WebGLRenderer) {
    this.fullscreenMaterial = this.accMat;
    const done = precompile(renderer, this.scene, this.camera);
    this.fullscreenMaterial = this.outMat;
    return done;
  }

  dispose() {
    for (const r of this.acc) r.dispose();
    this.accMat.dispose();
    this.outMat.dispose();
  }
}

/** An effect pass whose program can be compiled before it first draws (the plain pass waits for the record). */
class WarmEffectPass extends EffectPass {
  /** As it draws: to the screen. */
  warm(renderer: WebGLRenderer) {
    return renderer.compileAsync(this.scene, this.camera);
  }
}

type Chain = {
  composer: EffectComposer;
  overlay: RenderPass;
  trail: TrailPass;
  full: EffectPass;
  plain: WarmEffectPass;
  size: Vector2;
  empty: Scene;
};

const BLOOM: Record<GLTier, { intensity: number; levels: number; scale: number }> = {
  high: { intensity: 0.95, levels: 7, scale: 1 },
  medium: { intensity: 0.85, levels: 6, scale: 0.75 },
  low: { intensity: 0.75, levels: 5, scale: 0.5 },
};

function build(gl: WebGLRenderer, scene: Scene, camera: Camera, tier: GLTier): Chain {
  const composer = new EffectComposer(gl, { frameBufferType: HalfFloatType, multisampling: 0 });
  const empty = new ThreeScene();
  const b = BLOOM[tier];
  const bloom = new BloomEffect({
    mipmapBlur: true,
    intensity: b.intensity,
    luminanceThreshold: 1.0,
    luminanceSmoothing: 0.35,
    levels: b.levels,
    radius: 0.78,
    resolutionScale: b.scale,
  });
  const full = new EffectPass(
    camera,
    bloom,
    new ToneMappingEffect({ mode: ToneMappingMode.AGX }),
    new FinishEffect(0.22),
  );
  const plain = new WarmEffectPass(
    camera,
    new ToneMappingEffect({ mode: ToneMappingMode.AGX }),
    new FinishEffect(0.22),
  );
  const overlay = new RenderPass(empty, camera);
  overlay.clear = false;
  const trail = new TrailPass();
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(trail);
  composer.addPass(overlay);
  composer.addPass(full);
  composer.addPass(plain);
  full.renderToScreen = true;
  plain.renderToScreen = true;
  plain.enabled = false;
  return { composer, overlay, trail, full, plain, size: new Vector2(), empty };
}

/**
 * One post chain: the scene, the clamp + star trails, the sprites, then high-threshold bloom (only light blooms),
 * AgX, a whisper of vignette and a dither. While the record is read the bloom pass is skipped (the show sets
 * fx.bloom).
 */
export default function Effects({ tier }: { tier: GLTier }) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const chain = useMemo(() => build(gl, scene, camera, tier), [gl, scene, camera, tier]);

  useEffect(() => {
    gl.toneMapping = NoToneMapping;
    gl.toneMappingExposure = 1;
  }, [gl]);
  useEffect(() => () => chain.composer.dispose(), [chain]);
  // the passes the show reaches late (the sky's long exposure, the record's plain finish) compile now, not on their
  // first frame (the scene's own programs: src/gl/precompile.ts, from the show)
  useEffect(() => {
    Promise.all([chain.trail.warm(gl), chain.plain.warm(gl)]).catch(() => {
      // compiled on first use instead
    });
  }, [chain, gl]);

  useFrame((state, delta) => {
    const c = chain;
    gl.getDrawingBufferSize(c.size);
    const ib = c.composer.inputBuffer;
    if (ib.width !== c.size.x || ib.height !== c.size.y)
      c.composer.setSize(state.size.width, state.size.height, false);
    c.overlay.mainScene = fx.overlay ?? c.empty;
    c.full.enabled = fx.bloom;
    c.plain.enabled = !fx.bloom;
    c.composer.render(delta);
  }, 1);

  return null;
}
