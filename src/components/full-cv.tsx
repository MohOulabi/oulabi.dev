"use client";

import { type CSSProperties, Fragment, useEffect, useRef } from "react";
import { career, cv, finePrint, proof, record, site, skills, work } from "@/content/site";
import { getLenis } from "@/lib/scroll";
import "./full-cv.css";

const OPEN_CV = "opencv";

export function openCV() {
  window.dispatchEvent(new Event(OPEN_CV));
}

const S = cv.sheet;

/** "a, b (c, d), e" -> "a", "b (c, d)", "e": one item per comma outside parentheses. */
function splitItems(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let from = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (c === "," && depth === 0) {
      out.push(s.slice(from, i));
      from = i + 1;
    }
  }
  out.push(s.slice(from));
  return out
    .map((t) => t.trim())
    .filter(Boolean)
    .map((t) => t[0].toUpperCase() + t.slice(1));
}

const SKILLS = skills.map((s) => ({ area: s.area, items: splitItems(s.items) }));
/** "Project Management Professional (PMP)" -> "PMP": the hallmarks beside the role. */
const HALLMARKS = finePrint.certifications.map((c) => c.name.match(/\(([^)]+)\)/)?.[1] ?? c.name);
/** "Arabic, native. English, fluent." -> [["Arabic", "native"], ["English", "fluent"]]; the sentence as is otherwise. */
const LANGS = finePrint.languages
  .split(/\.\s*/)
  .filter(Boolean)
  .map((p) => p.split(/,\s*/));
const LANGS_OK = LANGS.length > 0 && LANGS.every((p) => p.length === 2);
/** "BSc Software Engineering, Applied Science University, Amman, 2018, graded Excellent." -> degree, then the rest. */
const [DEGREE, ...SCHOOL] = finePrint.education.split(/,\s*/);
const when = (r: { start: string; end: string }) =>
  r.start === r.end ? r.start : `${r.start} – ${r.end}`;
/** A press on the margin only closes the sheet once it has settled: the second click of a double-click on "CV" lands there. */
const SETTLE_MS = 600;
/** The blocks a resize keeps in place, in reading order (the one under the bar stays under it). */
const BLOCKS =
  ".cv-mast, .cv-sec, .cv-lede, .cv-figs, .cv-time > li, .cv-group, .cv-plats > li, .cv-skills > div, .cv-cols > *, .cv-close-line, .cv-end-actions";
const at = (i: number) => ({ "--i": i }) as CSSProperties;
const host = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

