"use client";

import { type KeyboardEvent, type MouseEvent, type PointerEvent, useEffect, useState } from "react";
import { initSound, setVolume, sound, subscribe, toggleSound } from "@/audio";
import { soundCopy } from "@/content/site";

/**
 * The sound switch, beside "Reduce motion" (src/components/chrome.tsx). Sound is on by default and starts with the
 * visitor's first gesture (src/audio). A small mark says the state, each one unlike the others: a gold play mark,
 * breathing, while it waits for that gesture ("ready": an invitation, the switch is a start button), four bars moving
 * slowly while the music plays, the bars struck through when it is off. Clicking it while it waits starts the music
 * (one click: never a toggle off first); while it plays, turns it off (a 0.6 s fade, remembered); while off, turns it
 * on. A visitor who scrolls while it waits sees one quiet line beside it, once: a click (a tap) anywhere starts it.
 * While it plays, hovering or focusing it reveals a small volume line above it (hidden on touch screens, which have
 * their own volume keys); let go at zero, the sound is off. A mouse click never leaves the focus on it: Space and the
 * arrows go back to scrolling the show.
 */
export function SoundToggle() {
  const [, setRev] = useState(0);

  useEffect(() => {
    const off = subscribe(() => setRev((r) => r + 1));
    initSound();
    return off;
  }, []);

  const { on, playing, volume, nudge } = sound;
  const state = !on ? "off" : playing ? "on" : "ready";
  const pct = Math.round(volume * 100);
  const keep = () => setVolume(sound.volume, true);
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== "Tab") keep();
  };
  const onToggle = (e: MouseEvent<HTMLButtonElement>) => {
    toggleSound();
    // (a pointer click, not a key: the focus goes back to the page)
    if (e.detail > 0) e.currentTarget.blur();
  };
  const onSlid = (e: PointerEvent<HTMLInputElement>) => {
    keep();
    e.currentTarget.blur();
  };

  return (
    <div
      className="sound"
      data-sound=""
      data-state={state}
      data-nudge={nudge ? "" : undefined}
      suppressHydrationWarning
    >
      <button
        type="button"
        className="sound-toggle"
        aria-pressed={state === "on"}
        aria-label={`${soundCopy.label.en}: ${soundCopy.state[state === "on" ? "playing" : state]}`}
        onClick={onToggle}
      >
        <span className="sound-mark" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
          <b className="sound-play" />
          <b className="sound-slash" />
        </span>
        <span className="sound-en">{soundCopy.label.en}</span>{" "}
        <span className="sound-ar" lang="ar" dir="rtl">
          {soundCopy.label.ar}
        </span>
      </button>
      <p className="sound-nudge" aria-hidden="true">
        <span className="sn-pointer">
          <span>{soundCopy.nudge.en}</span>{" "}
          <span lang="ar" dir="rtl">
            {soundCopy.nudge.ar}
          </span>
        </span>{" "}
        <span className="sn-touch">
          <span>{soundCopy.nudgeTouch.en}</span>{" "}
          <span lang="ar" dir="rtl">
            {soundCopy.nudgeTouch.ar}
          </span>
        </span>
      </p>
      <div className="sound-vol">
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={pct}
          aria-label={soundCopy.volume}
          aria-valuetext={`${pct}%`}
          tabIndex={state === "on" ? 0 : -1}
          style={{ "--v": `${pct}%` } as React.CSSProperties}
          onChange={(e) => setVolume(Number(e.currentTarget.value) / 100)}
          onPointerUp={onSlid}
          onKeyUp={onKey}
          onBlur={keep}
        />
      </div>
    </div>
  );
}
