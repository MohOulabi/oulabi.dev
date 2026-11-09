import { figures } from "@/content/site";
import { STATIONS } from "@/lib/stations";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * The side spine (docs/STORY.md, "How it is presented"): twelve ticks on the right edge, the current figure's name
 * beside its tick; on phones, a thin progress line. Each tick is an in-page link to its figure, so a click (or Enter)
 * jumps through the same scroll API as the fast lane (src/lib/scroll.ts); nothing here ever moves the page by itself.
 * src/bridges/spine.ts marks the current figure (aria-current) and draws the progress.
 */
export function Spine() {
  return (
    <nav className="spine" aria-label="Figures">
      <ol className="spine-list">
        {STATIONS.map((s, i) => {
          const f = figures[s.id];
          return (
            <li key={s.id}>
              {/* biome-ignore lint/a11y/useAnchorContent: named by its aria-label; the shown name is aria-hidden */}
              <a
                className="spine-tick"
                href={`#fig-${s.id}`}
                data-fig={i}
                aria-label={`Figure ${f.number}: ${f.title.en}`}
                aria-current={i === 0 ? "step" : undefined}
                // a press-and-drag over the marks is a gesture on the sky, never a link drag
                draggable={false}
              >
                <span className="spine-name" aria-hidden="true">
                  <span className="spine-num">{pad(f.number)}</span>
                  {f.title.en.toLowerCase()}
                </span>
                <span className="spine-mark" aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ol>
      <span className="spine-line" aria-hidden="true">
        <span className="spine-fill" />
      </span>
    </nav>
  );
}
