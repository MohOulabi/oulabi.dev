import { addFrame } from "@/lib/clock";
import { hold } from "@/lib/hold";
import { BEATS, F, FIGURE_COUNT } from "@/lib/journey";
import { story } from "@/lib/story";

/**
 * The side spine's live state (src/components/spine.tsx): which figure is current (aria-current="step" on its tick,
 * the ticks before it marked as read) and the progress line on phones. It only reads story time; the ticks are plain
 * in-page links handled by src/lib/scroll.ts, so the page moves only when the visitor activates one.
 */
export function startSpine() {
  const nav = document.querySelector<HTMLElement>(".spine");
  if (!nav) return () => undefined;
  const ticks = Array.from(nav.querySelectorAll<HTMLAnchorElement>(".spine-tick"));
  const fill = nav.querySelector<HTMLElement>(".spine-fill");
  let cur = -1;
  let lastP = -1;
  let shown = false;

  const unFrame = addFrame(() => {
    const P = story.Ts + story.after;
    const i = Math.min(FIGURE_COUNT - 1, Math.max(0, Math.floor(P)));
    if (i !== cur) {
      cur = i;
      for (let j = 0; j < ticks.length; j++) {
        if (j === i) ticks[j].setAttribute("aria-current", "step");
        else ticks[j].removeAttribute("aria-current");
        ticks[j].classList.toggle("read", j < i);
      }
    }
    // the line fills through the twelve figures (the ending counts as the last)
    const prog = Math.min(1, Math.max(0, P / FIGURE_COUNT));
    if (fill && Math.abs(prog - lastP) > 0.0005) {
      lastP = prog;
      fill.style.transform = `scaleY(${prog.toFixed(4)})`;
    }
    // it arrives with the first light let go (the first screen stays the name, the line and the hold)
    const on = hold.bangAt >= 0 || P > F.point + BEATS.point.yours[0];
    if (on !== shown) {
      shown = on;
      nav.classList.toggle("on", on);
    }
  }, 7);

  return () => {
    unFrame();
  };
}
