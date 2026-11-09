/**
 * Fig. 9, the storm (docs/STORY.md; journey BEATS.storm front / hit / field / aurora, HINTS storm hold): a sheet of
 * fast thin streaks of charged light sweeps in from deep space on the sun's side and the city lights flicker as it
 * hits. The world's field (dipole loops about its magnetic axis, layout.ts MAG) is there from the front's arrival,
 * fading in with it over the scroll, always breathing; the storm bends round it on the day side and pours down the
 * field lines into both poles, where aurora curtains light, quiet and tall. It strengthens on its own over
 * BEATS.storm.field.
 *
 * The hold (pointer, touch or Space on the hold key; answered inside journey HOLDS.storm, most of the time the storm
 * blows) is a tug of war, never a switch: while held, the storm speeds up
 * a little (faster, a little longer, denser and brighter streaks, more of them caught and pouring in) and the field
 * pushes back harder, which is what the eye reads first (its lines tighten and brighten, most on the storm's side, which
 * presses in; the bow holds its ground and lights along its edge where the streaks are turned round it; the aurora
 * brightens, the lights stop flickering). It eases in over about 0.4 s and, on release, back to the normal level over about 1 s; the
 * storm's flow is integrated, so a change of speed never makes a streak jump. No light is ever lost.
 *
 * Three draws, owned by WorldGL (./world.ts), which calls update() once per frame inside the world's window and reads
 * back what the rest of the world needs (the flicker for the lights and the network, the aurora's glow on the ground,
 * the storm's glow in the air). Writes shared.play field / hit / push / lightsLost, anchors `storm`, `poleN`, `poleS`
 * and paths `field0..3` (the four loops of LOOPS[0..3], the same curve as the GLSL's loopPos).
 *
 * Everything is a function of story time, plus the damped push of a hold in progress.
 * Reduced motion: no hold, no flicker, the streaks, loops and curtains still (show time stands still).
 */
import {
  AdditiveBlending,
  BufferAttribute,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
  Sphere,
  Vector2,
  type Vector3,
  type Vector4,
} from "three";
import { shared } from "@/gl/shared";
import { ANCHOR, PATH, type Path, path, setAnchor, touchPath } from "@/lib/anchors";
import { hold } from "@/lib/hold";
import { F, figK, HOLDS } from "@/lib/journey";
import type { GLTier } from "@/lib/tier";
import {
  arrivalAt,
  auroraAt,
  auroraSpreadAt,
  CENTER,
  CUSP_L,
  DUSK,
  fieldRestAt,
  frontAt,
  hitAt,
  LOOPS,
  loopsOnAt,
  MAG,
  NOON,
  NOSE,
  OVAL,
  pourOnAt,
  RADIUS,
  SA,
  SB,
  STORM_DIR,
  STORM_S0,
  STORM_S1,
  ss,
  stormOnAt,
} from "./layout";
import {
  AURORA_FRAG,
  AURORA_VERT,
  FIELD_FRAG,
  FIELD_VERT,
  STORM_FRAG,
  STORM_VERT,
} from "./storm-shaders";

/** Per tier: streaks in the sheet, field loops drawn (LOOPS order), segments round each aurora oval, ray detail, curtains per pole. */
const BUDGET: Record<
  GLTier,
  { streaks: number; loops: number; oval: number; rich: number; layers: number }
> = {
  high: { streaks: 4200, loops: 14, oval: 256, rich: 1, layers: 2 },
  medium: { streaks: 2400, loops: 10, oval: 176, rich: 1, layers: 2 },
  low: { streaks: 1100, loops: 8, oval: 112, rich: 0, layers: 1 },
};
const STREAK_ROWS = 4;
const LOOP_SEG = 80;
const AURORA_ROWS = [0, 0.1, 0.28, 0.55, 1];
/** Points per ink path (the field lines field0..3). */
const INK_PTS = 48;
/**
 * Share of the streaks near the world that the field catches and pours into the poles: at rest, and the most a push
 * shows (the extra ones fly the caught path all along and only light while pushed, so none changes path mid-flight).
 */
const CAPTURE = 0.22;
const CAPTURE_PUSH = 0.35;
/** The hold's push: two damped stages each way (an S-curve, no kick): ~95% in 0.4 s, back to rest in ~1 s. */
const TAU_IN = 0.085;
const TAU_OUT = 0.21;
/** At full push the storm flows this much faster. */
const SPEED = 0.6;
/** The field lines' breath: share of their size, and its angular speed (rad/s); the same in fieldPoint and the GLSL. */
const BREATH = 0.035;
const BREATH_W = 0.9;

