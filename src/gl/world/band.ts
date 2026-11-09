/**
 * The copy band (docs/STORY.md: the lines of copy are read over the universe): where the caption block sits on screen
 * (globals.css .caption: its top at 71 % of the height on a desktop, 69 % on a short one, 60 % on a phone, the figure's
 * label, then one or two lines of the serif and the Arabic under them), as a soft rectangle in drawing-buffer pixels.
 * The world's own light (its cities, the network, the hub's glow, the storm's streaks and the field's loops) steps
 * down inside it, so the copy is never read over the brightest thing on screen; the camera keeps the world above it
 * where it can (src/gl/show/poses/world.ts), this is for the close shots that cannot.
 *
 * GLSL: `bandDim()` in a fragment shader is 1 outside the band and 1 - strength inside it (feathered).
 * TS: `captionBand()` writes the two uniforms once per frame from the drawing buffer's size. No allocation.
 */
import type { Vector4 } from "three";

export const BAND = /* glsl */ `
uniform vec4 uBand;
uniform vec4 uBandK;
/** 1 outside the copy band, 1 - uBandK.z inside it, feathered by uBandK.xy (px). */
float bandDim() {
  vec2 d = abs(gl_FragCoord.xy - uBand.xy) - uBand.zw;
  float m = (1.0 - smoothstep(0.0, uBandK.x, d.x)) * (1.0 - smoothstep(0.0, uBandK.y, d.y));
  return 1.0 - uBandK.z * m;
}
`;

/** The phone layout's breakpoint (globals.css `max-width: 760px`) and the short desktop's (`max-height: 760px`). */
const NARROW = 760;
const SHORT = 760;

/**
 * Write the band for a drawing buffer of W × H device px at `dpr`, taking `strength` (0..1) of the light inside it:
 * `band` its centre (px from the bottom-left, as gl_FragCoord) and half-size, `k` its feather (px) and strength.
 */
export function captionBand(
  W: number,
  H: number,
  dpr: number,
  strength: number,
  band: Vector4,
  k: Vector4,
) {
  const cw = W / dpr;
  const ch = H / dpr;
  const phone = cw <= NARROW;
  // its top a little above the figure's label, its foot under the Arabic of a two-line sentence (CSS px)
  const top = (phone ? 0.6 : ch <= SHORT ? 0.69 : 0.71) * ch - 6;
  const foot = top + (phone ? 196 : 170);
  // the lines are centred, at most 1040 px wide (their words rarely fill it)
  const half = phone ? cw * 0.5 : Math.min(cw * 0.5, 440);
  band.set(W * 0.5, H - ((top + foot) / 2) * dpr, half * dpr, ((foot - top) / 2) * dpr);
  k.set((phone ? 60 : 190) * dpr, 80 * dpr, strength, 0);
}
