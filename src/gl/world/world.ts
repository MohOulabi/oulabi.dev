/**
 * The world module's GPU side: the planet's surface (Earth: the land from public/data/earth.png, the real cities'
 * lights, the region's and the far ones', the weather) baked once into a cube map, then six draws per frame (the
 * planet, the air and the hub's light, the arcs, the far network's arcs, the flow, the far lights' markers) and, in
 * fig. 9, the storm's three (./storm.ts: the streaks, the field's loops, the aurora). update() is called once per
 * frame with the camera the core show has placed; it allocates nothing.
 *
 * Fig. 8: your point lands at the hub (HANDOFF.ARRIVE) and a soft ring of light spreads over the night side from it
 * (BEATS.theirs.impact); the cities light outward from the hub in order of distance (cities), the region's first and
 * then the world beyond it (layout.ts FAR), and the network wires the region together from that first city, then
 * runs out through the gateways and wires the world beyond it, region by region (network; layout.ts FAR_ARCS).
 * Writes anchors `hub` and `world` and shared.play.cities (every city lit, far ones too). In fig. 10 the lights lift
 * off into the flock (the core show's murmuration): the cities and the network step down as it rises, so the lights
 * become the flock. Under the lines of copy the world's own light steps down too (./band.ts).
 *
 * The surge is dormant, kept for a possible return, and not drawn: its arcs (kind 1, the routes into the hub; kind 2,
 * the hops to the nodes) sit after the network in ARCS and are left out of the instance count, and the node markers and
 * the wave packets sit after the city markers in the flow, which draws only the cities unless a tap's wave is running.
 * The shaders keep their branches (uRouteK and uNode[].w held at 0), so the surge could be woken again.
 */
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  ClampToEdgeWrapping,
  CubeCamera,
  DataTexture,
  DoubleSide,
  Float32BufferAttribute,
  FloatType,
  Group,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  LinearFilter,
  LinearMipmapLinearFilter,
  Matrix3,
  Matrix4,
  Mesh,
  NearestFilter,
  NoColorSpace,
  type PerspectiveCamera,
  Points,
  RepeatWrapping,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  Sphere,
  SphereGeometry,
  type Texture,
  TextureLoader,
  UnsignedByteType,
  Vector2,
  Vector3,
  Vector4,
  WebGLCubeRenderTarget,
  type WebGLRenderer,
} from "three";
import { shared } from "@/gl/shared";
import { ANCHOR, setAnchor } from "@/lib/anchors";
import { wake } from "@/lib/clock";
import { hold } from "@/lib/hold";
import { BEATS, F, HANDOFF } from "@/lib/journey";
import { story } from "@/lib/story";
import type { GLTier } from "@/lib/tier";
import { captionBand } from "./band";
import {
  ARCS,
  AXIS,
  CENTER,
  CITIES,
  cityKAt,
  FAR,
  FAR_ARCS,
  GEO_LON0,
  GEO_X,
  GEO_Y,
  GEO_Z,
  HUB,
  impactAt,
  MAG,
  MAX_CITIES,
  NODE_LIST,
  NODES,
  netKAt,
  OVAL,
  presenceAt,
  RADIUS,
  SHOW_FROM,
  SHOW_TO,
  SKYLIGHT,
  STORM_DIR,
  SUN,
  ss,
} from "./layout";
import {
  AIR_FRAG,
  AIR_VERT,
  ARC_FRAG,
  ARC_VERT,
  BAKE_FRAG,
  BAKE_VERT,
  FAR_ARC_FRAG,
  FAR_ARC_VERT,
  FAR_FRAG,
  FAR_VERT,
  FLOW_FRAG,
  FLOW_VERT,
  PLANET_FRAG,
  PLANET_VERT,
} from "./shaders";
import { StormGL } from "./storm";

/** Per tier: cube face size of the baked surface, flood particles (the dormant surge: none), particles per wave packet, sphere detail. */
const BUDGET: Record<GLTier, { face: number; flow: number; wave: number; seg: [number, number] }> =
  {
    high: { face: 1024, flow: 0, wave: 1200, seg: [160, 112] },
    medium: { face: 768, flow: 0, wave: 600, seg: [128, 90] },
    low: { face: 512, flow: 0, wave: 300, seg: [96, 64] },
  };
