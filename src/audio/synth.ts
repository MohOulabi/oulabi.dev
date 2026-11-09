/**
 * Building blocks of the score (./score.ts): equal temperament, the instruments' wavetables, the strings' swell
 * shape, the generated reverb impulse, smooth curves over story time and the AudioParam writer that only speaks when a
 * value changes. Everything here is built once, in idle time; nothing allocates per frame.
 */

import { smooth } from "@/lib/math";

/** MIDI note → Hz, equal temperament (A4 = 440). */
export const hz = (m: number) => 440 * 2 ** ((m - 69) / 12);

/** Smoothstep of x between a and b. */
const ss = (a: number, b: number, x: number) => smooth((x - a) / (b - a));

/** Decibels → amplitude. */
export const db = (x: number) => 10 ** (x / 20);

/**
 * A curve over story position P: flat pairs [P0, v0, P1, v1, ...] (P ascending), eased between keys, held at the
 * ends. A linear scan with no allocation.
 */
export function curve(keys: readonly number[], P: number) {
  if (P <= keys[0]) return keys[1];
  const n = keys.length;
  if (P >= keys[n - 2]) return keys[n - 1];
  for (let i = 2; i < n; i += 2) {
    if (P < keys[i]) {
      const a = keys[i - 2];
      const t = smooth((P - a) / (keys[i] - a));
      return keys[i - 1] + (keys[i + 1] - keys[i - 1]) * t;
    }
  }
  return keys[n - 1];
}

/**
 * Writes one AudioParam: a glide (setTargetAtTime) only when the value moved more than `eps` (absolute, or relative
 * for frequencies) since the last write, so a still scene sends nothing to the audio thread.
 */
export class Knob {
  private last = Number.NaN;
  constructor(
    readonly param: AudioParam,
    private readonly eps: number,
    private readonly rel = false,
  ) {}

  set(v: number, t: number, tc: number) {
    // (the first write always goes through: |v - NaN| is NaN, and NaN <= x is false)
    const d = Math.abs(v - this.last);
    if (d <= (this.rel ? this.eps * Math.abs(v) : this.eps)) return;
    this.last = v;
    this.param.setTargetAtTime(v, t, tc);
  }

  /** Jump there now (only while the master is silent: the first step after the sound starts). */
  snap(v: number, t: number) {
    this.last = v;
    this.param.cancelScheduledValues(t);
    this.param.setValueAtTime(v, t);
  }
}

/** A soft wavetable: harmonic n at amplitude amps[n - 1] (sine phase). Band-limited by construction, never buzzy. */
export function wave(ctx: BaseAudioContext, amps: readonly number[]) {
  const real = new Float32Array(amps.length + 1);
  const imag = new Float32Array(amps.length + 1);
  for (let i = 0; i < amps.length; i++) imag[i + 1] = amps[i];
  return ctx.createPeriodicWave(real, imag);
}

/** A plucked gut string: a bright start that a closing low-pass turns round (the pizzicato's harmonics). */
export const PIZZ_WAVE = [1, 0.62, 0.42, 0.3, 0.21, 0.15, 0.1, 0.07, 0.05, 0.035];
/** A bowed string section: a rounded saw (1/n, the 2nd-4th a touch forward), always heard through a low-pass. */
export const STR_WAVE = Array.from(
  { length: 16 },
  (_, i) => (i >= 1 && i <= 3 ? 1.2 : 1) / (i + 1) ** 1.05,
);
/** The low bowed string: a warm fundamental, a few soft harmonics. */
export const BASS_WAVE = [1, 0.45, 0.26, 0.13, 0.07, 0.04];

/**
 * The strings' swell inside one chord: 0 → 1 → 0 over the chord, rising to its crest at `crest` (0..1) on a sine²
 * and falling on a cosine², so it starts and ends at rest (never a step, never held across the change). Above -20 dB
 * of its crest for 0.795 of the chord.
 */
export function swellCurve(n: number, crest: number) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    c[i] =
      x < crest
        ? Math.sin((Math.PI / 2) * (x / crest)) ** 2
        : Math.cos((Math.PI / 2) * ((x - crest) / (1 - crest))) ** 2;
  }
  return c;
}

/** A short mono buffer of white noise (seeded, uniform in [-1, 1]): the harp's finger, a few ms at a time. */
export function noise(ctx: BaseAudioContext, seconds: number) {
  const n = Math.max(1, Math.floor(ctx.sampleRate * seconds));
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let seed = 0x2f6b4a1d;
  for (let i = 0; i < n; i++) {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    d[i] = ((seed >>> 0) / 4294967296) * 2 - 1;
  }
  return buf;
}

/**
 * The room: a stereo impulse of decaying noise (RT60 `rt` seconds) through two one-pole low-passes whose cutoff falls
 * with time (about 3.6 kHz at the start, 400 Hz in the tail: a soft, dark hall), a short pre-delay and a soft onset so
 * the tail never starts with a crack. Seeded: the same room on every visit.
 */
export function impulse(ctx: BaseAudioContext, seconds: number, rt: number) {
  const sr = ctx.sampleRate;
  const n = Math.floor(sr * seconds);
  const pre = Math.floor(sr * 0.028);
  const buf = ctx.createBuffer(2, n, sr);
  let seed = 0x1b873593;
  const rnd = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) / 4294967296) * 2 - 1;
  };
  const tau = rt / 6.91;
  // the two exponentials as per-sample factors (the same curves as exp(-t / tau), at a fraction of the cost)
  const kEnv = Math.exp(-1 / (sr * tau));
  const kAir = Math.exp(-1 / (sr * rt * 0.22));
  const onset = Math.floor(sr * 0.03);
  const tail = n - Math.floor(sr * 0.5);
  const sc = 48000 / sr;
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let y = 0;
    let y2 = 0;
    let env = 1;
    let air = 1;
    for (let i = pre; i < n; i++) {
      const j = i - pre;
      let g = env;
      if (j < onset) g *= j / onset;
      if (i > tail) g *= 1 - ss(tail, n, i);
      // darker as it decays (air absorbs the highs first)
      const a = (0.4 * air + 0.05) * sc;
      y += a * (rnd() - y);
      y2 += a * (y - y2);
      d[i] = y2 * g;
      env *= kEnv;
      air *= kAir;
    }
  }
  return buf;
}
