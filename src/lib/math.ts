/** Small math helpers shared by the frame loops. Plain functions: nothing here allocates. */

/** x held to 0..1 (NaN passes through). */
export const clamp01 = (x: number) => (x < 0 ? 0 : Math.min(x, 1));

/** Smoothstep from 0 to 1: x held to 0..1, then eased in and out (3t² - 2t³). */
export const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
