/**
 * The ink's hand (docs/STORY.md, "Ink style"): seeded, baked irregularity, so every mark looks drawn by a person and
 * never moves by itself. Pure functions shared by the live journal (src/bridges/ink.ts), its SVG
 * (src/components/ink.tsx) and the printed stills (src/components/stills.tsx), so the server and the client draw the
 * same lines.
 */

/** A small seeded generator (mulberry32): the same seed draws the same hand. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A stable seed from a string (FNV-1a). */
export function seedOf(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

const f3 = (v: number) => Math.round(v * 1000) / 1000;

/**
 * A pen's circle around the unit circle, as an SVG path in unit coordinates (scale it to the radius): it starts a
 * little off the line, breathes a few percent in and out, and runs past its start before the pen lifts.
 */
export function loopPath(seed: number, steps = 64) {
  const r = rng(seed);
  const a0 = r() * Math.PI * 2;
  const over = 0.22 + r() * 0.3;
  const sweep = Math.PI * 2 + over;
  const p1 = r() * 6.283;
  const p2 = r() * 6.283;
  const w1 = 0.022 + r() * 0.018;
  const w2 = 0.01 + r() * 0.012;
  // the pen ends a touch inside or outside where it began
  const drift = (r() < 0.5 ? -1 : 1) * (0.035 + r() * 0.03);
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = a0 + sweep * t;
    const rad =
      1 +
      w1 * Math.sin(2 * a + p1) +
      w2 * Math.sin(3 * a + p2) +
      drift * t * t -
      0.012 * (1 - t) ** 3;
    d += `${i === 0 ? "M" : "L"}${f3(Math.cos(a) * rad)} ${f3(Math.sin(a) * rad)}`;
  }
  return d;
}

/**
 * Smooth seeded offsets along a line, one per point (px): added at right angles to a polyline, they make a ruled
 * line look drawn. Baked once per mark; the same index always gets the same offset.
 */
export function wobble(seed: number, n: number, amp: number) {
  const r = rng(seed);
  const out = new Float32Array(n);
  const f1 = 0.21 + r() * 0.17;
  const f2 = 0.53 + r() * 0.3;
  const p1 = r() * 6.283;
  const p2 = r() * 6.283;
  for (let i = 0; i < n; i++)
    out[i] = amp * (0.7 * Math.sin(i * f1 + p1) + 0.3 * Math.sin(i * f2 + p2));
  return out;
}

/** A seeded value in [lo, hi). */
export const pick = (seed: number, lo: number, hi: number) => lo + rng(seed)() * (hi - lo);
