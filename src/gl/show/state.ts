import type { Scene } from "three";

/** Mutable per-frame state between the show (src/gl/show/show.tsx) and the post chain (src/gl/post/effects.tsx). */
export const fx = {
  /** Sprites drawn after the trails and before the bloom: the core glow, the flash, the shock ring, your point. */
  overlay: null as Scene | null,
  /** Star trails (fig. 12): 0..1 mix of the long exposure into the frame, and the per-frame decay. */
  trail: 0,
  trailDecay: 0,
  /** Drop the exposure (the camera moved). */
  trailReset: false,
  /** The pole on screen (uv), this frame's screen-space turn (rad) and the horizon (uv y): in-between samples. */
  trailPole: [0.5, 0.8] as [number, number],
  trailTurn: 0,
  trailHorizon: 0,
  aspect: 1.6,
  /** Bloom on/off (off while the record is read). */
  bloom: true,
  /** Clamp of the light going into the bloom (scene-linear). */
  maxLum: 14,
  /** Rolling frame time (ms) of rendered frames, and whether frames are consecutive. */
  frameMs: 16.7,
};
