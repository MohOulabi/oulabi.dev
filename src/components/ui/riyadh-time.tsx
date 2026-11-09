"use client";

import { useEffect, useRef } from "react";
import { site } from "@/content/site";

/** "It's 9:14 pm in Riyadh." — live, updated on the minute. Without JS it reads "Based in Riyadh." */
export function RiyadhTime({ className }: { className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let fmt: Intl.DateTimeFormat;
    try {
      fmt = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Riyadh",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
    } catch {
      return; // no time zone data: keep the static line
    }
    let timer = 0;
    const render = () => {
      const now = new Date();
      let h = "";
      let m = "";
      let p = "";
      for (const part of fmt.formatToParts(now)) {
        if (part.type === "hour") h = part.value;
        else if (part.type === "minute") m = part.value;
        else if (part.type === "dayPeriod") p = part.value.toLowerCase();
      }
      el.textContent = `It's ${h}:${m} ${p} in ${site.city}.`;
      // next tick on the minute boundary
      timer = window.setTimeout(render, 60_000 - (now.getTime() % 60_000) + 50);
    };
    render();
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <p ref={ref} className={className} data-riyadh-time>
      Based in {site.city}.
    </p>
  );
}
