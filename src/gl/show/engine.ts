/**
 * The core show, frame by frame (docs/STORY.md, src/lib/journey.ts): the orchestrator. One stateful GPGPU sim of
 * SIM_SIDE[tier]² motes is every light of the show; the gas (nebula.ts) and the solid things of genesis (cosmos.ts)
 * ride the same maps. The engine owns the clock, the pointer, the camera, the watchdog and the look shared across
 * figures; everything a figure does lives in its controller (./figures), each fed the same preallocated frame
 * context (./frame.ts):
 *
 *   genesis  figs 1-3   the hold, the bang, the stir, the nebula, the collapse, the sun's ignition (pre + frame)
 *   system   figs 4-7   the planets, the drag, the overview and the dive to the world (pre + frame)
 *   flock    fig. 10    the murmuration
 *   galaxy   fig. 11    the pull-back; the galaxy of motes; our star and the platform stars (hover, click to Work)
 *   sky      fig. 12    the sky's wheel, the trails, your saved star
 *
 * The world of figs 8-10 is its own module (src/gl/world), drawn into the same scene with this camera. The order of
 * a frame is in ./frame.ts. The ink: anchors are begun here, set by the figures, and projected by project() after
 * the frame is drawn (src/gl/project.ts); the thread sprite follows anchor `yours` (figures/thread.ts). Everything
 * is scrubbed by story.Ts; the visitor's own state lives in the figures. No allocations and no React state per
 * frame.
 */
import {
  type Data3DTexture,
  Matrix3,
  type PerspectiveCamera,
  type Scene,
  Vector2,
  Vector3,
  type WebGL3DRenderTarget,
  type WebGLRenderer,
} from "three";
import { beginInk, projectInk } from "@/gl/project";
import { shared } from "@/gl/shared";
import { ANCHOR, allAnchors, allPaths, anchor, ink } from "@/lib/anchors";
import { wake } from "@/lib/clock";
import { hold } from "@/lib/hold";
import { isQA } from "@/lib/qa";
import { onRestart } from "@/lib/restart";
import { SIM_SIDE } from "@/lib/show";
import { story } from "@/lib/story";
import type { GLTier } from "@/lib/tier";
import { applyRig, type Pose, parallaxAt, type RigCtx, rigAt } from "./camera";
import { FLOCK_N } from "./constants";
import { Cosmos } from "./cosmos";
import { Flock } from "./figures/flock";
import { Galaxy } from "./figures/galaxy";
import { Genesis } from "./figures/genesis";
import { Sky } from "./figures/sky";
import { System } from "./figures/system";
import { createFrameCtx, damp, type Figure, type FrameCtx, ss } from "./frame";
import { FX } from "./fx";
import { bakeNoise, Gas } from "./nebula";
import { Motes } from "./sim";
import { buildSky, lstDeg, skyMatrix } from "./sky";
import { fx } from "./state";

const query =
  typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
/**
 * The thread sprite (fx.ts): its quad's half-size in CSS px (the halo's reach; the core is a fixed few px inside it,
 * so the point reads the same at every distance) and its peak intensity (a whisper of bloom, never a blob).
 */
const THREAD_PX = 22;
const THREAD_I = 1;

type StarFile = { stars: number[] };

export class Engine {
  readonly tier: GLTier;
  readonly sim: Motes;
  readonly fxs = new FX();
  readonly gas: Gas;
  readonly cosmos: Cosmos;
  // the figures, in the order they run
  readonly genesis: Genesis;
  readonly system: System;
  readonly flock: Flock;
  readonly galaxy: Galaxy;
  readonly sky: Sky;
  private figures: Figure[];
  private noise: WebGL3DRenderTarget;
  private gl: WebGLRenderer;

  /** The frame context every figure reads (one object, refilled every frame). */
  private f: FrameCtx;
  private framed = false;
  // time
  private time = 0;
  private lastNow = 0;
  private lastTs = 0;
  private snap = 0;
  /** Start over asked for a snap on the next frame (the motes back on the sky at once, even from near the top). */
  private reSnap = false;
  private unRestart: () => void;
  // pointer
  private px = 0;
  private py = 0;
  private lastHX = 0;
  private lastHY = 0;
  private pSpeed = 0;
  // perf
  private keep: number;
  private keepTarget: number;
  private keepFade = 1;
  private level = 0;
  private slowFor = 0;
  private sinceReady = 0;
  private frameEma = 16.7;
  private lastFrameAt = 0;
  private dprBase = 1;
  private dprWanted = 1;
  setDpr: ((d: number) => void) | null = null;

  // scratch
  private pose: Pose = { pos: new Vector3(), target: new Vector3(), fov: 50 };
  private v1 = new Vector3();
  private css = new Vector2();
  private yours = anchor(ANCHOR.yours);

