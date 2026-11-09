/**
 * The anchors projector (src/lib/anchors.ts): the step between the 3D universe and the ink journal over it.
 *
 * Each frame: `beginInk()` first (the core show calls it at the start of its frame, before any GL module sets an
 * anchor), then the figures and the other GL modules set the anchors and paths they own, then, once the frame is
 * drawn (show/show.tsx runs it after the post chain, so anchors set by any module's frame are in), `projectInk()` writes
 * every anchor and path stamped this frame in CSS pixels of the canvas (its CSS size, not device pixels; the canvas
 * is fixed at the viewport's top-left, so these are viewport px), with the projected radius, the view depth and the
 * live / vis flags. Anything not stamped this frame goes dark (live and vis false), so a module that stops drawing
 * never leaves stale ink behind. No allocations per frame (Map.forEach with module-level callbacks).
 */
import { Matrix4, type PerspectiveCamera } from "three";
import { type Anchor, allAnchors, allPaths, ink, type Path } from "@/lib/anchors";

/** Visible means in front of the camera and within the viewport plus this margin (fraction of each side). */
const MARGIN = 0.1;

const vp = new Matrix4();
let W = 1;
let H = 1;
let near = 0.1;
/** CSS px per world unit at unit depth (vertical), for the projected radius. */
let focal = 1;
// the projection of the last point (module scratch, so nothing allocates)
let px = 0;
let py = 0;
let pw = 0;

/** Start a frame: anchors and paths set from here on are this frame's. */
export function beginInk() {
  ink.frame++;
}

/** Project world (x, y, z) to CSS px (px, py) and view depth (pw = clip w = -view z for a perspective camera). */
function toScreen(x: number, y: number, z: number) {
  const e = vp.elements;
  const cx = e[0] * x + e[4] * y + e[8] * z + e[12];
  const cy = e[1] * x + e[5] * y + e[9] * z + e[13];
  const cw = e[3] * x + e[7] * y + e[11] * z + e[15];
  const iw = 1 / (Math.abs(cw) > 1e-6 ? cw : 1e-6);
  px = (cx * iw * 0.5 + 0.5) * W;
  py = (0.5 - cy * iw * 0.5) * H;
  pw = cw;
}

function projectAnchor(a: Anchor) {
  if (a.stamp !== ink.frame) {
    a.live = false;
    a.vis = false;
    return;
  }
  toScreen(a.x, a.y, a.z);
  a.sx = px;
  a.sy = py;
  a.depth = pw;
  a.sr = pw > near ? (a.r * focal) / pw : 0;
  a.live = true;
  a.vis =
    pw > near &&
    px >= -MARGIN * W &&
    px <= (1 + MARGIN) * W &&
    py >= -MARGIN * H &&
    py <= (1 + MARGIN) * H;
}

function projectPath(p: Path) {
  if (p.stamp !== ink.frame) {
    p.live = false;
    return;
  }
  const n = Math.min(p.n, p.max);
  const w = p.world;
  for (let i = 0; i < n; i++) {
    toScreen(w[i * 3], w[i * 3 + 1], w[i * 3 + 2]);
    p.screen[i * 2] = px;
    p.screen[i * 2 + 1] = py;
    p.front[i] = pw > near ? 1 : 0;
  }
  p.live = true;
}

/** Project every anchor and path set this frame for `camera`, whose canvas is `width` × `height` CSS px. */
export function projectInk(camera: PerspectiveCamera, width: number, height: number) {
  vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  W = Math.max(1, width);
  H = Math.max(1, height);
  near = camera.near;
  focal = camera.projectionMatrix.elements[5] * H * 0.5;
  allAnchors().forEach(projectAnchor);
  allPaths().forEach(projectPath);
  // the DOM ink draws from these positions in this same frame (src/bridges/ink.ts)
  ink.projected?.();
}
