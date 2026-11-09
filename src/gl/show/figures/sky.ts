/**
 * The sky (docs/STORY.md fig. 12): from journey HANDOFF.SKY_FROM everything flows back into the real sky over Riyadh
 * tonight and space turns back into the desert night; the drag wheels the sky about the celestial pole and it coasts
 * back to a slow sidereal drift; the long exposure opens once it has settled (star trails, by the post chain:
 * fx.trail*); the visitor's point is one of the stars, saved at the first visit's bang (localStorage; a later bang
 * replaces it only when the visitor made it with a real hold), so it is still there on a return visit; "Keep your
 * sky" saves the frame as a PNG. The rest view (skyPitch) keeps the horizon just above the lines of copy.
 *
 * Writes anchor `yours` (your point among the stars) while the sky is in (./thread.ts); the engine draws the thread
 * sprite there. Adds its faint share to the pointer's lens (genesis writes the hold's share first).
 */
import { Matrix3, Vector3, type WebGLRenderer } from "three";
import { site } from "@/content/site";
import { ANCHOR, setAnchor } from "@/lib/anchors";
import { hold } from "@/lib/hold";
import { BEATS, F, HANDOFF } from "@/lib/journey";
import { story } from "@/lib/story";
import { LAT as LAT_DEG, LS_POINT, OBSERVER } from "../constants";
import { damp, type Figure, type FrameCtx, ss, type Win } from "../frame";
import { eqVec, POLE, setGalaxyFrame, skyMatrix, worldToRaDec } from "../sky";
import { fx } from "../state";
import { Drag } from "./drag";
import { FLOCK_T } from "./flock";

/**
 * The fall home (fig. 12): from journey HANDOFF.SKY_FROM the camera falls from the galaxy back into our star and on
 * to the observer (poses/finale.ts descentPose); it lands a little into the figure, so the fall is one calm move.
 */
const DESCENT: Win = [HANDOFF.SKY_FROM, F.sky + 0.1];
const DL = DESCENT[1] - DESCENT[0];

/** Story times the sky owns. glsl/timeline.ts writes the returns into GLSL; the rig (camera.ts) reads the descent. */
export const SKY_T = {
  descent: DESCENT,
  /**
   * Everything settles into the sky once the eye is home (the last quarter of the fall): the galaxy's motes slide
   * along their lines of sight into their places (the Milky Way, the stars), unseen from here; the rest fades in.
   */
  returnFlock: [DESCENT[0] + 0.74 * DL, DESCENT[1] - 0.004] as Win,
  returnAll: [DESCENT[0] + 0.74 * DL, DESCENT[1] - 0.004] as Win,
  /** The sky comes in: the trails, the lens's faint share; your point rises from our star to its place among them. */
  in: [DESCENT[0] + 0.7 * DL, DESCENT[1]] as Win,
  rise: [DESCENT[0] + 0.72 * DL, DESCENT[1] + 0.03] as Win,
  /**
   * Hidden motes wait, unseen, at their own place in the sky from here (the rest of genesis, parked since the dive;
   * the flock's from the end of its land), so the return is the sky fading in where it belongs, not a flight.
   */
  waitFrom: F.storm,
  waitFlockFrom: FLOCK_T.land[1] + 0.02,
  /** Space turns back into the desert night (the engine's look) as the eye comes home. */
  night: [DESCENT[0] + 0.62 * DL, DESCENT[1] - 0.01] as Win,
  /** The sky takes drags from here on (journey HINTS sky drag). */
  dragFrom: DESCENT[1] - 0.03,
  /** The long exposure may open once the sky has settled (BEATS.sky.settle) and the eye is home. */
  settled: Math.max(F.sky + BEATS.sky.settle[0], DESCENT[1]) - 0.005,
};

/**
 * The sky's rest view once the eye is home (poses/finale.ts polePose reads it: from OBSERVER, looking north, pitched
 * up toward the pole). Its pitch puts the horizon just above the lines of copy (HORIZON: the fraction of the height
 * from the top, on a desktop and on a phone, whose copy sits higher), so the copy is read over the dark land and the
 * sky has the rest; its vertical fov keeps a horizontal one of 70° (the rig's fovFor(62, 70), capped at 92°).
 */