  static async create(gl: WebGLRenderer, tier: GLTier): Promise<Engine> {
    const side = SIM_SIDE[tier];
    const stars = await fetch("/data/bsc5.json")
      .then((r) => (r.ok ? (r.json() as Promise<StarFile>) : { stars: [] }))
      .catch(() => ({ stars: [] as number[] }));
    const lst = lstDeg(Date.now());
    const sky = buildSky(side, stars.stars, lst);
    const noise = bakeNoise(gl);
    return new Engine(gl, tier, sky, lst, noise);
  }

  private constructor(
    gl: WebGLRenderer,
    tier: GLTier,
    sky: ReturnType<typeof buildSky>,
    lst: number,
    noise: WebGL3DRenderTarget,
  ) {
    this.gl = gl;
    this.tier = tier;
    this.noise = noise;
    const skyM0 = skyMatrix(lst, new Matrix3());
    const tex = noise.texture as Data3DTexture;
    this.sim = new Motes(gl, SIM_SIDE[tier], sky, FLOCK_N[tier], skyM0, tex);
    this.gas = new Gas(tex, tier);
    this.cosmos = new Cosmos(tex);
    this.keep = this.sim.n;
    this.keepTarget = this.sim.n;

    this.genesis = new Genesis();
    this.system = new System();
    this.flock = new Flock();
    this.galaxy = new Galaxy();
    this.sky = new Sky(lst, skyM0);
    this.figures = [this.genesis, this.system, this.flock, this.galaxy, this.sky];

    const rig: RigCtx = {
      aspect: 1.6,
      phone: false,
      skyLook: sky.look.clone(),
      settle: 0,
      px: 0,
      py: 0,
      motion: 1,
      time: 0,
      yaw: 0,
      kick: 0,
    };
    this.f = createFrameCtx({
      U: this.sim.U,
      G: this.gas.uniforms,
      cosmos: this.cosmos,
      fxs: this.fxs,
      rig,
    });

    fx.overlay = this.fxs.overlay;
    shared.simCount = this.sim.n;
    this.unRestart = onRestart(() => this.restart());
    // the draw calls of a whole frame (the scene and every post pass), not of its last render: reset at each frame
    gl.info.autoReset = false;
    if (isQA()) {
      // QA: the engine and the ink's anchors and paths (projected, after each frame)
      (window as unknown as { __nuqta: unknown }).__nuqta = {
        hold,
        shared,
        story,
        engine: this,
        ink,
        anchors: allAnchors(),
        paths: allPaths(),
      };
    }
  }

  /** Add to the scene graph. */
  mount(scene: Scene) {
    scene.add(this.fxs.backdrop);
    scene.add(this.gas.composite);
    scene.add(this.cosmos.group);
    scene.add(this.sim.points);
    for (const fig of this.figures) fig.mount?.(scene);
  }

  unmount(scene: Scene) {
    scene.remove(this.fxs.backdrop);
    scene.remove(this.gas.composite);
    scene.remove(this.cosmos.group);
    scene.remove(this.sim.points);
    for (const fig of this.figures) fig.unmount?.(scene);
  }

  /** Save the visitor's sky as a PNG (the souvenir, figures/sky.ts). */
  capture(render: () => void): Promise<Blob | null> {
    return this.sky.capture(this.gl, render);
  }

