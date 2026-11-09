import { Fragment } from "react";
import { CVButton } from "@/components/ui/cv-button";
import { MotionToggle } from "@/components/ui/motion-toggle";
import { RiyadhTime } from "@/components/ui/riyadh-time";
import {
  aka,
  career,
  cv,
  finePrint,
  projects,
  proof,
  record,
  site,
  skills,
  work,
} from "@/content/site";

const Arrow = () => (
  <svg
    className="arrow"
    viewBox="0 0 10 10"
    width="10"
    height="10"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M2.5 7.5 7.5 2.5M3.4 2.5h4.1v4.1" fill="none" stroke="currentColor" strokeWidth="1" />
  </svg>
);

const pad = (n: number) => String(n).padStart(2, "0");

/** "A, b (c, d), e" → ["A", "B (c, d)", "E"]: split on top-level commas, capitalise each item. */
function items(list: string) {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of list) {
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out.map((s) => s.charAt(0).toUpperCase() + s.slice(1));
}

function Head({
  num,
  label,
  title,
  id,
}: {
  num: number;
  label: string;
  title: string;
  id: string;
}) {
  return (
    <header className="sec-head" data-reveal>
      <p className="sec-label">
        <span className="sec-num">{pad(num)}</span>
        <span>{label}</span>
      </p>
      <h2 id={id} className="sec-title" tabIndex={-1} data-jump-focus>
        {title}
      </h2>
    </header>
  );
}

/**
 * The record (docs/STORY.md, "Then the record"): after the show, a calm editorial page in normal flow over the dimmed
 * sky. Every fact comes from src/content/site.ts. No boxes: type, space, hairlines and the real screenshots of the
 * platforms. Fig. 11's platform stars land here (`work-<slug>`, the also-shipped row by `data-star`).
 */