/** Where a hold pushes back (local k): journey HOLDS.storm, the window src/lib/hold.ts starts a hold in. */
const HOLD_WIN = [HOLDS.storm[0] - F.storm, HOLDS.storm[1] - F.storm] as const;
const FIELD_IDS = [0, 1, 2, 3].map((i) => PATH.field(i));

/** The loops' size grows faster than their light: eased field. */
const fieldEase = (f: number) => 1 - (1 - f) * (1 - f);

export class StormGL {
  readonly meshes: Mesh[];
  /** Outputs for the rest of the world this frame: the lights' flicker, the aurora's strength, the air's storm glow. */
  flick = 0;
  aurora = 0;
  airGlow = 0;
  /** This frame's levels (QA traces read them: window.__storm in dev builds). */
  readonly levels = {
    rest: 0,
    field: 0,
    push: 0,
    speed: 1,
    flow: 0,
    loops: 0,
    aurora: 0,
    flick: 0,
  };

  private streakM: ShaderMaterial;
  private loopM: ShaderMaterial;
  private auroraM: ShaderMaterial;
  private paths: Path[];
  private pts = new Float32Array(INK_PTS * 3);
  // the hold's push (two damped stages) and the storm's integrated flow (show seconds, faster while pushed)
  private pushA = 0;
  private push = 0;
  private flow = 0;