  frame(cam: PerspectiveCamera, scene: Scene) {
    beginInk();
    this.gl.info.reset();
    const f = this.f;
    const U = this.sim.U;
    const figs = this.figures;
    const now = performance.now();
    const dtRaw = this.lastNow ? (now - this.lastNow) / 1000 : 1 / 60;
    this.lastNow = now;
    const dt = Math.min(Math.max(dtRaw, 1 / 240), 1 / 20);
    // story time saturates at the last figure; the sky reads on into the record with story.after
    const T = story.Ts + Math.min(1, Math.max(0, story.after));
    const reduce = story.reducedMotion;
    const motion = reduce ? 0 : 1;
    const read = ss(0.3, 1.25, story.after);
    this.time += dt * motion * (1 - 0.72 * read);
    const time = this.time;
    wake(250);

    // perf: rolling frame time of consecutive rendered frames
    if (this.lastFrameAt && now - this.lastFrameAt < 120)
      this.frameEma += (now - this.lastFrameAt - this.frameEma) * 0.06;
    this.lastFrameAt = now;
    fx.frameMs = this.frameEma;
    shared.fps = Math.round(1000 / Math.max(4, this.frameEma));
    this.watchdog(dt, read);

    // pointer (the DOM writes hold.*; the show damps hold.moving)
    const presence = hold.lastMove > 0 ? 1 : 0;
    hold.moving *= Math.exp(-dt * 2.6);
    const sp = Math.hypot(hold.x - this.lastHX, hold.y - this.lastHY) / dt;
    this.lastHX = hold.x;
    this.lastHY = hold.y;
    this.pSpeed = damp(this.pSpeed, sp, 10, dt);
    this.px = damp(this.px, hold.nx * presence, 2.6, dt);
    this.py = damp(this.py, hold.ny * presence, 2.6, dt);

    // jumps in story time land at once (a nav cut, a deep link, starting over); reduced motion always does
    if (Math.abs(T - this.lastTs) > 0.4 || this.reSnap) this.snap = 1;
    else if (this.snap === 1) this.snap = 2;
    else this.snap = 0;
    this.reSnap = false;
    this.lastTs = T;

    // ---- the frame context ----
    const sz = this.gl.domElement;
    const dpr = this.gl.getPixelRatio();
    f.camera = cam;
    f.dt = dt;
    f.now = now;
    f.T = T;
    f.time = time;
    f.motion = motion;
    f.reduce = reduce;
    f.snap = this.snap;
    f.snapping = reduce || this.snap === 1;
    f.read = read;
    f.presence = presence;
    f.px = this.px;
    f.py = this.py;
    f.speed = this.pSpeed;
    f.width = sz.width;
    f.height = sz.height;
    f.aspect = sz.width / Math.max(1, sz.height);
    f.dpr = dpr;
    f.vmin = Math.min(sz.width, sz.height) / dpr;

    // ---- before the camera: the bang and the collapse (genesis), the planets and the orbit drag (system) ----
    for (let i = 0; i < figs.length; i++) figs[i].pre?.(f);

    // ---- the camera ----
    const rig = f.rig;
    rig.aspect = f.aspect;
    rig.phone = f.width / dpr <= 760;
    rig.settle = f.settle;
    rig.px = this.px;
    rig.py = this.py;
    rig.motion = motion;
    rig.time = time;
    rigAt(T, rig, this.pose);
    applyRig(cam, this.pose, rig, parallaxAt(T));
    f.fwd.set(0, 0, -1).applyQuaternion(cam.quaternion);
    f.right.set(1, 0, 0).applyQuaternion(cam.quaternion);
    f.up.set(0, 1, 0).applyQuaternion(cam.quaternion);
    f.proj = sz.height / (2 * Math.tan((cam.fov * Math.PI) / 360));
    // the pointer's ray
    f.rayD.set(hold.nx, hold.ny, 0.5).unproject(cam).sub(cam.position).normalize();
    U.uRayO.value.copy(cam.position);
    U.uRayD.value.copy(f.rayD);
    U.uSnap.value = reduce ? 1 : this.snap;

    // ---- the shared timeline ----
    U.uTs.value = T;
    U.uTime.value = time;
    U.uDt.value = dt;
    U.uMotion.value = motion;
    U.uFreed.value = f.freed ? 1 : 0;

    // ---- the figures ----
    for (let i = 0; i < figs.length; i++) figs[i].frame(f);

    this.look(f);
    this.thread(f);

    // render uniforms
    U.uDpr.value = dpr;
    U.uAspect.value = f.aspect;
    U.uProj.value = f.proj;
    U.uMaxPx.value = 44 * Math.sqrt(dpr);
    U.uKeep.value = this.keep;
    U.uKeepFade.value = this.keepFade;

    // the gas, raymarched under the motes, then the sim
    this.framed = true;
    this.cosmos.frame(T, time, f.worldPx, f.vmin);
    scene.updateMatrixWorld();
    this.gas.on = this.genesis.gasOn;
    this.gas.render(this.gl, cam, sz.width / dpr, sz.height / dpr);
    this.sim.step();
    shared.simCount = Math.min(this.sim.n, Math.round(this.keepTarget));
  }

  /**
   * Start over (src/lib/restart.ts): every figure forgets the visit, and the next frame snaps, so the sim lands every
   * mote back on its place in the sky (uFreed 0, uSnap 1: sim-shaders.ts) and nothing eases back on screen.
   */
  private restart() {
    for (const fig of this.figures) fig.reset?.();
    this.reSnap = true;
    wake(1500);
  }

  /** After the frame is drawn: this frame's anchors and paths in CSS px of the canvas, for the ink. */
  project() {
    if (!this.framed) return;
    this.gl.getSize(this.css);
    projectInk(this.f.camera, this.css.x, this.css.y);
  }