const SKY_FOV = [62, 70] as const;
const HORIZON = [0.655, 0.545] as const;

/** The rest view's vertical fov (deg) for a screen's aspect. */
export function skyFov(aspect: number) {
  const need = 2 * Math.atan(Math.tan((SKY_FOV[1] * Math.PI) / 360) / aspect) * (180 / Math.PI);
  return Math.min(Math.max(SKY_FOV[0], need), 92);
}

/** The rest view's pitch above the horizon (rad) for a screen's aspect. */
export function skyPitch(aspect: number) {
  const narrow = 1 - Math.min(1, Math.max(0, (aspect - 0.7) / 0.6));
  const hz = HORIZON[0] + (HORIZON[1] - HORIZON[0]) * narrow;
  return Math.atan((2 * hz - 1) * Math.tan((skyFov(aspect) * Math.PI) / 360));
}

/**
 * The bang happens out in space (fig. 1), so its direction from the observer means nothing here: the visitor's star
 * is kept where the press was on screen, seen from the rest view, so it comes back in fig. 12 where the finger was
 * (kept clear of the page's edges, and above the horizon lights).
 */
const MIN_ALT = (6 * Math.PI) / 180;
/**
 * How far the sky may turn over one decay of the exposure (rad): a drag paints long arcs, not whole rings. (A bright
 * star's trail shows for several decays, so an uncapped fast drag stacked full rings into a bright vortex that took
 * seconds to clear.)
 */
const TRAIL_ARC = 0.5;

export class Sky implements Figure {
  /** How far the sky is in, and how far space has turned back into night, 0..1 (the engine's look reads both). */
  on = 0;
  night = 0;

  private lst: number;
  private skyM0T = new Matrix3();
  private drag: Drag;
  private dragLive = false;
  private wheel = 0;
  private omega = 0;
  private settled = 0;
  private myPoint: [number, number] | null = null;
  private m3 = new Matrix3();
  private v1 = new Vector3();
  private v3 = new Vector3();
  private obs = new Vector3(...OBSERVER);

  /** lst: local sidereal time of the visit (deg); skyM0: the sky's rest rotation the sim was built with. */
  constructor(lst: number, skyM0: Matrix3) {
    this.lst = lst;
    this.skyM0T.copy(skyM0).transpose();
    // the galaxy of fig. 11 stands in the real galactic frame of tonight's sky
    setGalaxyFrame(skyM0);
    this.drag = new Drag(() => this.dragLive);
    // the visitor's point from an earlier visit
    try {
      const s = localStorage.getItem(LS_POINT);
      if (s) {
        const o = JSON.parse(s) as { ra: number; dec: number };
        if (Number.isFinite(o.ra) && Number.isFinite(o.dec)) this.myPoint = [o.ra, o.dec];
      }
    } catch {
      // storage blocked
    }
  }

  /**
   * Start over (src/lib/restart.ts): the sky unturned and the long exposure closed. The visitor's star keeps its rule
   * (LS_POINT): the next bang replaces it only if the visitor makes it with a real hold.
   */
  reset() {
    this.drag.release();
    this.dragLive = false;
    this.wheel = 0;
    this.omega = 0;
    this.settled = 0;
    fx.trailReset = true;
  }

