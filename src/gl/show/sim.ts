import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  type Data3DTexture,
  DataTexture,
  FloatType,
  HalfFloatType,
  type IUniform,
  Matrix3,
  NearestFilter,
  Points,
  RGBAFormat,
  ShaderMaterial,
  Sphere,
  type Texture,
  Vector2,
  Vector3,
  Vector4,
  type WebGLRenderer,
  type WebGLRenderTarget,
} from "three";
import { GPUComputationRenderer, type Variable } from "three/addons/misc/GPUComputationRenderer.js";
import { FIELD_R, GROUND, NEB_R, OBSERVER, PLANETS, SUN } from "./constants";
import { GAL_HOME } from "./glsl/finale";
import { NEB_FIELD } from "./nebula";
import { POINTS_FRAG, POINTS_VERT } from "./point-shaders";
import { NEB_HOME, POSITION, VELOCITY } from "./sim-shaders";
import type { SkyData } from "./sky";

function dataTex(side: number, data: Float32Array) {
  const t = new DataTexture(data, side, side, RGBAFormat, FloatType);
  t.minFilter = NearestFilter;
  t.magFilter = NearestFilter;
  t.needsUpdate = true;
  return t;
}

/** Bit reversal: drawing any prefix of the vertex order draws an even subsample of the motes (the watchdog). */
function bitReverseOrder(n: number) {
  const bits = Math.round(Math.log2(n));
  const out = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    let x = v;
    let r = 0;
    for (let b = 0; b < bits; b++) {
      r = (r << 1) | (x & 1);
      x >>= 1;
    }
    out[v] = r;
  }
  return out;
}

export type Counts = { n: number; flock: number; stars: number };

/**
 * The stateful GPGPU sim (position + velocity, semi-implicit Euler) and its one additive points draw.
 * Every uniform object is shared by the velocity pass, the position pass and the points material. Ids: the flock's
 * motes first (id < flock), the deep-space starfield last (the top `stars` ids), genesis between.
 */
export class Motes {
  readonly side: number;
  readonly n: number;
  readonly counts: Counts;
  readonly U: Record<string, IUniform>;
  readonly points: Points;
  readonly material: ShaderMaterial;
  readonly halfFloat: boolean;
  private gpu: GPUComputationRenderer;
  private velVar: Variable;
  private posVar: Variable;
  private cur = 0;
  private texSky: DataTexture;
  private texSkyCol: DataTexture;
  private nebRT: WebGLRenderTarget;
  private galRT: WebGLRenderTarget;

  /** flockN: the murmuration's motes (constants.ts FLOCK_N for the tier). */
  constructor(
    gl: WebGLRenderer,
    side: number,
    sky: SkyData,
    flockN: number,
    skyM: Matrix3,
    noise: Data3DTexture,
  ) {
    this.side = side;
    const n = side * side;
    this.n = n;
    const flock = Math.min(n, flockN);
    // the deep-space starfield is the top range of ids, clear of the flock's
    const stars = Math.min(n - flock, Math.round(n / 16));
    this.counts = { n, flock, stars };

    this.texSky = dataTex(side, sky.sky);
    this.texSkyCol = dataTex(side, sky.col);

    // the sim
    this.halfFloat = !gl.extensions.has("EXT_color_buffer_float");
    this.gpu = new GPUComputationRenderer(side, side, gl);
    if (this.halfFloat) this.gpu.setDataType(HalfFloatType);
    const p0 = this.gpu.createTexture();
    const v0 = this.gpu.createTexture();
    const pa = p0.image.data as Float32Array;
    const e = new Vector3();
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      const role = sky.sky[o + 3];
      e.set(sky.sky[o], sky.sky[o + 1], sky.sky[o + 2]);
      if (role < 2.5) e.applyMatrix3(skyM);
      pa[o] = OBSERVER[0] + e.x;
      pa[o + 1] = OBSERVER[1] + e.y;
      pa[o + 2] = OBSERVER[2] + e.z;
      pa[o + 3] = 0;
    }
    this.velVar = this.gpu.addVariable("textureVelocity", VELOCITY, v0);
    this.posVar = this.gpu.addVariable("texturePosition", POSITION, p0);
    this.gpu.setVariableDependencies(this.velVar, [this.posVar, this.velVar]);
    this.gpu.setVariableDependencies(this.posVar, [this.posVar, this.velVar]);