export function Record() {
  return (
    <main id="record" className="record" tabIndex={-1}>
      <section className="rec-open" aria-labelledby="rec-open-h">
        <p className="rec-kicker" data-reveal>
          <span className="kicker-dot" aria-hidden="true" />
          {site.name}{" "}
          <span className="kicker-ar" lang="ar" dir="rtl">
            {site.nameAr}
          </span>
        </p>
        <h2 id="rec-open-h" className="opener" tabIndex={-1} data-jump-focus data-reveal>
          {record.opener.map((l, i) => (
            <Fragment key={l}>
              {i > 0 ? " " : null}
              <span className="opener-line">{l}</span>
            </Fragment>
          ))}
        </h2>
        <p className="intro" data-reveal>
          {record.intro}
        </p>
        <ul className="figures" aria-label="In figures">
          {record.figures.map((f, i) => (
            <li
              key={f.value}
              className="fig"
              data-reveal
              style={{ transitionDelay: `${i * 90}ms` }}
            >
              <figure
                // biome-ignore lint/a11y/noNoninteractiveTabindex: focus shows its source (figure:focus .fig-src)
                tabIndex={0}
                aria-describedby={`fig-src-${i}`}
              >
                <p className="fig-value">
                  {f.value.replace("+", "")}
                  {f.value.endsWith("+") ? <span className="fig-plus">+</span> : null}
                </p>
                <p className="fig-label">{f.label}</p>
                <figcaption id={`fig-src-${i}`} className="fig-src">
                  {f.source}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </section>

      <section id="work" className="rec-section rec-work" aria-labelledby="work-h">
        <Head num={1} label={record.work.label} title={record.work.title} id="work-h" />
        <ol className="plates">
          {projects.map((p, i) => (
            <li key={p.slug} id={`work-${p.slug}`} className={`plate plate-${i + 1}`} data-reveal>
              <a className="plate-link" href={p.url} target="_blank" rel="noopener noreferrer">
                <span className="plate-shot">
                  {/* biome-ignore lint/performance/noImgElement: static export */}
                  <img
                    src={p.image}
                    alt={`${p.name} home page`}
                    width={1440}
                    height={900}
                    loading="lazy"
                    decoding="async"
                  />
                  <span className="plate-light" aria-hidden="true" />
                </span>{" "}
                {/* (the spaces between these boxes are only for the text crawlers and screen readers read) */}
                <span className="plate-meta">
                  <span className="plate-num" aria-hidden="true">
                    {pad(i + 1)}
                  </span>{" "}
                  <span className="plate-sector">{proof.sector[p.slug]}</span>{" "}
                  <span className="plate-domain">
                    {p.domain}
                    <Arrow />
                  </span>
                </span>{" "}
                <h3 className="plate-name">{p.name}</h3>{" "}
                <span className="plate-line">{p.line}</span>{" "}
                <span className="plate-role">{proof.role[p.slug]}</span>
              </a>
            </li>
          ))}
        </ol>
        <div id="work-more" className="more" data-reveal>
          <h3 className="more-label">{record.work.more}</h3>
          <ul>
            {work.more.map((m) => (
              <li key={m.url}>
                <a href={m.url} target="_blank" rel="noopener noreferrer" data-star={m.label}>
                  {m.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="skills" className="rec-section rec-skills" aria-labelledby="skills-h">
        <Head num={2} label={record.skills.label} title={record.skills.title} id="skills-h" />
        <div className="skills">
          {skills.map((s, i) => (
            <div
              key={s.area}
              className="skill"
              data-reveal
              style={{ transitionDelay: `${i * 70}ms` }}
            >
              <h3 className="skill-area">{s.area}</h3>
              <ul>
                {items(s.items).map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section id="experience" className="rec-section rec-exp" aria-labelledby="exp-h">
        <Head num={3} label={record.experience.label} title={record.experience.title} id="exp-h" />
        <ol className="roles">
          {career.roles.map((r) => (
            <li key={r.company} className="role" data-reveal>
              <p className="role-when">
                {r.start === r.end ? (
                  r.start
                ) : (
                  <>
                    {r.start}{" "}
                    <span className="role-to">
                      <span className="visually-hidden">to</span>
                    </span>{" "}
                    {r.end}
                  </>
                )}
              </p>
              <div className="role-who">
                <h3 className="role-company">{r.company}</h3>
                <p className="role-title">{r.title}</p>
              </div>
              <p className="role-line">{r.line}</p>
            </li>
          ))}
        </ol>
        <div className="band" data-reveal>
          <div>
            <h3>{record.experience.band.certified}</h3>
            <ul>
              {finePrint.certifications.map((c) => (
                <li key={c.name}>
                  {c.name}
                  <span className="band-dim">
                    {" "}
                    {c.by}, {c.year}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3>{record.experience.band.studied}</h3>
            <p>{finePrint.education}</p>
          </div>
          <div>
            <h3>{record.experience.band.openSource}</h3>
            <p>{finePrint.openSource}</p>
          </div>
          <div>
            <h3>{record.experience.band.teaching}</h3>
            <p>{finePrint.speaking}</p>
          </div>
          <div>
            <h3>{record.experience.band.languages}</h3>
            <p>{finePrint.languages}</p>
          </div>
        </div>
        <p className="cv-links" data-reveal>
          <CVButton className="pill pill-solid">{record.experience.fullCV}</CVButton>
          <a className="pill" href={cv.pdf} download>
            {record.experience.pdf}
          </a>
        </p>
      </section>

      <section id="contact" className="rec-section rec-contact" aria-labelledby="contact-h">
        <Head num={4} label={record.contact.label} title={record.contact.title} id="contact-h" />
        <p className="email-wrap" data-reveal>
          <a className="email" href={`mailto:${site.email}`}>
            {site.email}
          </a>
        </p>
        <ul className="contact-links" data-reveal>
          <li>
            <a href={site.linkedin} target="_blank" rel="me noopener noreferrer">
              {record.contact.linkedin}
              <Arrow />
            </a>
          </li>
          <li>
            <a href={site.github} target="_blank" rel="me noopener noreferrer">
              {record.contact.github}
              <Arrow />
            </a>
          </li>
          <li>
            <RiyadhTime className="riyadh-time" />
          </li>
        </ul>
        <footer className="colophon">
          <p>
            {record.colophon}{" "}
            <a href={site.source} target="_blank" rel="noopener noreferrer">
              {record.source}
            </a>
          </p>
          {/* how his name is written, for the people (and the searches) that spell it another way */}
          <p className="colophon-aka">
            {site.name} (
            <span lang="ar" dir="rtl">
              {site.nameAr}
            </span>
            ). {aka}
          </p>
          <p className="colophon-row">
            <span>
              © {new Date().getFullYear()} {site.name}
            </span>{" "}
            <MotionToggle className="motion-foot" />{" "}
            <a href="#top" className="back" data-restart>
              {record.back}
              <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true" focusable="false">
                <path
                  d="M6 10.5V2.1M2.2 5.7 6 1.9l3.8 3.8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.1"
                />
              </svg>
            </a>
          </p>
        </footer>
      </section>
    </main>
  );
}
