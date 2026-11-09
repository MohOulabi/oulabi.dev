/**
 * Shared show settings: sim sizes and the hold's input rules. The timeline is src/lib/journey.ts (F,
 * HANDOFF, BEATS).
 */
import type { GLTier } from "./tier";

/** GPGPU sim size per tier (texture side; count = side²). The live readout shows the real count. */
export const SIM_SIDE: Record<GLTier, number> = { high: 512, medium: 256, low: 128 };

/**
 * Press-and-hold: a stationary long-press (ms, px) and how long the ring takes to fill (ms). The bang has no timer: it
 * waits for the visitor's release, or their click (src/lib/hold.ts, the first screen's gate: src/lib/gate.ts).
 * At the gate a press is read generously, as a hand makes it: a press that drifts up to `settlePx` as it settles still
 * becomes the hold once it rests (the long-press counts again from where it came to rest; one that wanders further is
 * a drag), and a click or a tap may wander up to `tapPx` (a mouse or a pen) or `tapTouchPx` (a finger, about the
 * platform's own tap) and still be a click.
 */
export const HOLD = {
  longPressMs: 350,
  cancelPx: 8,
  fullMs: 1400,
  tapPx: 12,
  tapTouchPx: 16,
  settlePx: 40,
} as const;

/**
 * The click's bang (the first screen's gate: a click, a tap or a quick press of the hold key lets the light go): the
 * sky is drawn into the point over `crushMs` (to `k` of a full hold's gather), then it bursts with `fx` of the hold's
 * flash, core swell and shock ring and `kick` of its blast. Smaller than the hold's, never a lesser picture: the same
 * light, the same cloud, the same chord (src/audio/score.ts sounds it as the burst comes, after the crush).
 */
export const CLICK_BANG = { crushMs: 460, k: 0.82, fx: 0.62, kick: 0.74 } as const;