  frame(f: FrameCtx) {
    const { U, T, dt, motion } = f;
    const cam = f.camera;
    if (f.bangNow) this.bang(f.aspect);
    const on = ss(SKY_T.in[0], SKY_T.in[1], T);
    this.on = on;
    this.night = ss(SKY_T.night[0], SKY_T.night[1], T);
    // the lens lingers faintly over the sky
    U.uLensE.value += 0.014 * on * f.presence * (f.reduce ? 0 : 1);

    // the drag wheels the sky; it coasts after release, back to a slow sidereal drift
    const live = T > SKY_T.dragFrom;
    this.dragLive = live;
    if (!live) this.drag.release();
    const w = Math.max(1, window.innerWidth);
    if (this.drag.dragging && live) {
      const target = (this.drag.v / w) * Math.PI * 0.9;
      this.omega = damp(this.omega, target, 9, dt);
      this.drag.v *= Math.exp(-dt * 6);
    } else {
      this.omega = damp(this.omega, 0.045 * motion, 0.7, dt);
    }
    this.omega = Math.max(-0.9, Math.min(0.9, this.omega));
    const prevWheel = this.wheel;
    this.wheel += this.omega * dt * motion * (live ? 1 : 0);
    if (!live && on <= 0) this.wheel = damp(this.wheel, 0, 1.5, dt);
    skyMatrix(this.lst + (this.wheel * 180) / Math.PI, this.m3);
    (U.uWheel.value as Matrix3).multiplyMatrices(this.m3, this.skyM0T);

    // where the pole is on screen, and how far the sky turned there this frame (for the trail in-betweens)
    if (f.snap === 1) fx.trailReset = true;
    const O = this.obs;
    this.v1.copy(POLE).multiplyScalar(100).add(O).project(cam);
    const px = this.v1.x;
    const py = this.v1.y;
    fx.trailPole[0] = px * 0.5 + 0.5;
    fx.trailPole[1] = py * 0.5 + 0.5;
    fx.aspect = f.aspect;
    // a test star 30° from the pole, at the previous and the current turn
    this.v3.set(
      0,
      Math.sin((LAT_DEG - 30) * (Math.PI / 180)),
      -Math.cos((LAT_DEG - 30) * (Math.PI / 180)),
    );
    this.v1
      .copy(this.v3)
      .applyAxisAngle(POLE, this.wheel - prevWheel)
      .multiplyScalar(100)
      .add(O)
      .project(cam);
    const a0 = Math.atan2(this.v1.y - py, (this.v1.x - px) * f.aspect);
    this.v1.copy(this.v3).multiplyScalar(100).add(O).project(cam);
    const a1 = Math.atan2(this.v1.y - py, (this.v1.x - px) * f.aspect);
    let turn = a1 - a0;
    if (turn > Math.PI) turn -= 2 * Math.PI;
    if (turn < -Math.PI) turn += 2 * Math.PI;
    fx.trailTurn = turn;
    this.v1.set(f.fwd.x, 0, f.fwd.z).normalize().multiplyScalar(200).add(O).project(cam);
    fx.trailHorizon = this.v1.y * 0.5 + 0.5 + 0.004;

    // long exposure: drag speed sets how long the trails stay; the exposure opens once the sky has settled
    if (T >= SKY_T.settled && Math.abs(story.vTs) < 0.03 && f.snap === 0) this.settled += dt;
    else this.settled = 0;
    const open = ss(1.4, 3.0, this.settled);
    const spin = Math.abs(this.omega);
    const tau = Math.min(0.9 + 7.5 * ss(0.04, 0.9, spin), TRAIL_ARC / Math.max(spin, 1e-3)) * open;
    fx.trail = on * motion * open;
    fx.trailDecay = tau > 0.02 ? Math.exp(-dt / tau) : 0;
    if (open <= 0) fx.trailReset = true;

    // your point, the one star that stays sharp (it fades under the horizon): our star, the one it had become, has
    // come home with the eye (figures/galaxy.ts hands the thread over here, at the observer's place); ahead of the
    // eye it rises out to its own place among the stars
    if (T >= SKY_T.rise[0]) {
      const k = ss(SKY_T.rise[0], SKY_T.rise[1], T);
      if (this.myPoint) {
        const d = eqVec(this.myPoint[0], this.myPoint[1], this.v1).applyMatrix3(this.m3);
        const up = d.y;
        d.multiplyScalar(170 * k).add(O);
        setAnchor(ANCHOR.yours, d.x, d.y, d.z, 0, Math.max(1 - k, ss(-0.012, 0.035, up)));
      } else {
        // no star saved (storage blocked): the thread goes out ahead of the eye
        this.v1
          .set(0, Math.sin(0.236), -Math.cos(0.236))
          .multiplyScalar(60 * k + 1)
          .add(O);
        setAnchor(ANCHOR.yours, this.v1.x, this.v1.y, this.v1.z, 0, 1 - k);
      }
    }
  }