const ARC_SEG = 96;
/** The far network's links are short and medium arcs (layout.ts FAR_ARCS): fewer segments do. */
const FAR_SEG = 40;
const WAVES = 4;
/**
 * The visitor's drag turns the planet in figs 8-9 once your point has become the first city (HINTS theirs drag); from
 * fig. 10 a drag leads the flock (a finger's "drag to lead them"), and the planet springs back to rest under it.
 */
const DRAG_FROM = F.theirs + 0.2;
const DRAG_TO = F.flock;
const DRAG_LIMIT = 0.34;
/** A tap sends a wave of light from the nearest lit city to the hub, once the first cities are lit. */
const TAP_FROM = F.theirs + BEATS.theirs.cities[0] + 0.02;
/** A tap older than this (ms) is not this figure's (a click in fig. 3 and a jump into fig. 8 is not a tap here). */
const TAP_FRESH = 600;
/** A wave runs this long (s of the world's time; FLOW_VERT draws a packet up to 7 s old). */
const WAVE_S = 7;
/**
 * Fig. 10: the lights lift off into the flock (the core show's figures/flock.ts FLOCK_T.rise, from journey BEATS): what
 * stays on the ground of the cities' light and of the network's once it has risen.
 */
const RISE = [F.flock + BEATS.flock.rise[0], F.flock + BEATS.flock.rise[1] + 0.2] as const;
const KEEP_LIGHTS = 0.22;
const KEEP_NET = 0.3;
/** How much of the world's light steps down under the lines of copy (./band.ts). */
const BAND_DIM = 0.8;
/** The map the surface is baked from (scripts/bake-earth.mjs), and how long the baked surface takes to fade in (ms). */
const EARTH_URL = "/data/earth.png";
const SURF_FADE = 700;
/** The cloud's slow turn about y (rad per second of the world's time; shaders.ts PLANET_FRAG uCloud). */
const CLOUD_W = 0.0025;
/** How much bigger the planet is drawn while the core show's sphere is under it (more than either's facets sag). */
const HANDOFF_PROUD = 0.002;

const damp = (cur: number, to: number, rate: number, dt: number) =>
  to + (cur - to) * Math.exp(-rate * dt);

