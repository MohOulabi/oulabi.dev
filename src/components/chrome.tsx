"use client";

import type { MouseEvent } from "react";
import { cv, ending, firstScreen, record, site } from "@/content/site";
import { openCV } from "./full-cv";
import { MotionToggle } from "./ui/motion-toggle";
import { SoundToggle } from "./ui/sound-toggle";

/** The CV link opens the CV dialog; without JavaScript (or with a modifier, for a new tab) it is the PDF itself. */
function onCV(e: MouseEvent<HTMLAnchorElement>) {
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  openCV();
}

/**
 * The frame around the show, visible from frame one: the name (small, both languages, one line), the fast lane
 * (Start over, Work, Skills, Experience, CV), "Skip the show", the live readout, the motion switch and the sound switch. None of
 * it moves the page on its own; the links jump only when activated. The name starts the show over (src/lib/scroll.ts
 * startOver: back to the top, the light in the sky again, waiting for the hold).
 */
export function Chrome() {
  return (
    <>
      <header className="chrome">
        {/* (on a phone it reads "Skip" alone: the label keeps its whole name) */}
        <a className="skip-show" href="#record" aria-label={firstScreen.skip}>
          <span>{firstScreen.skip}</span>
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
            <path
              d="M6 1.5v8.4M2.2 6.3 6 10.1l3.8-3.8"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.1"
            />
          </svg>
        </a>
        <div className="ident">
          <h1 className="name">
            {/* starts the show over from the first point (src/lib/scroll.ts startOver); the heading's name is his name,
                what the link does is its description */}
            <a href="#top" data-restart aria-describedby="name-does">
              <span className="name-en">{site.name}</span>{" "}
              <span className="name-dot" aria-hidden="true" />
              <span className="name-ar" lang="ar" dir="rtl">
                {site.nameAr}
              </span>
            </a>
          </h1>
          <span id="name-does" className="visually-hidden">
            {record.back}
          </span>
          <p className="name-line">{firstScreen.line}</p>
        </div>
        <nav className="lane" aria-label="Fast lane">
          {/* back to the first point, the show re-armed (the same as the name and the ending's link; on a phone, the mark alone) */}
          <a
            className="lane-again"
            href="#top"
            data-restart
            aria-label={`${ending.again.en}: back to the first point`}
          >
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
              <path
                d="M2.4 6a3.6 3.6 0 1 0 1.1-2.6M2.2 1.8v2h2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.1"
              />
            </svg>
            <span>{ending.again.en}</span>
          </a>{" "}
          <a href="#work" data-lane="work">
            {record.work.label}
          </a>{" "}
          <a href="#skills" data-lane="skills">
            {record.skills.label}
          </a>{" "}
          <a href="#experience" data-lane="experience">
            {record.experience.label}
          </a>{" "}
          <a className="lane-cv" href={cv.pdf} onClick={onCV} aria-haspopup="dialog">
            CV
          </a>
        </nav>
      </header>
      <div className="corner-bl">
        <p id="nq-readout" className="readout" aria-hidden="true" />
        <MotionToggle />
        <SoundToggle />
      </div>
    </>
  );
}