  /**
   * The look across figures: space from the bang until the sky returns (genesis, sky), the desert night before and
   * after it with its warm light dome on the horizon, and the dimming while the record is read.
   */
  private look(f: FrameCtx) {
    const space = this.genesis.space * (1 - this.sky.night);
    const skyW = this.sky.on;
    f.U.uDim.value = 1 - 0.58 * f.read;
    const glow = (f.freed ? 1 - space : 0.28) * (1 - 0.6 * skyW) + 0.18 * skyW;
    const bd = this.fxs.backdropM.uniforms;
    // (the horizon's glow steps back under the record, so no bright band runs through its lines)
    bd.uGlow.value = glow * (f.freed ? f.settle * 0.8 + 0.2 : 1) * (1 - 0.75 * f.read);
    bd.uSpace.value = space;
    bd.uDim.value = 1 - 0.4 * f.read;
    fx.bloom = f.read < 0.45;
  }

  /**
   * The thread: your point's light, wherever a figure set anchor `yours` this frame (figures/thread.ts), once the sky
   * is freed (before the bang the anchor marks the hold point for the ink, and the core glow is the light). A fixed
   * size on screen; its light follows the anchor's on, and fades where a body hides it (the sprite draws over the
   * scene without depth, so the occlusion is measured here).
   */
  private thread(f: FrameCtx) {
    const a = this.yours;
    const s = this.fxs.thread;
    const p = this.v1.set(a.x, a.y, a.z);
    const I = a.stamp === ink.frame && f.freed ? a.on * (1 - f.hidden(p)) : 0;
    if (I <= 0.002) {
      s.mesh.visible = false;
      return;
    }
    const size = f.worldPx(p, THREAD_PX);
    s.m.uniforms.uCenter.value.copy(p);
    (s.m.uniforms.uSize.value as number[])[0] = size;
    (s.m.uniforms.uSize.value as number[])[1] = size;
    s.m.uniforms.uPx.value = THREAD_PX;
    s.m.uniforms.uI.value = I * THREAD_I * (f.U.uDim.value as number);
    s.mesh.visible = true;
  }

  /** Drop a tier without a pop: first DPR, then an even half of the motes (faded out) and a lighter gas, then less. */
  private watchdog(dt: number, read: number) {
    if (this.keepTarget < this.keep) {
      this.keepFade = Math.max(0, this.keepFade - dt / 0.6);
      if (this.keepFade <= 0) {
        this.keep = this.keepTarget;
        this.sim.points.geometry.setDrawRange(0, this.keep);
        this.keepFade = 1;
      }
    }
    // reading the record: the backdrop at reduced DPR
    const want = read > 0.6 ? Math.min(1, this.dprBase) : read < 0.3 ? this.dprWanted : null;
    if (want !== null && this.setDpr && Math.abs(this.gl.getPixelRatio() - want) > 0.01)
      this.setDpr(want);

    this.sinceReady += dt;
    if (!shared.ready || this.sinceReady < 3 || document.hidden || query.get("wd") === "0") return;
    if (this.frameEma > 21.5) this.slowFor += dt;
    else this.slowFor = Math.max(0, this.slowFor - dt * 2);
    if (this.slowFor < 2 || this.level >= 3) return;
    this.slowFor = 0;
    this.frameEma = 16.7;
    this.level++;
    if (this.level === 1) {
      this.dprWanted = Math.max(1, this.dprBase * 0.78);
      this.setDpr?.(this.dprWanted);
      this.gas.quality = 0.8;
    } else if (this.level === 2) {
      this.keepTarget = this.sim.n / 2;
      this.gas.quality = 0.65;
    } else {
      this.dprWanted = 1;
      this.setDpr?.(1);
      this.keepTarget = this.sim.n / 4;
      this.gas.quality = 0.5;
    }
  }

  setBaseDpr(d: number) {
    this.dprBase = d;
    this.dprWanted = d;
  }

  stats() {
    return {
      tier: this.tier,
      motes: this.sim.n,
      drawn: Math.round(this.keepTarget),
      level: this.level,
      frameMs: +this.frameEma.toFixed(2),
      fps: shared.fps,
      halfFloat: this.sim.halfFloat,
      dpr: this.gl.getPixelRatio(),
      calls: this.gl.info.render.calls,
      gas: this.gas.on ? `${this.gas.rt.width}x${this.gas.rt.height}` : "off",
    };
  }

  dispose() {
    this.unRestart();
    this.gl.info.autoReset = true;
    // the QA hooks on window belong to this engine (show.tsx sets the stats and the bench)
    const w = window as unknown as {
      __nuqta?: { engine?: unknown };
      __glStats?: unknown;
      __bench?: unknown;
    };
    if (w.__nuqta?.engine === this) delete w.__nuqta;
    delete w.__glStats;
    delete w.__bench;
    for (const fig of this.figures) fig.dispose?.();
    this.sim.dispose();
    this.fxs.dispose();
    this.gas.dispose();
    this.cosmos.dispose();
    this.noise.dispose();
    if (fx.overlay === this.fxs.overlay) fx.overlay = null;
    shared.captureSky = null;
  }
}