/** A ribbon strip of `seg` segments: x along it (0..1), y its side (-1, 1); the arcs are instanced on it. */
function ribbon(seg: number) {
  const pos = new Float32Array((seg + 1) * 2 * 3);
  for (let i = 0; i <= seg; i++) {
    for (let k = 0; k < 2; k++) {
      const o = (i * 2 + k) * 3;
      pos[o] = i / seg;
      pos[o + 1] = k === 0 ? -1 : 1;
    }
  }
  return pos;
}
function ribbonIndex(seg: number) {
  const idx: number[] = [];
  for (let i = 0; i < seg; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  return idx;
}

export class WorldGL {
  readonly group = new Group();
  readonly tier: GLTier;
  private cube: WebGLCubeRenderTarget;
  private baked = false;
  /** The map (public/data/earth.png), loaded once; the bake waits for it. */
  private earth: Texture;
  private earthReady = false;
  private gl: WebGLRenderer | null = null;
  /** When the surface was baked (performance.now()), for its fade in; -1 not yet. */
  private bakedAt = -1;
  private planet: Mesh;
  private planetM: ShaderMaterial;
  private air: Mesh;
  private airM: ShaderMaterial;
  private arcs: Mesh;
  private arcM: ShaderMaterial;
  private flow: Points;
  private flowM: ShaderMaterial;
  /** The far lights' markers (layout.ts FAR): a points draw of their own, from attributes. */
  private far: Points;
  private farM: ShaderMaterial;
  /** The far network (layout.ts FAR_ARCS): instanced ribbons of their own, from attributes. */
  private farArcs: Mesh;
  private farArcM: ShaderMaterial;
  private nodeU: Vector4[];
  private waveU: Vector4[];
  private markers: number;
  private stormGL: StormGL;
  private impact = new Vector3();
  /** The copy band, shared by every material that steps down under it (./band.ts). */
  private band = { uBand: { value: new Vector4() }, uBandK: { value: new Vector4() } };

  // state
  private time = 0;
  private lastNow = 0;
  private drag = 0;
  private dragV = 0;
  private lastX = 0;
  private wasDown = false;
  private lastTap = hold.tapAt;
  private waveIdx = 0;
  /** The world's time until which a tap's wave is still running (the flow draws its packets until then). */
  private waveUntil = -1;

  // scratch
  private rot = new Matrix3();
  private rotT = new Matrix3();
  private m4 = new Matrix4();
  private v1 = new Vector3();
  private v2 = new Vector3();
  private v3 = new Vector3();
  private buf = new Vector2();

  constructor(tier: GLTier) {
    this.tier = tier;
    const B = BUDGET[tier];
    this.cube = new WebGLCubeRenderTarget(B.face, {
      generateMipmaps: true,
      minFilter: LinearMipmapLinearFilter,
      magFilter: LinearFilter,
      type: UnsignedByteType,
      depthBuffer: false,
    });
    // the map: data, read at its own resolution in the bake (no mips), wrapping round the globe in longitude
    this.earth = new TextureLoader().load(EARTH_URL, () => {
      this.earthReady = true;
      if (this.gl) {
        this.bake(this.gl);
        wake(SURF_FADE + 200);
      }
    });
    this.earth.colorSpace = NoColorSpace;
    this.earth.wrapS = RepeatWrapping;
    this.earth.wrapT = ClampToEdgeWrapping;
    this.earth.minFilter = LinearFilter;
    this.earth.magFilter = LinearFilter;
    this.earth.generateMipmaps = false;

    const cityV = CITIES.map((c) => new Vector4(c.dir.x, c.dir.y, c.dir.z, c.size));
    const cityI = CITIES.map((c) => new Vector4(c.order, c.spokeH, c.speed, c.weight));
    while (cityV.length < MAX_CITIES) cityV.push(new Vector4());
    while (cityI.length < MAX_CITIES) cityI.push(new Vector4(1, 0, 0, 0));
    this.nodeU = NODE_LIST.map((n) => new Vector4(n.dir.x, n.dir.y, n.dir.z, 0));
    this.waveU = Array.from({ length: WAVES }, () => new Vector4(0, -100, 0, 0));
    const C = CENTER;

    // ---- the planet
    this.planetM = new ShaderMaterial({
      uniforms: {
        uSurf: { value: this.cube.texture },
        uRotT: { value: this.rotT },
        uC: { value: C },
        uR: { value: RADIUS },
        uSun: { value: SUN },
        uMoon: { value: SKYLIGHT },
        uCityK: { value: 0 },
        uAlpha: { value: 0 },
        uTime: { value: 0 },
        uHub: { value: HUB },
        uHubGlow: { value: 0 },
        uLit: { value: 1 },
        uImpact: { value: this.impact },
        uFlick: { value: 0 },
        uAx: { value: AXIS },
        uMag: { value: MAG },
        uOval: { value: OVAL },
        uAurG: { value: 0 },
        uSurfK: { value: 0 },
        uCloud: { value: 0 },
        ...this.band,
      },
      vertexShader: PLANET_VERT,
      fragmentShader: PLANET_FRAG,
      transparent: true,
      depthWrite: true,
      depthTest: true,
    });
    this.planet = new Mesh(new SphereGeometry(RADIUS, B.seg[0], B.seg[1]), this.planetM);
    this.planet.position.copy(C);
    this.planet.renderOrder = 1;
    this.planet.frustumCulled = false;

    // ---- the air and the hub's light
    const tri = new BufferGeometry();
    tri.setAttribute("position", new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
    tri.boundingSphere = new Sphere(C.clone(), 1e4);
    this.airM = new ShaderMaterial({
      uniforms: {
        uInvVP: { value: new Matrix4() },
        uC: { value: C },
        uR: { value: RADIUS },
        uSun: { value: SUN },
        uI: { value: 0 },
        uRes: { value: new Vector2(1, 1) },
        uHubP: { value: new Vector3() },
        uHubA: { value: new Vector4(3, 20, 0, 0) },
        uStorm: { value: new Vector4(STORM_DIR.x, STORM_DIR.y, STORM_DIR.z, 0) },
        uAur: { value: new Vector4(MAG.x, MAG.y, MAG.z, 0) },
        uOvalA: { value: OVAL },
        ...this.band,
      },
      vertexShader: AIR_VERT,
      fragmentShader: AIR_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.air = new Mesh(tri, this.airM);
    this.air.frustumCulled = false;
    this.air.renderOrder = 1.5;

    // ---- the arcs: one ribbon strip, instanced per arc
    const ag = new InstancedBufferGeometry();
    ag.setAttribute("position", new BufferAttribute(ribbon(ARC_SEG), 3));
    ag.setIndex(ribbonIndex(ARC_SEG));
    const n = ARCS.length;
    const aA = new Float32Array(n * 3);
    const aB = new Float32Array(n * 3);
    const aP = new Float32Array(n * 4);
    const aQ = new Float32Array(n * 4);
    const aI = new Float32Array(n * 2);
    ARCS.forEach((a, i) => {
      const da = a.kind === 2 ? HUB : CITIES[a.a].dir;
      const db = a.kind === 2 ? NODE_LIST[a.b].dir : CITIES[a.b].dir;
      aA.set([da.x, da.y, da.z], i * 3);
      aB.set([db.x, db.y, db.z], i * 3);
      aP.set([a.height, a.kind, a.delay, a.toHub], i * 4);
      aQ.set([a.speed, a.phase, a.bright, 0], i * 4);
      aI.set(a.kind === 2 ? [0, a.b] : [a.a, a.b], i * 2);
    });
    ag.setAttribute("aA", new InstancedBufferAttribute(aA, 3));
    ag.setAttribute("aB", new InstancedBufferAttribute(aB, 3));
    ag.setAttribute("aP", new InstancedBufferAttribute(aP, 4));
    ag.setAttribute("aQ", new InstancedBufferAttribute(aQ, 4));
    ag.setAttribute("aI", new InstancedBufferAttribute(aI, 2));
    // only the network (kind 0, first in ARCS): the surge's routes and hops are not drawn
    let net = 0;
    while (net < n && ARCS[net].kind === 0) net++;
    ag.instanceCount = net;
    ag.boundingSphere = new Sphere(C.clone(), RADIUS * 2);
    const shared3 = {
      uRot: { value: this.rot },
      uC: { value: C },
      uR: { value: RADIUS },
      uProj: { value: 1000 },
      uDpr: { value: 1 },
      uTime: { value: 0 },
      uNode: { value: this.nodeU },
      uWave: { value: this.waveU },
      uCalm: { value: 0 },
      uFlick: { value: 0 },
      ...this.band,
    };
    this.arcM = new ShaderMaterial({
      uniforms: {
        ...shared3,
        uRes: { value: new Vector2(1, 1) },
        uNetK: { value: 0 },
        uRouteK: { value: 0 },
        uFlow: { value: 0 },
        uFade: { value: 0 },
        uNetDim: { value: 1 },
      },
      vertexShader: ARC_VERT,
      fragmentShader: ARC_FRAG,
      // the ribbon is expanded in screen space: its winding is not a facing
      side: DoubleSide,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.arcs = new Mesh(ag, this.arcM);
    this.arcs.frustumCulled = false;
    this.arcs.renderOrder = 3;

    // ---- the far network: the same ribbon, instanced per far link, its schedule and look in attributes
    const xg = new InstancedBufferGeometry();
    xg.setAttribute("position", new BufferAttribute(ribbon(FAR_SEG), 3));
    xg.setIndex(ribbonIndex(FAR_SEG));
    const m = FAR_ARCS.length;
    const xA = new Float32Array(m * 3);
    const xB = new Float32Array(m * 3);
    const xP = new Float32Array(m * 4);
    const xQ = new Float32Array(m * 4);
    FAR_ARCS.forEach((a, i) => {
      xA.set([a.a.x, a.a.y, a.a.z], i * 3);
      xB.set([a.b.x, a.b.y, a.b.z], i * 3);
      xP.set([a.height, a.delay, a.dur, a.kind], i * 4);
      xQ.set([a.speed, a.phase, a.bright, a.flow], i * 4);
    });
    xg.setAttribute("aA", new InstancedBufferAttribute(xA, 3));
    xg.setAttribute("aB", new InstancedBufferAttribute(xB, 3));
    xg.setAttribute("aP", new InstancedBufferAttribute(xP, 4));
    xg.setAttribute("aQ", new InstancedBufferAttribute(xQ, 4));
    xg.instanceCount = m;
    xg.boundingSphere = new Sphere(C.clone(), RADIUS * 2);
    const ar0 = this.arcM.uniforms;
    this.farArcM = new ShaderMaterial({
      uniforms: {
        uRot: shared3.uRot,
        uC: shared3.uC,
        uR: shared3.uR,
        uProj: shared3.uProj,
        uDpr: shared3.uDpr,
        uTime: shared3.uTime,
        uFlick: shared3.uFlick,
        uRes: ar0.uRes,
        uNetK: ar0.uNetK,
        uFade: ar0.uFade,
        ...this.band,
      },
      vertexShader: FAR_ARC_VERT,
      fragmentShader: FAR_ARC_FRAG,
      side: DoubleSide,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.farArcs = new Mesh(xg, this.farArcM);
    this.farArcs.frustumCulled = false;
    this.farArcs.renderOrder = 3;

    // ---- the flow: markers (cities, nodes), the flood, the wave packets
    this.markers = CITIES.length + NODES;
    const total = this.markers + B.flow + WAVES * B.wave;
    const ids = new Float32Array(total);
    for (let i = 0; i < total; i++) ids[i] = i;
    const fg = new BufferGeometry();
    fg.setAttribute("position", new BufferAttribute(ids, 1));
    fg.boundingSphere = new Sphere(C.clone(), RADIUS * 2);
    this.flowM = new ShaderMaterial({
      uniforms: {
        ...shared3,
        uCityK: { value: 0 },
        uNC: { value: CITIES.length },
        uFlowN: { value: B.flow },
        uWaveN: { value: B.wave },
        uCity: { value: cityV },
        uCityI: { value: cityI },
        uF: { value: 0 },
        uMarks: { value: 1 },
        uPeak: { value: 0 },
        uFade: { value: 0 },
      },
      vertexShader: FLOW_VERT,
      fragmentShader: FLOW_FRAG,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.flow = new Points(fg, this.flowM);
    this.flow.frustumCulled = false;
    this.flow.renderOrder = 4;
    // the city markers only, until a tap's wave runs (update widens it)
    fg.setDrawRange(0, CITIES.length);

    // ---- the far lights' markers: one point each, their base direction and (light, order, seed) as attributes
    const farPos = new Float32Array(FAR.length * 3);
    const farF = new Float32Array(FAR.length * 3);
    FAR.forEach((c, i) => {
      farPos.set([c.dir.x, c.dir.y, c.dir.z], i * 3);
      farF.set([c.size, c.order, c.seed], i * 3);
    });
    const farG = new BufferGeometry();
    farG.setAttribute("position", new BufferAttribute(farPos, 3));
    farG.setAttribute("aF", new BufferAttribute(farF, 3));
    farG.boundingSphere = new Sphere(C.clone(), RADIUS * 2);
    this.farM = new ShaderMaterial({
      uniforms: {
        uFlick: shared3.uFlick,
        uRot: shared3.uRot,
        uC: shared3.uC,
        uR: shared3.uR,
        uProj: shared3.uProj,
        uDpr: shared3.uDpr,
        uTime: shared3.uTime,
        uCityK: { value: 0 },
        uFade: { value: 0 },
        uMarks: { value: 1 },
        ...this.band,
      },
      vertexShader: FAR_VERT,
      fragmentShader: FAR_FRAG,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    this.far = new Points(farG, this.farM);
    this.far.frustumCulled = false;
    this.far.renderOrder = 4;

    this.stormGL = new StormGL(tier, this.band);
    this.group.add(
      this.planet,
      this.air,
      this.arcs,
      this.farArcs,
      this.flow,
      this.far,
      ...this.stormGL.meshes,
    );
    this.group.visible = false;
  }

  /**
   * Bake the surface once (a cube camera at the planet's centre, six faces of the bake shader), from the map: if it
   * has not loaded yet, the bake runs when it does (and the surface fades in, uSurfK).
   */
  bake(gl: WebGLRenderer) {
    this.gl = gl;
    if (this.baked || !this.earthReady) return;
    this.baked = true;
    this.bakedAt = performance.now();
    // every city, the region's then the far ones, as a table (shaders.ts BAKE_FRAG uCities): one column each, row 0
    // its direction and light, row 1 its order and seed
    const all = [...CITIES, ...FAR];
    const n = all.length;
    const tab = new Float32Array(n * 2 * 4);
    all.forEach((c, i) => {
      tab.set([c.dir.x, c.dir.y, c.dir.z, c.size], i * 4);
      tab.set([c.order, c.seed, 0, 0], (n + i) * 4);
    });
    const cities = new DataTexture(tab, n, 2, RGBAFormat, FloatType);
    cities.minFilter = NearestFilter;
    cities.magFilter = NearestFilter;
    cities.generateMipmaps = false;
    cities.needsUpdate = true;
    const m = new ShaderMaterial({
      uniforms: {
        uCities: { value: cities },
        uNC: { value: n },
        uEarth: { value: this.earth },
        uGeoX: { value: GEO_X },
        uGeoY: { value: GEO_Y },
        uGeoZ: { value: GEO_Z },
        uLon0: { value: GEO_LON0 },
      },
      vertexShader: BAKE_VERT,
      fragmentShader: BAKE_FRAG,
      side: BackSide,
      depthTest: false,
      depthWrite: false,
    });
    const box = new Mesh(new BoxGeometry(2, 2, 2), m);
    const scene = new Scene();
    scene.add(box);
    const cam = new CubeCamera(0.05, 10, this.cube);
    const prevAuto = gl.autoClear;
    gl.autoClear = true;
    cam.update(gl, scene);
    gl.autoClear = prevAuto;
    box.geometry.dispose();
    m.dispose();
    cities.dispose();
    shared.earth.surf = this.cube.texture;
    shared.earth.at = this.bakedAt;
  }

  /** Start over (src/lib/restart.ts): the planet unturned, no wave running, the storm's field not raised. */
  reset() {
    this.drag = 0;
    this.dragV = 0;
    this.wasDown = false;
    this.lastTap = hold.tapAt;
    this.waveUntil = -1;
    this.stormGL.reset();
  }

  /** One frame. `cam` is the camera the core show placed this frame. Writes anchor `hub` while it draws. */
  update(gl: WebGLRenderer, cam: PerspectiveCamera) {
    const now = performance.now();
    const dt = this.lastNow
      ? Math.min(0.05, Math.max(1 / 240, (now - this.lastNow) / 1000))
      : 1 / 60;
    this.lastNow = now;
    const T = story.Ts;
    const on = T >= SHOW_FROM && T < SHOW_TO;
    this.group.visible = on;
    // a tap is read every frame, drawn or not, so one made before the world was on never fires late
    const tapped = hold.tapAt !== this.lastTap && hold.tapAt >= 0 && now - hold.tapAt < TAP_FRESH;
    this.lastTap = hold.tapAt;
    if (!on) {
      this.drag = 0;
      this.dragV = 0;
      shared.earth.turn = 0;
      this.stormGL.hide();
      return;
    }
    const reduce = story.reducedMotion;
    this.time = reduce ? 40 : this.time + dt;
    const time = this.time;
    const presence = presenceAt(T);

    // ---- the timeline: your point lands on the hub, the cities light, the network draws on
    const cityK = reduce ? 1.04 : cityKAt(T);
    const netK = reduce ? 1.1 : netKAt(T);
    // the quiet count of lit cities (the ink: the region's and the far ones), and the world itself from your point's
    // landing on
    let lit = 0;
    for (let i = 0; i < CITIES.length; i++) if (cityK >= CITIES[i].order + 0.01) lit++;
    for (let i = 0; i < FAR.length; i++) if (cityK >= FAR[i].order + 0.01) lit++;
    shared.play.cities = lit;
    if (T >= HANDOFF.ARRIVE && presence > 0.002)
      setAnchor(ANCHOR.world, CENTER.x, CENTER.y, CENTER.z, RADIUS, presence);

    // ---- the visitor's drag turns the planet a little; it springs back
    const dragLive = !reduce && T > DRAG_FROM && T < DRAG_TO;
    if (dragLive && hold.down && !hold.pressing) {
      if (this.wasDown) {
        const dx = hold.x - this.lastX;
        const target = (dx / Math.max(1, window.innerWidth)) * 2.4;
        this.drag += target;
        this.dragV = this.dragV * 0.7 + (target / dt) * 0.3;
      }
      this.lastX = hold.x;
      this.wasDown = true;
    } else {
      this.wasDown = false;
      // coast a moment, then spring back to rest
      this.dragV += (-this.drag * 9 - this.dragV * 5.2) * dt;
      this.drag += this.dragV * dt;
    }
    if (!dragLive) {
      this.drag = damp(this.drag, 0, 4, dt);
      this.dragV = 0;
    }
    this.drag = Math.max(-DRAG_LIMIT, Math.min(DRAG_LIMIT, this.drag));
    // (the flock waits over the lights where the drag has turned them: glsl/finale.ts nightSide)
    shared.earth.turn = this.drag;
    this.m4.makeRotationAxis(AXIS, this.drag);
    this.rot.setFromMatrix4(this.m4);
    this.rotT.copy(this.rot).transpose();

    // ---- a tap launches a wave from the nearest lit city (the flow draws its packets while one runs)
    if (
      tapped &&
      !reduce &&
      T > TAP_FROM &&
      T < F.again &&
      this.launchWave(cam, hold.tx, hold.ty, cityK, time)
    ) {
      this.waveUntil = time + WAVE_S;
    }
    const waves = time < this.waveUntil;
    this.flow.geometry.setDrawRange(0, waves ? Infinity : CITIES.length);

    // ---- frame uniforms
    gl.getDrawingBufferSize(this.buf);
    const W = this.buf.x;
    const H = this.buf.y;
    const dpr = gl.getPixelRatio();
    const proj = H / (2 * Math.tan((cam.fov * Math.PI) / 360));
    // the copy band (./band.ts) and, in fig. 10, the lights lifting off into the flock
    captionBand(W, H, dpr, BAND_DIM, this.band.uBand.value, this.band.uBandK.value);
    const rise = reduce ? 0 : ss(RISE[0], RISE[1], T);
    const keepLights = 1 - (1 - KEEP_LIGHTS) * rise;
    const keepNet = 1 - (1 - KEEP_NET) * rise;

    // ---- fig. 9: the storm, the field, the aurora (./storm.ts); the lights and the network flicker as it hits
    this.stormGL.update(T, time, dt, reduce, presence, W, H, dpr, cam.position);
    const flick = this.stormGL.flick;

    // ---- fig. 8: the impact of your point at the hub (a soft ring over the ground, a swell of the hub's light)
    const ik = reduce ? 1 : impactAt(T);
    const iOn = ik > 0 && ik < 1;
    const ie = 1 - (1 - Math.min(1, Math.max(0, ik))) ** 2.2;
    this.impact.set(
      0.015 + 0.95 * ie,
      0.035 + 0.09 * ie,
      iOn ? ss(0, 0.1, ik) * (1 - ik) ** 1.5 : 0,
    );
    const swell = iOn ? ss(0, 0.12, ik) * (1 - ik) ** 2 : 0;

    const pu = this.planetM.uniforms;
    pu.uCityK.value = cityK;
    pu.uAlpha.value = presence;
    pu.uTime.value = time;
    // (the cloud's turn, PLANET_FRAG: the core show's world planet turns its cloud with it)
    shared.earth.cloud = time * CLOUD_W;
    pu.uCloud.value = shared.earth.cloud;
    this.planetM.depthWrite = presence > 0.985;
    // while the core show's sphere is still there under it (the handoff), the planet stands a hair proud of it, so
    // their facets never fight over depth (that read as dark dashes across the land)
    this.planet.scale.setScalar(
      1 +
        HANDOFF_PROUD *
          (1 - ss(HANDOFF.WORLD_HANDOFF[1] - 0.02, HANDOFF.WORLD_HANDOFF[1] + 0.01, T)),
    );
    pu.uHubGlow.value = Math.max(Math.min(1, cityK * 8), swell) * 0.12;
    pu.uLit.value = keepLights;
    pu.uFlick.value = flick;
    pu.uAurG.value = this.stormGL.aurora;
    // the surface fades in once baked (at once when it was baked before the world came on, as it nearly always is)
    pu.uSurfK.value = !this.baked ? 0 : reduce ? 1 : ss(0, SURF_FADE, now - this.bakedAt);

    const au = this.airM.uniforms;
    (au.uInvVP.value as Matrix4).multiplyMatrices(cam.matrixWorld, cam.projectionMatrixInverse);
    au.uI.value = presence;
    (au.uRes.value as Vector2).set(W, H);
    // where the hub is on screen, and whether it faces the camera
    this.v1.copy(HUB).applyMatrix3(this.rot);
    const hubW = this.v2.copy(this.v1).multiplyScalar(RADIUS).add(CENTER);
    const facing = this.v1.dot(this.v3.copy(cam.position).sub(hubW).normalize());
    // ink: the hub, where your point landed (the first city), while it faces the camera
    const hubOn = ss(0.02, 0.2, facing) * presence;
    if (hubOn > 0.002) setAnchor(ANCHOR.hub, hubW.x, hubW.y, hubW.z, RADIUS * 0.05, hubOn);
    this.v3.copy(hubW).project(cam);
    const hubVis = ss(0.02, 0.2, facing) * (this.v3.z < 1 ? 1 : 0);
    const hp = au.uHubP.value as Vector3;
    hp.set(
      this.v3.x,
      this.v3.y,
      hubVis * presence * Math.max(Math.min(1, cityK * 6), swell) * keepLights,
    );
    const ha = au.uHubA.value as Vector4;
    // the hub's light: a calm core and a warm halo, in proportion on small screens (the surge's glint dormant)
    const fit = Math.min(1, Math.max(0.6, Math.min(W, H) / dpr / 900));
    ha.x = 2.2 * dpr * Math.sqrt(fit);
    ha.y = 7 * dpr * fit;
    ha.z = 0.22 + 0.5 * swell;
    ha.w = 0;
    (au.uStorm.value as Vector4).w = this.stormGL.airGlow;
    (au.uAur.value as Vector4).w = this.stormGL.aurora;

    const ar = this.arcM.uniforms;
    (ar.uRes.value as Vector2).set(W, H);
    ar.uProj.value = proj;
    ar.uDpr.value = dpr;
    ar.uTime.value = time;
    ar.uNetK.value = netK;
    ar.uRouteK.value = 0;
    ar.uFlow.value = 0;
    ar.uCalm.value = 0;
    ar.uNetDim.value = 1;
    ar.uFade.value = presence * keepNet;
    ar.uFlick.value = flick;

    const fu = this.flowM.uniforms;
    fu.uCityK.value = cityK;
    fu.uF.value = 0;
    fu.uPeak.value = 0;
    fu.uMarks.value = keepLights;
    fu.uFade.value = presence;
    const xu = this.farM.uniforms;
    xu.uCityK.value = cityK;
    xu.uMarks.value = keepLights;
    xu.uFade.value = presence;
    // uTime, uProj, uDpr, uCalm, uNode, uWave, uRot, uFlick and the band are the same uniform objects in the materials
  }

  /** A wave from the lit city nearest the tap (NDC tx, ty) to the hub; false when no lit city is near enough. */
  private launchWave(cam: PerspectiveCamera, tx: number, ty: number, cityK: number, time: number) {
    const aspect = cam.aspect || 1.6;
    let best = -1;
    let bestD = 0.32;
    for (let i = 1; i < CITIES.length; i++) {
      const c = CITIES[i];
      if (cityK < c.order + 0.02) continue;
      this.v1.copy(c.dir).applyMatrix3(this.rot);
      const p = this.v2.copy(this.v1).multiplyScalar(RADIUS).add(CENTER);
      if (this.v1.dot(this.v3.copy(cam.position).sub(p).normalize()) < 0.05) continue;
      p.project(cam);
      if (p.z > 1) continue;
      const d = Math.hypot((p.x - tx) * aspect, p.y - ty);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) return false;
    const w = this.waveU[this.waveIdx++ % WAVES];
    w.set(best, time, 1, 0);
    return true;
  }

  /** The baked surface is GPU-only: after a lost WebGL context it is baked again (bake() on the next frame inside). */
  rebake() {
    this.baked = false;
    shared.earth.at = -1;
  }

  dispose() {
    // a remount (React strict mode) bakes again into the recreated target (the map's image is kept for it)
    this.baked = false;
    if (shared.earth.surf === this.cube.texture) {
      shared.earth.surf = null;
      shared.earth.at = -1;
    }
    this.cube.dispose();
    this.earth.dispose();
    this.planet.geometry.dispose();
    this.planetM.dispose();
    this.air.geometry.dispose();
    this.airM.dispose();
    this.arcs.geometry.dispose();
    this.arcM.dispose();
    this.flow.geometry.dispose();
    this.flowM.dispose();
    this.far.geometry.dispose();
    this.farM.dispose();
    this.farArcs.geometry.dispose();
    this.farArcM.dispose();
    this.stormGL.dispose();
  }
}
