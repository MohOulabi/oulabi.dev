import { loopPath, seedOf } from "@/bridges/ink-geom";
import { INK } from "@/content/ink";

/**
 * The ink journal's page (docs/STORY.md, "A journal over the universe"): one fixed SVG over the 3D, pointer-events none
 * and hidden from assistive tech (the figures' copy carries the meaning). One group per mark of src/content/ink.ts,
 * rendered once; src/bridges/ink.ts places, draws and fades them every frame. A circle's loop is baked here in unit
 * space (scaled to its body by a transform); every other line is written by the engine.
 */
export function Ink() {
  return (
    <svg id="nq-ink" className="ink" aria-hidden="true" focusable="false">
      <defs>
        {/* a soft breath of night under the words, so they read over a bright body without an outline */}
        <filter
          id="ink-halo"
          x="-10%"
          y="-80%"
          width="120%"
          height="260%"
          colorInterpolationFilters="sRGB"
        >
          <feMorphology in="SourceAlpha" operator="dilate" radius="0.8" result="spread" />
          <feGaussianBlur in="spread" stdDeviation="2.4" result="soft" />
          <feFlood floodColor="#06070b" floodOpacity="0.78" />
          <feComposite in2="soft" operator="in" result="halo" />
          <feMerge>
            <feMergeNode in="halo" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {/* (empty: nothing draws into it; kept so the shipped markup stays as it is) */}
      <g className="ink-bodies" />
      {INK.map((it, i) => {
        const seed = seedOf(`${it.fig}:${i}`);
        const words = it.kind === "ticks" ? (it.flybys ? 6 : (it.at?.length ?? 0)) : 0;
        const hasText = "text" in it && it.text !== undefined && it.kind !== "ticks";
        const cls = `ink-mark ink-${it.kind}${it.gold ? " ink-gold" : ""}${it.fine ? " ink-fine" : ""}${
          (it.kind === "path" && it.dash) || it.kind === "tether" ? " ink-dash" : ""
        }`;
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed list, its index is the engine's binding
          <g key={i} className={cls} data-ink={i} style={{ opacity: 0, visibility: "hidden" }}>
            {it.kind === "circle" ? (
              <path className="ink-s" d={loopPath(seed)} pathLength={1} />
            ) : (
              <path className="ink-s" />
            )}
            {hasText ? <text className="ink-t" /> : null}
            {Array.from({ length: words }, (_, j) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: one word per tick
              <text key={j} className="ink-tt" />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