function Arrow() {
  return (
    <svg
      className="cv-arrow"
      viewBox="0 0 10 10"
      width="10"
      height="10"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M2.5 7.5 7.5 2.5M3.6 2.5h3.9v3.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}

/**
 * The whole CV, on demand: an editorial sheet that rises over the show (dimmed and softly blurred behind it). The
 * page behind never scrolls while it is open (Lenis is paused; wheel and touch outside the sheet are held); the sheet
 * scrolls natively. Esc, the close button or a click outside closes it (it sinks away first); focus is kept inside
 * and goes back to whatever opened it.
 */
export function FullCV() {
  const ref = useRef<HTMLDialogElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const closeRef = useRef<() => void>(() => {});

  useEffect(() => {
    const dlg = ref.current;
    const sheet = sheetRef.current;
    const rail = railRef.current;
    const thumb = thumbRef.current;
    if (!dlg || !sheet || !rail || !thumb) return;
    let opener: HTMLElement | null = null;
    let closing = false;
    let timer = 0;
    let downOutside = false;
    let openedAt = 0;
    let lastTop = 0;
    const root = document.documentElement;

    const finish = () => {
      if (timer) window.clearTimeout(timer);
      timer = 0;
      if (dlg.open) dlg.close();
    };
    const requestClose = () => {
      if (!dlg.open || closing) return;
      closing = true;
      dlg.setAttribute("data-closing", "");
      // the sheet sinks away first (full-cv.css), then the dialog closes; the timer is the floor if no animation runs
      timer = window.setTimeout(finish, 520);
    };
    closeRef.current = requestClose;

    const onAnimEnd = (e: AnimationEvent) => {
      if (closing && e.target === sheet && e.animationName.startsWith("cv-sink")) finish();
    };
    const open = () => {
      if (dlg.open) return;
      opener = document.activeElement as HTMLElement | null;
      closing = false;
      openedAt = performance.now();
      dlg.removeAttribute("data-closing");
      // every opening starts at the masthead: the bar plain, its label (not the name) in it
      sheet.removeAttribute("data-scrolled");
      sheet.removeAttribute("data-past");
      getLenis()?.stop();
      // the page behind is locked too (full-cv.css), so neither a scrollbar drag nor autoscroll can move the show
      root.classList.toggle("cv-gutter", window.innerWidth - root.clientWidth > 0);
      root.classList.add("cv-open");
      dlg.showModal();
      sheet.scrollTop = 0;
      lastTop = 0;
      sheet.focus({ preventScroll: true });
    };
    const onClose = () => {
      closing = false;
      if (timer) window.clearTimeout(timer);
      timer = 0;
      dlg.removeAttribute("data-closing");
      root.classList.remove("cv-open", "cv-gutter");
      getLenis()?.start();
      opener?.focus({ preventScroll: true });
      opener = null;
    };
    // Esc (and the platform's back gesture) sink the sheet rather than cutting it
    const onCancel = (e: Event) => {
      if (e.cancelable) e.preventDefault();
      requestClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
        return;
      }
      if (e.key !== "Tab") return;
      // keep focus inside the sheet: from the last control back to the first, and the other way round
      const f = sheet.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (!f.length) return;
      const first = f[0];
      const last = f[f.length - 1];
      const a = document.activeElement;
      if (e.shiftKey && (a === first || a === sheet)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && a === last) {
        e.preventDefault();
        first.focus();
      }
    };
    // a click outside the sheet closes it, only when it was pressed and let go outside (a text selection dragged out, or
    // a press dragged in, never does), and only once the sheet has settled (a double-click on "CV" never does)
    const outside = (x: number, y: number) => {
      const r = sheet.getBoundingClientRect();
      return x < r.left || x >= r.right || y < r.top || y >= r.bottom;
    };
    const onDown = (e: PointerEvent) => {
      downOutside =
        e.isPrimary &&
        e.target === dlg &&
        performance.now() - openedAt > SETTLE_MS &&
        outside(e.clientX, e.clientY);
    };
    const onClick = (e: MouseEvent) => {
      if (downOutside && e.target === dlg && e.detail < 2 && outside(e.clientX, e.clientY))
        requestClose();
      downOutside = false;
    };
    // a press on the margin that does not close it hands focus to the dialog itself: give it back to the sheet, so
    // the keys still scroll it and Tab still starts from its top
    const onFocus = (e: FocusEvent) => {
      if (e.target === dlg && dlg.open) sheet.focus({ preventScroll: true });
    };
    // the page behind never scrolls: wheel and touch outside the sheet are held (inside, overscroll is contained)
    const hold = (e: Event) => {
      if (e.cancelable && !sheet.contains(e.target as Node)) e.preventDefault();
    };

    // the bar's hairline once the sheet has scrolled, and the name in the bar once the masthead's has gone under it
    const top = sheet.querySelector<HTMLElement>(".cv-top");
    const name = sheet.querySelector<HTMLElement>(".cv-name");
    const io = new IntersectionObserver(
      (entries) => {
        // closed (display: none) nothing intersects: that is not the reader scrolling, so the bar is left as it is
        if (!dlg.open) return;
        for (const en of entries) {
          if (en.target === top) sheet.toggleAttribute("data-scrolled", !en.isIntersecting);
          else if (en.target === name) sheet.toggleAttribute("data-past", !en.isIntersecting);
        }
      },
      { root: sheet, rootMargin: "-72px 0px 0px 0px" },
    );
    if (top) io.observe(top);
    if (name) io.observe(name);

    // A resize or a turned phone keeps the reader's place: the block under the bar stays under it (the sheet's pixel
    // offset alone would land elsewhere once the columns reflow). Places are measured when the layout settles
    // (offsetTop ignores the sections' easing in), the scroll offset as the reader scrolls.
    const page = sheet.querySelector<HTMLElement>(".cv-page");
    const bar = sheet.querySelector<HTMLElement>(".cv-bar");
    const blocks = Array.from(sheet.querySelectorAll<HTMLElement>(BLOCKS));
    const tops = new Float64Array(blocks.length);
    const hs = new Float64Array(blocks.length);
    let measuredW = 0;
    let barH = 0;
    let maxTop = 0;
    // a block's place in the sheet's content, summed up its offsetParents (an easing section is one of them)
    const topIn = (el: HTMLElement) => {
      let y = 0;
      for (
        let e: HTMLElement | null = el;
        e && e !== sheet;
        e = e.offsetParent as HTMLElement | null
      )
        y += e.offsetTop;
      return y;
    };
    const measure = () => {
      for (let i = 0; i < blocks.length; i++) {
        tops[i] = topIn(blocks[i]);
        hs[i] = blocks[i].offsetHeight;
      }
      measuredW = page?.clientWidth ?? 0;
      barH = bar?.offsetHeight ?? 0;
      maxTop = sheet.scrollHeight - sheet.clientHeight;
    };
    const keepPlace = () => {
      if (lastTop <= 0) return;
      if (lastTop >= maxTop - 1) {
        sheet.scrollTop = sheet.scrollHeight;
        return;
      }
      const view = lastTop + barH;
      let i = -1;
      for (let k = 0; k < blocks.length; k++) if (tops[k] <= view) i = k;
      if (i < 0) return;
      const d = view - tops[i];
      const b = blocks[i];
      const t = topIn(b);
      const y =
        d <= hs[i]
          ? t + (hs[i] > 0 ? (d / hs[i]) * b.offsetHeight : 0)
          : t + b.offsetHeight + (d - hs[i]);
      sheet.scrollTop = Math.max(0, y - (bar?.offsetHeight ?? 0));
    };
    const ro = new ResizeObserver(() => {
      const w = page?.clientWidth ?? 0;
      if (!dlg.open || !w) {
        measuredW = 0;
        return;
      }
      if (measuredW && w !== measuredW) keepPlace();
      measure();
    });
    if (page) ro.observe(page);
    // ---- the sheet's own scrollbar (full-cv.css .cv-rail): the thumb follows the sheet; drag it, or press the rail to page
    let thumbH = 0;
    let moveTimer = 0;
    const paintRail = () => {
      const view = sheet.clientHeight;
      const full = sheet.scrollHeight;
      sheet.style.setProperty("--cv-vh", `${view}px`);
      rail.hidden = full <= view + 1;
      if (rail.hidden) return;
      const railH = rail.clientHeight;
      thumbH = Math.max(36, Math.round((railH * view) / full));
      const y = ((railH - thumbH) * sheet.scrollTop) / Math.max(1, full - view);
      thumb.style.height = `${thumbH}px`;
      thumb.style.transform = `translate3d(0,${y.toFixed(1)}px,0)`;
    };
    const railRo = new ResizeObserver(paintRail);
    railRo.observe(sheet);
    if (page) railRo.observe(page);
    let dragFrom = -1;
    let dragTop = 0;
    const onRailDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      const r = thumb.getBoundingClientRect();
      if (e.clientY >= r.top && e.clientY <= r.bottom) {
        dragFrom = e.clientY;
        dragTop = sheet.scrollTop;
        rail.setAttribute("data-drag", "");
        rail.setPointerCapture(e.pointerId);
      } else {
        // a press on the rail pages toward it
        sheet.scrollBy({
          top: (e.clientY < r.top ? -1 : 1) * sheet.clientHeight * 0.85,
          behavior: "smooth",
        });
      }
    };
    const onRailMove = (e: PointerEvent) => {
      if (dragFrom < 0) return;
      const span = Math.max(1, rail.clientHeight - thumbH);
      sheet.scrollTop =
        dragTop + ((e.clientY - dragFrom) * (sheet.scrollHeight - sheet.clientHeight)) / span;
    };
    const onRailUp = (e: PointerEvent) => {
      if (dragFrom < 0) return;
      dragFrom = -1;
      rail.removeAttribute("data-drag");
      if (rail.hasPointerCapture(e.pointerId)) rail.releasePointerCapture(e.pointerId);
    };
    rail.addEventListener("pointerdown", onRailDown);
    rail.addEventListener("pointermove", onRailMove);
    rail.addEventListener("pointerup", onRailUp);
    rail.addEventListener("pointercancel", onRailUp);

    const onScroll = () => {
      lastTop = sheet.scrollTop;
      paintRail();
      sheet.setAttribute("data-moving", "");
      if (moveTimer) window.clearTimeout(moveTimer);
      moveTimer = window.setTimeout(() => sheet.removeAttribute("data-moving"), 900);
    };

    window.addEventListener(OPEN_CV, open);
    dlg.addEventListener("close", onClose);
    dlg.addEventListener("cancel", onCancel);
    dlg.addEventListener("keydown", onKey);
    dlg.addEventListener("pointerdown", onDown);
    dlg.addEventListener("click", onClick);
    dlg.addEventListener("focus", onFocus);
    dlg.addEventListener("wheel", hold, { passive: false });
    dlg.addEventListener("touchmove", hold, { passive: false });
    sheet.addEventListener("animationend", onAnimEnd);
    sheet.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      ro.disconnect();
      root.classList.remove("cv-open", "cv-gutter");
      sheet.removeEventListener("scroll", onScroll);
      railRo.disconnect();
      if (moveTimer) window.clearTimeout(moveTimer);
      rail.removeEventListener("pointerdown", onRailDown);
      rail.removeEventListener("pointermove", onRailMove);
      rail.removeEventListener("pointerup", onRailUp);
      rail.removeEventListener("pointercancel", onRailUp);
      if (timer) window.clearTimeout(timer);
      window.removeEventListener(OPEN_CV, open);
      dlg.removeEventListener("close", onClose);
      dlg.removeEventListener("cancel", onCancel);
      dlg.removeEventListener("keydown", onKey);
      dlg.removeEventListener("pointerdown", onDown);
      dlg.removeEventListener("click", onClick);
      dlg.removeEventListener("focus", onFocus);
      dlg.removeEventListener("wheel", hold);
      dlg.removeEventListener("touchmove", hold);
      sheet.removeEventListener("animationend", onAnimEnd);
    };
  }, []);

  const mail = `mailto:${site.email}`;

  return (
    <dialog
      ref={ref}
      className="cv"
      aria-labelledby="cv-title"
      aria-modal="true"
      data-lenis-prevent
    >
      <div ref={sheetRef} className="cv-sheet" tabIndex={-1} data-cv-scroll>
        <div className="cv-rail-wrap" aria-hidden="true">
          <div ref={railRef} className="cv-rail" hidden>
            <span ref={thumbRef} className="cv-thumb" />
          </div>
        </div>
        <span className="cv-top" aria-hidden="true" />

        <div className="cv-bar">
          <p className="cv-bar-label">
            <span className="cv-bar-a">{S.label}</span>{" "}
            <span className="cv-bar-b" aria-hidden="true">
              {site.name}
            </span>
          </p>
          <div className="cv-actions">
            <a className="cv-btn cv-btn-solid" href={cv.pdf} download>
              <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
                <path
                  d="M6 1.5v7M2.8 5.4 6 8.6l3.2-3.2M2 10.6h8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.1"
                />
              </svg>
              <span className="cv-t">
                <span className="cv-wide">{S.pdf}</span>
                <span className="cv-narrow">{S.pdfShort}</span>
              </span>
            </a>
            <a className="cv-btn cv-btn-line cv-wide" href={mail}>
              <span className="cv-t">{S.email}</span>
            </a>
            <button
              type="button"
              className="cv-x"
              aria-label={S.close}
              onClick={() => closeRef.current()}
            >
              <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false">
                <path d="M3 3l8 8M11 3l-8 8" fill="none" stroke="currentColor" strokeWidth="1.1" />
              </svg>
            </button>
          </div>
        </div>

        <div className="cv-page">
          <header className="cv-mast cv-in" style={at(0)}>
            <div className="cv-mast-text">
              <h2 id="cv-title" className="cv-name">
                {site.name}
              </h2>
              <p className="cv-name-ar" lang="ar" dir="rtl">
                {site.nameAr}
              </p>
              <p className="cv-role">
                <span>{S.role}</span> <span className="cv-dot" aria-hidden="true" />
                <span>{site.city}</span>
                {HALLMARKS.map((h) => (
                  <Fragment key={h}>
                    {" "}
                    <span className="cv-mark">{h}</span>
                  </Fragment>
                ))}
              </p>
              <ul className="cv-reach">
                <li>
                  <a href={mail}>{site.email}</a>
                </li>
                <li>
                  <a href={site.linkedin} target="_blank" rel="noreferrer">
                    {record.contact.linkedin}
                    <Arrow />
                  </a>
                </li>
                <li>
                  <a href={site.github} target="_blank" rel="noreferrer">
                    {record.contact.github}
                    <Arrow />
                  </a>
                </li>
              </ul>
            </div>
            {/* the show's motif: a center, and a point settling into its orbit */}
            <svg className="cv-orbit" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
              <circle className="cv-orbit-ring" cx="60" cy="60" r="54" pathLength={1} />
              <circle className="cv-orbit-inner" cx="60" cy="60" r="31" />
              <g className="cv-orbit-arm">
                <circle className="cv-orbit-pt" cx="114" cy="60" r="2.3" />
              </g>
              <circle className="cv-orbit-sun" cx="60" cy="60" r="3.2" />
            </svg>
          </header>

          <section className="cv-sec cv-in" style={at(1)} aria-labelledby="cv-s-summary">
            <h3 className="cv-label" id="cv-s-summary">
              {S.sections.summary}
            </h3>
            <div className="cv-body">
              <p className="cv-lede">{cv.summary}</p>
              <dl className="cv-figs">
                {record.figures.map((f) => (
                  <div key={f.label}>
                    <dt>{f.value}</dt>
                    <dd>{f.label}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>

          <section className="cv-sec cv-in" style={at(2)} aria-labelledby="cv-s-exp">
            <h3 className="cv-label" id="cv-s-exp">
              {S.sections.experience}
            </h3>
            <ol className="cv-body cv-time">
              {career.roles.map((r) => (
                <li key={r.company} className={r.end === "now" ? "is-now" : undefined}>
                  <span className="cv-node" aria-hidden="true" />
                  <div className="cv-role-head">
                    <h4 className="cv-company">{r.company}</h4>
                    <p className="cv-when">{when(r)}</p>
                  </div>
                  <p className="cv-title">{r.title}</p>
                  <p className="cv-line">{r.line}</p>
                </li>
              ))}
            </ol>
          </section>

          <section className="cv-sec cv-in" style={at(3)} aria-labelledby="cv-s-work">
            <h3 className="cv-label" id="cv-s-work">
              {S.sections.work}
            </h3>
            <div className="cv-body">
              {work.groups.map((g) => (
                <div key={g.id} className="cv-group">
                  <h4 className="cv-sub">{g.title}</h4>
                  <ul className="cv-plats">
                    {g.projects.map((p) => (
                      <li key={p.slug}>
                        <a href={p.url} target="_blank" rel="noreferrer">
                          <span className="cv-p-name">{p.name}</span>{" "}
                          <span className="cv-p-sector">{proof.sector[p.slug]}</span>{" "}
                          <span className="cv-p-host">
                            {p.domain}
                            <Arrow />
                          </span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="cv-group">
                <h4 className="cv-sub">{S.sections.more}</h4>
                <ul className="cv-more">
                  {work.more.map((m) => (
                    <li key={m.url}>
                      <a href={m.url} target="_blank" rel="noreferrer">
                        {host(m.label)}
                        <Arrow />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="cv-sec cv-in" style={at(4)} aria-labelledby="cv-s-skills">
            <h3 className="cv-label" id="cv-s-skills">
              {S.sections.skills}
            </h3>
            <dl className="cv-body cv-skills">
              {SKILLS.map((s) => (
                <div key={s.area}>
                  <dt>{s.area}</dt>
                  <dd>
                    <ul className="cv-items">
                      {s.items.map((it, i) => (
                        <Fragment key={it}>
                          {i > 0 && " "}
                          <li>{it}</li>
                        </Fragment>
                      ))}
                    </ul>
                  </dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="cv-sec cv-in" style={at(4)} aria-labelledby="cv-s-cred">
            <h3 className="cv-label" id="cv-s-cred">
              {S.sections.credentials}
            </h3>
            <div className="cv-body cv-cols">
              <div>
                <h4 className="cv-sub">{S.sections.certified}</h4>
                <ul className="cv-facts">
                  {finePrint.certifications.map((c) => (
                    <li key={c.name}>
                      <span className="cv-fact-main">{c.name}</span>
                      <span className="cv-fact-meta">
                        {c.by}, {c.year}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="cv-sub">{S.sections.studied}</h4>
                <ul className="cv-facts">
                  <li>
                    <span className="cv-fact-main">{DEGREE}</span>{" "}
                    {SCHOOL.length > 0 && <span className="cv-fact-meta">{SCHOOL.join(", ")}</span>}
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="cv-sub">{S.sections.languages}</h4>
                {LANGS_OK ? (
                  <ul className="cv-facts">
                    {LANGS.map(([l, level]) => (
                      <li key={l} className="cv-lang">
                        <span className="cv-fact-main">{l}</span>
                        <span className="cv-fact-meta">{level}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="cv-fact-meta">{finePrint.languages}</p>
                )}
              </div>
            </div>
          </section>

          <section className="cv-sec cv-in" style={at(4)} aria-labelledby="cv-s-oss">
            <h3 className="cv-label" id="cv-s-oss">
              {S.sections.openSource}
            </h3>
            <div className="cv-body cv-cols cv-cols-2">
              <p className="cv-prose">{finePrint.openSource}</p>
              <p className="cv-prose">{finePrint.speaking}</p>
            </div>
          </section>

          <section className="cv-sec cv-end cv-in" style={at(4)} aria-labelledby="cv-s-contact">
            <h3 className="cv-label" id="cv-s-contact">
              {S.sections.contact}
            </h3>
            <div className="cv-body">
              <p className="cv-close-line">{record.contact.title}</p>
              <a className="cv-mail" href={mail}>
                {site.email}
              </a>
              <div className="cv-end-actions">
                <a className="cv-btn cv-btn-solid" href={cv.pdf} download>
                  <svg
                    viewBox="0 0 12 12"
                    width="12"
                    height="12"
                    aria-hidden="true"
                    focusable="false"
                  >
                    <path
                      d="M6 1.5v7M2.8 5.4 6 8.6l3.2-3.2M2 10.6h8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.1"
                    />
                  </svg>
                  <span className="cv-t">{S.pdf}</span>
                </a>
                <a
                  className="cv-btn cv-btn-line"
                  href={site.linkedin}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="cv-t">{record.contact.linkedin}</span>
                  <Arrow />
                </a>
                <a
                  className="cv-btn cv-btn-line"
                  href={site.github}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="cv-t">{record.contact.github}</span>
                  <Arrow />
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </dialog>
  );
}