    const U: Record<string, IUniform> = {
      // timeline
      uTs: { value: 0 },
      uN: { value: n },
      uSide: { value: side },
      uFlockN: { value: flock },
      uStarN: { value: stars },
      uFreed: { value: 0 },
      uTime: { value: 0 },
      uGround: { value: GROUND },
      // fewer motes, a smaller disc of horizon lights: their density stays
      uFieldR: { value: FIELD_R * (n / 262144) ** 0.25 },
      uObs: { value: new Vector3(...OBSERVER) },
      // sim
      tSky: { value: this.texSky },
      uDt: { value: 1 / 60 },
      uSnap: { value: 0 },
      uSkyM: { value: skyM.clone() },
      uSpring: { value: 1 },
      uDrag: { value: 0 },
      uMotion: { value: 1 },
      uHoldK: { value: 0 },
      uHoldP: { value: new Vector3() },
      uHoldAxis: { value: new Vector3(0, 0, 1) },
      uImpulse: { value: 0 },
      uBangP: { value: new Vector3() },
      uRayO: { value: new Vector3() },
      uRayD: { value: new Vector3(0, 0, -1) },
      uPointer: { value: 0 },
      uFlockC: { value: new Vector3(0, 6, 0) },
      uFlockM: { value: new Matrix3() },
      uWorldTurn: { value: new Matrix3() },
      uFlockS: { value: 1 },
      uFlockT: { value: 0 },
      uGather: { value: 0 },
      uBurst: { value: 0 },
      uBurstP: { value: new Vector3() },
      // genesis
      tNeb: { value: null as Texture | null },
      uSun: { value: new Vector3(...SUN) },
      uCollapse: { value: 0 },
      uSpinC: { value: 0 },
      uCavity: { value: 0 },
      uIgnite: { value: 0 },
      uExpand: { value: 1 },
      uBangOff: { value: new Vector3() },
      uWindK: { value: 0 },
      uGap: { value: 0 },
      uPlanet: { value: PLANETS.map((p) => new Vector4(0, 0, 0, p.r)) },
      uOrb: { value: PLANETS.map(() => new Vector4()) },
      uPull: { value: 0 },
      // fig. 2's stir (glsl/genesis.ts STIR): the hand, its stroke, its eddies
      uStirP: { value: new Vector4() },
      uStirA: { value: new Vector4(0, 0, -1, 1) },
      uStirD: { value: new Vector4() },
      uVortA: { value: Array.from({ length: 6 }, () => new Vector4()) },
      uVortB: { value: Array.from({ length: 6 }, () => new Vector4()) },
      uGenDim: { value: 1 },
      uShock: { value: new Vector4() },
      uClumpB: { value: new Vector4() },
      // fig. 3: the field's slide and the knots (figures/genesis.ts center)
      uFallOff: { value: new Vector3() },
      uKnot: { value: Array.from({ length: 9 }, () => new Vector4()) },
      uStarDim: { value: 1 },
      uPlanetSolid: { value: 0 },
      // render
      tPos: { value: null as Texture | null },
      tVel: { value: null as Texture | null },
      tSkyCol: { value: this.texSkyCol },
      uProj: { value: 1000 },
      uDpr: { value: 1 },
      uAspect: { value: 1.6 },
      uFreedK: { value: 0 },
      uHeat: { value: 0 },
      uDim: { value: 1 },
      uLensE: { value: 0 },
      uLensC: { value: new Vector2() },
      uCoreR: { value: 0.4 },
      uWheel: { value: new Matrix3() },
      uKeep: { value: n },
      uKeepFade: { value: 1 },
      uMaxPx: { value: 48 },
      uTrail: { value: 0 },
      // the finale (figs 10-12, glsl/finale.ts): the flock's formations, the cursor it parts around, a tap's reach;
      // the galaxy's homes (filled below), its frame and its light
      uForm: { value: new Vector4() },
      uAvoid: { value: 0 },
      uAvoidR: { value: 0.1 },
      uBurstR: { value: 1e4 },
      tGal: { value: null as Texture | null },
      uGalM: { value: new Matrix3() },
      uGalO: { value: new Vector3(...SUN) },
      uGalI: { value: 1 },
      uGalNear: { value: 0 },
    };
    this.U = U;
    for (const v of [this.velVar, this.posVar]) {
      Object.assign(v.material.uniforms, U);
    }
    const err = this.gpu.init();
    if (err) console.error(err);

