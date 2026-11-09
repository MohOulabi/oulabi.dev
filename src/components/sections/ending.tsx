import { type CSSProperties, Fragment } from "react";
import { Gap } from "@/components/ui/gap";
import { ending, firstScreen } from "@/content/site";

type Vars = CSSProperties & Record<`--${string}`, string | number>;

/**
 * The journal is signed (docs/STORY.md, Fig. 12): محمد العلبي and Mohammad AlOulabi in the page's own fonts
 * (Alexandria, Newsreader), drawn on as an ink outline, then filled. Live, show-dom scrubs --sa/--fa (Arabic, from the
 * right) and --se/--fe (English, from the left) by scroll; printed (the flow layout), it is simply signed.
 */
function Signature() {
  return (
    <div className="sig" role="img" aria-label={`${ending.nameAr}, ${ending.nameEn}`}>
      <span className="sig-row sig-ar">
        <svg className="sig-svg" aria-hidden="true" focusable="false">
          <text x="50%" y="60%" textAnchor="middle" lang="ar" direction="rtl">
            {ending.nameAr}
          </text>
        </svg>
      </span>{" "}
      <span className="sig-row sig-en">
        <svg className="sig-svg" aria-hidden="true" focusable="false">
          <text x="50%" y="70%" textAnchor="middle">
            {ending.nameEn}
          </text>
        </svg>
      </span>
      <span className="sig-rule" aria-hidden="true" />
    </div>
  );
}

/**
 * The ending over the sky, after the last figure (staged layout): the signature, "tech manager, riyadh", the last line
 * with its Arabic, his email and the souvenir ("Keep your sky"), and under them a quiet "Start over" (the whole show
 * again from the first point: src/lib/scroll.ts startOver). Fixed over the sky and scrubbed by scroll
 * (src/bridges/show-dom.ts), then carried up with the page as the record arrives. Hidden from the keyboard until it
 * is on screen, and its links take no click, tap or Tab until they can be read (show-dom makes them inert till then).
 */
export function Ending() {
  const words = ending.line.en.split(" ");
  return (
    <section className="ending" id="nq-ending" aria-label="The journal, signed">
      <Signature />
      <p className="sig-role">{ending.role}</p>
      <p className="end-line" style={{ "--n": words.length } as Vars}>
        <span className="end-en">
          {words.map((w, j) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed copy
            <Fragment key={j}>
              {j > 0 ? <Gap /> : null}
              <span className="w" style={{ "--i": j } as Vars}>
                {w}
              </span>
            </Fragment>
          ))}
        </span>{" "}
        <span className="end-ar" lang="ar" dir="rtl">
          {ending.line.ar}
        </span>
      </p>
      <div className="end-actions">
        <a className="end-email" href={`mailto:${ending.email}`}>
          {ending.email}
        </a>
        <div className="keep" id="nq-keep-wrap">
          <button type="button" id="nq-keep" className="keep-button">
            <svg viewBox="0 0 14 14" width="13" height="13" aria-hidden="true" focusable="false">
              <path
                d="M7 1.2 8.2 5.8 12.8 7 8.2 8.2 7 12.8 5.8 8.2 1.2 7 5.8 5.8Z"
                fill="currentColor"
              />
            </svg>
            <span>{firstScreen.keepSky}</span>
          </button>
          <span id="nq-keep-status" className="keep-status" role="status" />
        </div>
      </div>
      {/* back to the first point, the light in the sky again (src/lib/scroll.ts startOver) */}
      <p className="end-again">
        <a href="#top" data-restart>
          <span className="end-again-dot" aria-hidden="true" />
          <span>{ending.again.en}</span>{" "}
          <span className="end-again-ar" lang="ar" dir="rtl">
            {ending.again.ar}
          </span>
        </a>
      </p>
    </section>
  );
}

/** The ending as printed at the foot of the journal (flow layout: reduced motion, the static tier, no JS). */
export function EndingPrint() {
  return (
    <div className="ending-print">
      <Signature />
      <p className="sig-role">{ending.role}</p>
      <p className="end-en">{ending.line.en}</p>
      <p className="end-ar" lang="ar" dir="rtl">
        {ending.line.ar}
      </p>
      <p className="end-actions">
        <a className="end-email" href={`mailto:${ending.email}`}>
          {ending.email}
        </a>
      </p>
    </div>
  );
}
