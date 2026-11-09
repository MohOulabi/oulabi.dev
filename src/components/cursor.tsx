import { soundCopy } from "@/content/site";

/**
 * The loader dot, the hold ring and the hint (docs/STORY.md, "Gestures are optional and never block"). From the first
 * frame the dot follows the pointer (the inline boot script in page.tsx moves it before hydration); its ring is the
 * real load progress. At html.gl-ready the dot hands off to the GPU field at the same pixel and the ring becomes the
 * hold ring, filled by hold.k, with a fine crosshair in the first figure. Inside a figure's hint window the ring
 * carries one verb beside it (src/bridges/show-dom.ts writes it); on touch screens it waits at the bottom centre
 * instead. At the first screen's gate it says "hold, or click, to begin", and answers each scroll attempt there (it
 * comes forward, one soft pulse).
 */
export function Cursor() {
  return (
    <div id="nq-cursor" className="cursor" aria-hidden="true" suppressHydrationWarning>
      <span className="cursor-dot" />
      {/* the first screen's gate answering a scroll attempt: one soft ring out from the hold ring (src/bridges/show-dom.ts) */}
      <span className="cursor-pulse" />
      <svg className="cursor-ring" viewBox="0 0 64 64" width="64" height="64" focusable="false">
        <path className="ring-cross" d="M32 14v7M32 43v7M14 32h7M43 32h7" />
        <circle className="ring-track" cx="32" cy="32" r="22" pathLength="100" />
        <circle
          id="nq-load"
          className="ring-load"
          cx="32"
          cy="32"
          r="22"
          pathLength="100"
          suppressHydrationWarning
        />
        <circle id="nq-hold" className="ring-hold" cx="32" cy="32" r="22" pathLength="100" />
      </svg>
      <span id="nq-hint" className="cursor-hint">
        <span className="hint-en" />
        <span className="hint-ar" lang="ar" dir="rtl" />
        {/* under the first figure's hold, until the first gesture starts the music (src/audio, html.sound-ready) */}
        <span className="hint-sound">
          <span>{soundCopy.withSound.en}</span>{" "}
          <span lang="ar" dir="rtl">
            {soundCopy.withSound.ar}
          </span>
        </span>
      </span>
    </div>
  );
}