  /**
   * The visitor's star for this bang. A return visit keeps the star of the first one (docs/STORY.md: it is still
   * there): only a bang the visitor made with their own gesture (a real hold, or the first screen's click; not a quiet
   * one, an arrival, nor a scroll on without one) places a new one; with nothing stored yet, any bang does.
   */
  private bang(aspect: number) {
    const held =
      hold.click ||
      (hold.kRelease > 0 && hold.releaseAt >= 0 && Math.abs(hold.bangAt - hold.releaseAt) < 100);
    if (this.myPoint && !held) return;
    this.savePoint(hold.bx, hold.by, aspect);
  }

  /**
   * Keep the bang's place on screen (NDC) as the visitor's star, through the sky's rest view (skyFov, skyPitch):
   * RA/Dec, so it rises and sets with the real sky on a return visit.
   */
  private savePoint(nx: number, ny: number, aspect: number) {
    const t = Math.tan((skyFov(aspect) * Math.PI) / 360);
    const x = Math.min(0.75, Math.max(-0.8, nx)) * t * aspect;
    const y = Math.min(0.7, Math.max(-1, ny)) * t;
    const pitch = skyPitch(aspect);
    const c = Math.cos(pitch);
    const s = Math.sin(pitch);
    // forward (0, s, -c), right (1, 0, 0), up (0, c, s)
    const d = this.v1.set(x, s + y * c, -c + y * s).normalize();
    if (d.y < Math.sin(MIN_ALT)) {
      const h = Math.cos(MIN_ALT) / Math.max(1e-6, Math.hypot(d.x, d.z));
      d.set(d.x * h, Math.sin(MIN_ALT), d.z * h);
    }
    const [ra, dec] = worldToRaDec(d, this.lst);
    this.myPoint = [ra, dec];
    try {
      localStorage.setItem(
        LS_POINT,
        JSON.stringify({ ra: +ra.toFixed(3), dec: +dec.toFixed(3), t: Date.now() }),
      );
    } catch {
      // storage blocked: the star still shines for this visit
    }
  }

  /** Save the visitor's sky as a PNG (the souvenir): the frame as it is, with a quiet caption. */
  capture(gl: WebGLRenderer, render: () => void): Promise<Blob | null> {
    return new Promise((resolve) => {
      try {
        render();
        const src = gl.domElement;
        const c = document.createElement("canvas");
        c.width = src.width;
        c.height = src.height;
        const ctx = c.getContext("2d");
        if (!ctx) {
          src.toBlob((b) => resolve(b), "image/png");
          return;
        }
        // same task as the render, so the drawing buffer still holds the frame
        ctx.drawImage(src, 0, 0);
        const css = getComputedStyle(document.documentElement);
        const en = css.getPropertyValue("--font-archivo").trim() || "system-ui, sans-serif";
        const ar = css.getPropertyValue("--font-alexandria").trim() || "sans-serif";
        const u = c.height / 900;
        const pad = 40 * u;
        let date = "";
        try {
          date = new Intl.DateTimeFormat("en-GB", {
            day: "numeric",
            month: "long",
            year: "numeric",
          }).format(new Date());
        } catch {
          date = new Date().toDateString();
        }
        ctx.fillStyle = "rgba(238, 242, 248, 0.78)";
        ctx.textBaseline = "alphabetic";
        ctx.font = `400 ${15 * u}px ${en}`;
        ctx.fillText(`The sky over ${site.city}, ${date}`, pad, c.height - pad);
        ctx.fillStyle = "rgba(233, 184, 102, 0.9)";
        ctx.font = `500 ${15 * u}px ${en}`;
        ctx.textAlign = "right";
        ctx.fillText(site.name, c.width - pad, c.height - pad);
        ctx.font = `500 ${17 * u}px ${ar}`;
        ctx.direction = "rtl";
        ctx.fillText(site.nameAr, c.width - pad, c.height - pad - 26 * u);
        c.toBlob((b) => resolve(b), "image/png");
      } catch {
        resolve(null);
      }
    });
  }

  dispose() {
    this.drag.dispose();
  }
}