  /** band: the copy band's uniforms (./band.ts), shared objects that WorldGL writes every frame. */
  constructor(tier: GLTier, band: { uBand: { value: Vector4 }; uBandK: { value: Vector4 } }) {
    const B = BUDGET[tier];
    const shell = new Sphere(CENTER.clone(), 200);
    const frame = {
      ...band,
      uC: { value: CENTER },
      uR: { value: RADIUS },
      uAx: { value: MAG },
      uNoon: { value: NOON },
      uDusk: { value: DUSK },
      uTime: { value: 0 },
      uFlow: { value: 0 },
      uPush: { value: 0 },
      uField: { value: 0 },
      uRes: { value: new Vector2(1, 1) },
      uDpr: { value: 1 },
      uOval: { value: OVAL },
    };

    // ---- the streaks: a strip of STREAK_ROWS rows (tail to head), instanced per streak
    const sg = new InstancedBufferGeometry();
    const sp = new Float32Array(STREAK_ROWS * 2 * 3);
    for (let r = 0; r < STREAK_ROWS; r++)
      for (let k = 0; k < 2; k++) {
        sp[(r * 2 + k) * 3] = r / (STREAK_ROWS - 1);
        sp[(r * 2 + k) * 3 + 1] = k === 0 ? -1 : 1;
      }
    const si: number[] = [];
    for (let r = 0; r < STREAK_ROWS - 1; r++) {
      const a = r * 2;
      si.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    sg.setAttribute("position", new BufferAttribute(sp, 3));
    sg.setIndex(si);
    const ids = new Float32Array(B.streaks);
    for (let i = 0; i < B.streaks; i++) ids[i] = i;
    sg.setAttribute("aId", new InstancedBufferAttribute(ids, 1));
    sg.instanceCount = B.streaks;
    sg.boundingSphere = shell;
    this.streakM = new ShaderMaterial({
      uniforms: {
        ...frame,
        uD: { value: STORM_DIR },
        uSA: { value: SA },
        uSB: { value: SB },
        uFront: { value: -STORM_S0 },
        uOn: { value: 0 },
        uPourOn: { value: 0 },
        uRn: { value: RADIUS },
        uCuspL: { value: CUSP_L },
        uS0: { value: STORM_S0 },
        uS1: { value: STORM_S1 },
        uCapT: { value: CAPTURE },
        uCapMax: { value: CAPTURE_PUSH },
        uStay: { value: 0.38 },
      },
      vertexShader: STORM_VERT,
      fragmentShader: STORM_FRAG,
      side: DoubleSide,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const streaks = new Mesh(sg, this.streakM);
    streaks.renderOrder = 2.6;

    // ---- the field's loops: one ribbon, instanced per loop
    const lg = new InstancedBufferGeometry();
    const lp = new Float32Array((LOOP_SEG + 1) * 2 * 3);
    for (let i = 0; i <= LOOP_SEG; i++)
      for (let k = 0; k < 2; k++) {
        lp[(i * 2 + k) * 3] = i / LOOP_SEG;
        lp[(i * 2 + k) * 3 + 1] = k === 0 ? -1 : 1;
      }
    const li: number[] = [];
    for (let i = 0; i < LOOP_SEG; i++) {
      const a = i * 2;
      li.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    lg.setAttribute("position", new BufferAttribute(lp, 3));
    lg.setIndex(li);
    const n = Math.min(B.loops, LOOPS.length);
    const la = new Float32Array(n * 2);
    for (let i = 0; i < n; i++) la.set([LOOPS[i].L, LOOPS[i].az], i * 2);
    lg.setAttribute("aLoop", new InstancedBufferAttribute(la, 2));
    lg.instanceCount = n;
    lg.boundingSphere = shell;
    this.loopM = new ShaderMaterial({
      uniforms: {
        ...frame,
        uFe: { value: 0 },
        uOn: { value: 0 },
        uPour: { value: 0 },
        uBr: { value: BREATH },
        uBrW: { value: BREATH_W },
        uTail: { value: 0 },
        uComp: { value: 0 },
      },
      vertexShader: FIELD_VERT,
      fragmentShader: FIELD_FRAG,
      side: DoubleSide,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const loops = new Mesh(lg, this.loopM);
    loops.renderOrder = 2.2;

    // ---- the aurora: a band of AURORA_ROWS rows round the oval, instanced per pole and per curtain (a fainter one
    // just poleward of the first)
    const ag = new InstancedBufferGeometry();
    const cols = B.oval + 1;
    const ap = new Float32Array(cols * AURORA_ROWS.length * 3);
    for (let i = 0; i < cols; i++)
      for (let r = 0; r < AURORA_ROWS.length; r++) {
        const o = (i * AURORA_ROWS.length + r) * 3;
        ap[o] = i / B.oval;
        ap[o + 1] = AURORA_ROWS[r];
      }
    const ai: number[] = [];
    const R = AURORA_ROWS.length;
    for (let i = 0; i < B.oval; i++)
      for (let r = 0; r < R - 1; r++) {
        const a = i * R + r;
        const b = (i + 1) * R + r;
        ai.push(a, b, a + 1, b, b + 1, a + 1);
      }
    ag.setAttribute("position", new BufferAttribute(ap, 3));
    ag.setIndex(ai);
    ag.setAttribute("aPole", new InstancedBufferAttribute(new Float32Array([1, -1, 1, -1]), 1));
    ag.setAttribute("aLayer", new InstancedBufferAttribute(new Float32Array([0, 0, 1, 1]), 1));
    ag.instanceCount = 2 * B.layers;
    ag.boundingSphere = shell;
    this.auroraM = new ShaderMaterial({
      uniforms: { ...frame, uAur: { value: 0 }, uSpread: { value: 0 }, uRich: { value: B.rich } },
      vertexShader: AURORA_VERT,
      fragmentShader: AURORA_FRAG,
      side: DoubleSide,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: AdditiveBlending,
    });
    const aurora = new Mesh(ag, this.auroraM);
    aurora.renderOrder = 2.4;

    this.meshes = [loops, aurora, streaks];
    for (const m of this.meshes) {
      m.frustumCulled = false;
      m.visible = false;
    }
    this.paths = FIELD_IDS.map((id) => path(id, INK_PTS));
  }

  /**
   * One frame inside the world's window. `time` is the world's show time (still under reduced motion), `presence`
   * the planet's; W, H the drawing buffer in device px.
   */
  update(
    T: number,
    time: number,
    dt: number,
    reduce: boolean,
    presence: number,
    W: number,
    H: number,
    dpr: number,
    eye: Vector3,
  ) {
    const k = figK("storm", T);

    // ---- the hold: a push that eases in while held inside its window (journey HOLDS.storm, where the ring invites it
    // and the hold voice sounds), and back out to rest on release or once a scroll has left the window
    const want = !reduce && hold.pressing && k >= HOLD_WIN[0] && k <= HOLD_WIN[1] ? 1 : 0;
    const a = 1 - Math.exp(-dt / (want > 0 ? TAU_IN : TAU_OUT));
    this.pushA += (want - this.pushA) * a;
    this.push += (this.pushA - this.push) * a;
    if (want === 0 && this.push < 1e-4 && this.pushA < 1e-4) this.push = this.pushA = 0;
    const speed = 1 + SPEED * this.push;
    if (!reduce) this.flow += dt * speed;

    // ---- the field: its normal level from the storm's arrival (the scroll), pushed harder while held
    const arr = arrivalAt(T);
    const push = this.push * arr;
    const rest = fieldRestAt(T);
    // its strength against the storm (the streaks it turns, the calm of the lights, the sound): a push takes it to full
    const field = rest + (1 - rest) * push;
    // its size grows with the scroll only; a push presses the day side in and draws the night side out instead
    const fe = fieldEase(rest);
    const tail = 0.16 * rest + 0.08 * push;
    const comp = 0.1 * rest + 0.22 * push;
    const br = BREATH * (1 - 0.55 * push);
    const hit = hitAt(T);
    const on = stormOnAt(T);
    const pour = pourOnAt(T);
    const loopsOn = rest * loopsOnAt(T) * presence;
    const aur = auroraAt(T, field, push) * presence;
    const calm = ss(0.3, 1, field);
    const play = shared.play;
    play.field = field;
    play.hit = hit;
    play.push = push;
    play.lightsLost = 0;
    this.flick = reduce ? 0 : hit * (1 - calm);
    this.aurora = aur;
    this.airGlow = hit * (1 - calm) * 0.85 * presence;
    const lv = this.levels;
    lv.rest = rest;
    lv.field = field;
    lv.push = push;
    lv.speed = speed;
    lv.flow = this.flow;
    lv.loops = loopsOn;
    lv.aurora = aur;
    lv.flick = this.flick;
    // (dev: the live instance, not one a strict-mode remount threw away)
    if (process.env.NODE_ENV !== "production")
      (window as unknown as { __storm?: StormGL }).__storm = this;

    // ---- uniforms (the frame uniforms are shared objects across the three materials)
    const su = this.streakM.uniforms;
    su.uTime.value = time;
    su.uFlow.value = this.flow;
    su.uPush.value = push;
    su.uField.value = field;
    (su.uRes.value as Vector2).set(W, H);
    su.uDpr.value = dpr;
    su.uFront.value = frontAt(T);
    su.uOn.value = on * presence * (reduce ? 0.6 : 1);
    su.uPourOn.value = pour * presence * (reduce ? 0.6 : 1);
    // (pushed, the bow holds its ground: it only tightens a little, and its edge lights where the storm is turned)
    su.uRn.value = RADIUS * (NOSE[0] + (NOSE[1] - NOSE[0]) * fe) * (1 - 0.04 * push);
    su.uCapT.value = CAPTURE + (CAPTURE_PUSH - CAPTURE) * push;
    su.uStay.value = 0.38 + 0.13 * push;
    const lu = this.loopM.uniforms;
    lu.uFe.value = fe;
    lu.uOn.value = loopsOn;
    lu.uPour.value = pour * ss(0.3, 0.8, field);
    lu.uBr.value = br;
    lu.uTail.value = tail;
    lu.uComp.value = comp;
    const au = this.auroraM.uniforms;
    au.uAur.value = aur;
    au.uSpread.value = auroraSpreadAt(T, push);
    this.meshes[0].visible = loopsOn > 0.002;
    this.meshes[1].visible = aur > 0.002;
    this.meshes[2].visible = Math.max(on, pour) * presence > 0.002;

    // ---- ink: the front (on it as it comes in, then where it meets the field, upstream), the poles, the field lines
    if (on > 0.01) {
      const s = Math.min(frontAt(T), -RADIUS * 2.4);
      setAnchor(
        ANCHOR.storm,
        CENTER.x + STORM_DIR.x * s,
        CENTER.y + STORM_DIR.y * s,
        CENTER.z + STORM_DIR.z * s,
        RADIUS * 0.6,
        on,
      );
    }
    const poleOn =
      Math.max(field * 0.7, Math.min(1, aur * 1.4)) * loopsOnAt(T) * presence * ss(0.08, 0.14, k);
    if (poleOn > 0.01) {
      // over each magnetic pole; a pole turned away from the eye (the camera looks up the world at the aurora) is marked
      // where its aurora stands on the limb above it, never behind the world
      const r = RADIUS * 1.12;
      const ex = eye.x - CENTER.x;
      const ey = eye.y - CENTER.y;
      const ez = eye.z - CENTER.z;
      const el = Math.hypot(ex, ey, ez) || 1;
      for (let s = 1; s >= -1; s -= 2) {
        let px = MAG.x * s;
        let py = MAG.y * s;
        let pz = MAG.z * s;
        const away = (px * ex + py * ey + pz * ez) / el;
        if (away < 0) {
          px -= (away * ex) / el;
          py -= (away * ey) / el;
          pz -= (away * ez) / el;
          const pl = Math.hypot(px, py, pz) || 1;
          px /= pl;
          py /= pl;
          pz /= pl;
        }
        setAnchor(
          s > 0 ? ANCHOR.poleN : ANCHOR.poleS,
          CENTER.x + px * r,
          CENTER.y + py * r,
          CENTER.z + pz * r,
          RADIUS * 0.45,
          poleOn,
        );
      }
    }
    if (loopsOn > 0.01 && T < F.flock + 0.1) {
      for (let i = 0; i < 4; i++) {
        const L = LOOPS[i];
        for (let j = 0; j < INK_PTS; j++)
          fieldPoint(j / (INK_PTS - 1), L.L, L.az, fe, tail, comp, br, time, this.pts, j * 3);
        this.inkRun(this.paths[i], eye, loopsOn);
      }
    }
  }

  /**
   * The ink traces only what the eye can see of a field line: the longest stretch of this.pts not hidden behind the
   * world (from `eye`), copied into the path.
   */
  private inkRun(p: Path, eye: Vector3, on: number) {
    const w = this.pts;
    const ox = CENTER.x - eye.x;
    const oy = CENTER.y - eye.y;
    const oz = CENTER.z - eye.z;
    const oo = ox * ox + oy * oy + oz * oz;
    const R2 = RADIUS * RADIUS * 0.998;
    let best = 0;
    let bestN = 0;
    let start = 0;
    let n = 0;
    for (let j = 0; j <= INK_PTS; j++) {
      let seen = false;
      if (j < INK_PTS) {
        const dx = w[j * 3] - eye.x;
        const dy = w[j * 3 + 1] - eye.y;
        const dz = w[j * 3 + 2] - eye.z;
        const L = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const tca = (ox * dx + oy * dy + oz * dz) / Math.max(L, 1e-6);
        seen = tca <= 0 || tca >= L || oo - tca * tca >= R2;
      }
      if (seen) {
        if (n === 0) start = j;
        n++;
      } else {
        if (n > bestN) {
          bestN = n;
          best = start;
        }
        n = 0;
      }
    }
    if (bestN < 3) return;
    p.world.set(w.subarray(best * 3, (best + bestN) * 3));
    p.n = bestN;
    touchPath(p, on);
  }

  /** Start over (src/lib/restart.ts): the visitor is not pushing back. */
  reset() {
    this.push = this.pushA = 0;
    shared.play.push = 0;
  }

  /** Off (outside the world's window): nothing drawn, no push carried in. */
  hide() {
    for (const m of this.meshes) m.visible = false;
    this.push = this.pushA = 0;
    shared.play.push = 0;
    this.flick = 0;
    this.aurora = 0;
    this.airGlow = 0;
  }

  dispose() {
    for (const m of this.meshes) {
      m.geometry.dispose();
      (m.material as ShaderMaterial).dispose();
    }
  }
}

/**
 * The field line L (planet radii) at azimuth az from noon, at u in 0..1 from the north foot to the south: GLSL loopPos.
 * fe: the field's eased size; tail / comp: how far the night side is drawn out and the day side pressed in; br: the
 * breath's share at show time `time` (each loop breathes at its own phase; the feet stay on the ground).
 */
function fieldPoint(
  u: number,
  L: number,
  az: number,
  fe: number,
  tail: number,
  comp: number,
  br: number,
  time: number,
  out: Float32Array,
  o: number,
) {
  const Le =
    (1.04 + (L - 1.04) * fe) * RADIUS * (1 + br * Math.sin(time * BREATH_W + L * 3.7 + az * 0.61));
  const sf2 = Math.min(0.999, RADIUS / Le);
  const tf = Math.asin(Math.sqrt(sf2));
  const th = tf + (Math.PI - 2 * tf) * u;
  const st = Math.sin(th);
  const w = (st * st - sf2) / (1 - sf2);
  const c = Math.cos(az);
  const sa = Math.sin(az);
  const r = Le * st * st * (1 + w * (tail * Math.max(-c, 0) - comp * Math.max(c, 0)));
  const ct = Math.cos(th);
  const x = ct * MAG.x + st * (NOON.x * c + DUSK.x * sa);
  const y = ct * MAG.y + st * (NOON.y * c + DUSK.y * sa);
  const z = ct * MAG.z + st * (NOON.z * c + DUSK.z * sa);
  out[o] = CENTER.x + r * x;
  out[o + 1] = CENTER.y + r * y;
  out[o + 2] = CENTER.z + r * z;
}
