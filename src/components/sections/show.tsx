import { type CSSProperties, Fragment } from "react";
import { Ink } from "@/components/ink";
import { Spine } from "@/components/spine";
import { StillArt, StillInk } from "@/components/stills";
import { Gap } from "@/components/ui/gap";
import { StarCard } from "@/components/ui/star-card";
import { ending, figLabel, figures, firstScreen, lineRamp, site } from "@/content/site";
import { type FigureId, HINTS } from "@/lib/journey";
import { STATIONS } from "@/lib/stations";
import { Ending, EndingPrint } from "./ending";

type Vars = CSSProperties & Record<`--${string}`, string | number>;

/** Every figure's lines, in story order, with their place in the caption (data-fig, data-l). */
const LINES = STATIONS.flatMap((s, fi) =>
  figures[s.id].lines.map((l, li) => ({ fi, li, line: l })),
);

/**
 * Where a spine jump lands inside its figure (local k): where its first line is fully written, or earlier when the
 * figure's click closes before that (Fig. 7's launch: it lands inside the countdown, so the click is still there to
 * make). The first figure lands at its very top.
 */
function entryOf(id: FigureId, i: number) {
  if (i === 0) return 0;
  const line = figures[id].lines[0].win[0] + lineRamp.in;
  const click = HINTS.find((h) => h.fig === id && h.verb === "click");
  return click && click.win[1] < line ? Math.min(line, click.win[0] + 0.02) : line;
}

/**
 * The show's DOM (docs/STORY.md "How it is presented", src/lib/journey.ts): over the 3D, the ink journal (ink.tsx and
 * src/bridges/ink.ts), one fixed caption block ("fig. 5 — alignment" in small mono, the line in the serif with the
 * Arabic under it, scrubbed by story time in src/bridges/show-dom.ts), the side spine, the ending (the signature, the
 * last line, his email, "Keep your sky") and the keyboard hold; under them the scroll track: twelve figures of natural
 * scroll (data-beat markers, each Station.screens viewport heights long), the sky's followed by the ending's stretch.
 *
 * In the flow layout (reduced motion, the static tier, no JS) the same track is the journal printed: a plate per
 * figure (its still, its ink, its caption and lines), the signature, then the record.
 */
export function Show() {
  return (
    <>
      <Ink />
      <StarCard />

      <div className="caption" aria-hidden="true">
        <p className="cap-labels">
          {STATIONS.map((s, i) => (
            <Fragment key={s.id}>
              {i > 0 ? " " : null}
              <span className="cap-label" data-fig={i}>
                {figLabel(s.id)}
                <Gap />
                <span className="cap-ar" lang="ar" dir="rtl">
                  {figures[s.id].title.ar}
                </span>
              </span>
            </Fragment>
          ))}
        </p>
        {LINES.map(({ fi, li, line }) => {
          const words = line.en.split(" ");
          const late = line.late ? line.late.en.split(" ") : [];
          return (
            <p
              key={`${fi}-${li}`}
              className="line"
              data-fig={fi}
              data-l={li}
              style={{ "--n": words.length + late.length } as Vars}
            >
              <span className="line-en">
                {words.map((w, j) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed copy
                  <Fragment key={j}>
                    {j > 0 ? <Gap /> : null}
                    <span className="w" style={{ "--i": j } as Vars}>
                      {w}
                    </span>
                  </Fragment>
                ))}
                {late.map((w, j) => (
                  // only when it is really the small hours for the visitor (html.late-night)
                  // biome-ignore lint/suspicious/noArrayIndexKey: fixed copy
                  <Fragment key={`l${j}`}>
                    <Gap />
                    <span className="w late" style={{ "--i": words.length + j } as Vars}>
                      {w}
                    </span>
                  </Fragment>
                ))}
              </span>{" "}
              <span className="line-ar" lang="ar" dir="rtl">
                {line.ar}
                {line.late ? <span className="late"> {line.late.ar}</span> : null}
              </span>
            </p>
          );
        })}
      </div>

      {/* before the spine in the tab order; in it whenever a figure invites a hold (src/bridges/show-dom.ts) */}
      <button type="button" id="nq-holdkey" className="holdkey">
        {firstScreen.holdKey.point}
      </button>

      <Spine />
      <Ending />

      {/* the twelve figures' headings (h3) sit under this one, before the record's sections */}
      <h2 className="visually-hidden">{firstScreen.showTitle}</h2>
      <div className="track" id="show">
        {STATIONS.map((s, i) => {
          const fc = figures[s.id];
          const sky = s.id === "sky";
          const total = s.screens + (sky ? ending.screens : 0);
          const entry = entryOf(s.id, i);
          return (
            <section
              key={s.id}
              id={i === 0 ? "top" : undefined}
              className={`folio folio-${s.id}`}
              data-beat={i}
              style={{ "--screens": total } as Vars}
              aria-labelledby={`fig-${s.id}-h`}
            >
              <span
                className="folio-mark"
                id={`fig-${s.id}`}
                style={{ top: `${((entry * s.screens) / total) * 100}%` }}
              />
              {i === 0 ? (
                <div className="flow-title">
                  <p className="flow-name-ar" lang="ar" dir="rtl">
                    {site.nameAr}
                  </p>
                  <p className="flow-name">{site.name}</p>
                  <p className="flow-line">{firstScreen.line}</p>
                  <a className="flow-skip" href="#record">
                    {firstScreen.skip}
                    <svg
                      viewBox="0 0 12 12"
                      width="11"
                      height="11"
                      aria-hidden="true"
                      focusable="false"
                    >
                      <path
                        d="M6 1.5v8.4M2.2 6.3 6 10.1l3.8-3.8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.1"
                      />
                    </svg>
                  </a>
                </div>
              ) : null}
              <figure className="fplate">
                <div className={`still still-${s.id}`} aria-hidden="true">
                  {s.id === "flock" || s.id === "sky" ? <StillArt kind={s.id} /> : null}
                  <StillInk id={s.id} />
                </div>
                <figcaption className="fplate-cap">
                  <h3 className="fplate-label" id={`fig-${s.id}-h`}>
                    {figLabel(s.id)}{" "}
                    <span className="cap-ar" lang="ar" dir="rtl">
                      {fc.title.ar}
                    </span>
                  </h3>
                  {fc.lines.map((l) => (
                    <div key={l.en} className="fplate-line">
                      <p className="fplate-en">
                        {l.en}
                        {l.late ? <span className="late"> {l.late.en}</span> : null}
                      </p>
                      <p className="fplate-ar" lang="ar" dir="rtl">
                        {l.ar}
                        {l.late ? <span className="late"> {l.late.ar}</span> : null}
                      </p>
                    </div>
                  ))}
                </figcaption>
              </figure>
              {sky ? <EndingPrint /> : null}
            </section>
          );
        })}
      </div>
    </>
  );
}