    // the nebula's rest homes, drawn once from the gas's own density
    this.nebRT = this.gpu.createRenderTarget(
      side,
      side,
      ClampToEdgeWrapping,
      ClampToEdgeWrapping,
      NearestFilter,
      NearestFilter,
    );
    const nm = this.gpu.createShaderMaterial(NEB_HOME.replace("NEB_DENSITY", NEB_FIELD), {
      tNoise: { value: noise },
      uNebR: { value: NEB_R },
    });
    this.gpu.doRenderTarget(nm, this.nebRT);
    nm.dispose();
    U.tNeb.value = this.nebRT.texture;
    // the galaxy's homes (fig. 11), drawn once from each mote's place in the sky (glsl/finale.ts GAL_HOME)
    this.galRT = this.gpu.createRenderTarget(
      side,
      side,
      ClampToEdgeWrapping,
      ClampToEdgeWrapping,
      NearestFilter,
      NearestFilter,
    );
    const gm = this.gpu.createShaderMaterial(GAL_HOME, {
      tSky: { value: this.texSky },
      tSkyCol: { value: this.texSkyCol },
      uN: { value: n },
      uStarN: { value: stars },
    });
    this.gpu.doRenderTarget(gm, this.galRT);
    gm.dispose();
    U.tGal.value = this.galRT.texture;

    // the draw
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(bitReverseOrder(n), 1));
    g.boundingSphere = new Sphere(new Vector3(), 1e5);
    this.material = new ShaderMaterial({
      uniforms: U,
      vertexShader: POINTS_VERT,
      fragmentShader: POINTS_FRAG,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      blending: AdditiveBlending,
    });
    this.points = new Points(g, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 2;
    this.syncTextures();
  }

  private syncTextures() {
    this.U.tPos.value = this.posVar.renderTargets[this.cur].texture;
    this.U.tVel.value = this.velVar.renderTargets[this.cur].texture;
  }

  /** One semi-implicit step: velocity from (p, v), then position from (p, v'). */
  step() {
    const cur = this.cur;
    const next = 1 - cur;
    const vm = this.velVar.material;
    const pm = this.posVar.material;
    vm.uniforms.texturePosition.value = this.posVar.renderTargets[cur].texture;
    vm.uniforms.textureVelocity.value = this.velVar.renderTargets[cur].texture;
    this.gpu.doRenderTarget(vm, this.velVar.renderTargets[next]);
    pm.uniforms.texturePosition.value = this.posVar.renderTargets[cur].texture;
    pm.uniforms.textureVelocity.value = this.velVar.renderTargets[next].texture;
    this.gpu.doRenderTarget(pm, this.posVar.renderTargets[next]);
    this.cur = next;
    this.syncTextures();
  }

  dispose() {
    this.gpu.dispose();
    this.nebRT.dispose();
    this.galRT.dispose();
    this.texSky.dispose();
    this.texSkyCol.dispose();
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
