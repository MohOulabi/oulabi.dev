// /llms.txt and /llms-full.txt (llmstxt.org): who he is, in plain markdown, for AI search and assistants.
// Built from site.ts (and, for the full profile, the public CV word for word: cv-text.ts). Server-only.

import { cvText } from "./cv-text";
import { abs } from "./seo";
import {
  career,
  cv,
  finePrint,
  kit,
  live,
  names,
  plan,
  projects,
  proof,
  record,
  seo,
  site,
  skills,
  work,
} from "./site";

const when = (r: { start: string; end: string }) =>
  r.start === r.end ? r.start : `${r.start} to ${r.end}`;
const list = (xs: string[]) => xs.map((x) => `- ${x}`).join("\n");
/** The Latin spellings of his name (the Arabic ones are given as Arabic). */
const variants = names.variants.filter((v) => !/[؀-ۿ]/.test(v)).join(", ");
const certs = finePrint.certifications.map((c) => `${c.name}, ${c.by}, ${c.year}`);
const oneLine = `${site.name} (${site.nameAr}) is a tech manager and technical project manager (PMP, PSM I) in ${site.city}, Saudi Arabia, with 10+ years of building digital products and 50+ projects and platforms shipped, including the ticketing behind Riyadh Season, the Formula 1 Saudi Arabian Grand Prix and Visit Saudi.`;

const quick = [
  `Name: ${site.name}. In Arabic: ${site.nameAr}. Also written: ${variants}.`,
  `Role: Tech Manager at BIM Ventures in ${site.city}, Saudi Arabia (2023 to now), working as a technical project manager.`,
  `Team: leads 20 engineers, QA and designers across 16 startup and government projects at BIM Ventures.`,
  `Before that, at Webook.com (2019 to 2023): technical lead of the 15-person team behind ticketing and booking for Riyadh Season, the Formula 1 Saudi Arabian Grand Prix and Visit Saudi: platforms serving millions of users, hundreds of thousands of tickets sold, 99%+ uptime through peak on-sales.`,
  `AI delivery: moved his team at BIM Ventures to coding agents (Claude Code) with shared skills and instructions, cutting time to market by 60%.`,
  `Certified: ${certs.join("; ")}.`,
  `Studied: ${finePrint.education}`,
  `Languages: ${finePrint.languages}`,
  `Contact: ${site.email}, ${site.linkedin}`,
];

const workLines = projects.map(
  (p) =>
    `[${p.name}](${p.url}): ${p.line} Sector: ${proof.sector[p.slug]}. His role: ${proof.role[p.slug]}.`,
);
const moreLines = work.more.map((m) => `[${m.label}](${m.url})`);
/** llms.txt's link lists (llmstxt.org: an H2 section holds only "- [name](url): notes" items). */
const moreItems = work.more.map((m) => `[${m.label}](${m.url}): ${record.work.more.toLowerCase()}`);
const roleLines = career.roles.map((r) => `**${r.title}, ${r.company}** (${when(r)}): ${r.line}`);
const skillLines = skills.map((s) => `**${s.area}:** ${s.items}`);
const links = [
  `[Website](${abs("/")}): the portfolio: twelve figures drawn live in WebGL, then the record (work, skills, experience, contact)`,
  `[CV (PDF)](${abs(cv.pdf)}): the full CV`,
  `[LinkedIn](${site.linkedin}): his LinkedIn profile`,
  `[GitHub](${site.github}): his GitHub profile`,
  `[Email](mailto:${site.email}): ${site.email}`,
];
const nameLine = `${site.name} is also written ${variants}. In Arabic: ${site.nameAr}, or ${names.familyAr} alone. All refer to the same person.`;

/**
 * The short profile (llms.txt), in the llmstxt.org shape: the H1, the one-line summary, the facts as plain markdown
 * with no headings, then H2 sections that are only link lists (the profile, the work, and the optional full profile).
 */
export function llmsTxt() {
  return `# ${site.name}

> ${oneLine}

${seo.about}

**Quick facts**

${list(quick)}

**In his own words:** ${cv.summary} ${live.body} ${plan.ai}

**Roles and experience**

${list(roleLines)}

**Skills**

${list(skillLines)}

**Certifications:** ${certs.join("; ")}.

**Education:** ${finePrint.education}

**Languages:** ${finePrint.languages}

**Name variants:** ${nameLine}

## Profile and contact

${list(links)}

## Selected work

${list([...workLines, ...moreItems])}

## Optional

- [Full profile](${abs("/llms-full.txt")}): every fact on the site and the full CV text, in markdown
`;
}

/** The full profile (llms-full.txt): every fact on the site, then the CV word for word. */
export function llmsFullTxt() {
  const kitLines = kit.plates.map(
    (p) =>
      `**${p.name}** (${p.line}): ${p.items.join(", ")}${p.hallmarks ? `. ${p.hallmarks.join(", ")}` : ""}.`,
  );
  const stageLines = plan.stages.map((s) => `**${s.name}:** ${s.line}`);
  const figures = record.figures.map((f) => `**${f.value}** ${f.label}.`);
  const cvRoles = cvText.experience
    .map(
      (r) =>
        `### ${r.title}, ${r.company}${r.place ? `, ${r.place}` : ""}\n\n${r.when}${r.points.length ? `\n\n${list(r.points)}` : ""}`,
    )
    .join("\n\n");
  const groups = work.groups
    .map(
      (g) =>
        `### ${g.title}\n\n${list(
          g.projects.map(
            (p) =>
              `[${p.name}](${p.url}) (${p.domain}): ${p.line} Sector: ${proof.sector[p.slug]}. His role: ${proof.role[p.slug]}.`,
          ),
        )}`,
    )
    .join("\n\n");

  return `# ${site.name} (${site.nameAr}): full profile

> ${oneLine}

${seo.about}

Source: ${abs("/")} and the public CV, ${abs(cv.pdf)}. Every fact here comes from his CV or from him.

## Quick facts

${list(quick)}

## Summary

In his own words: ${cv.summary}

## In figures

${list(figures)}

## Webook: Riyadh Season, Formula 1 and Visit Saudi

${live.body}

${list(live.facts.map((f) => `${f.value} ${f.label}`))}

## How he works

${plan.bridge}

${list(stageLines)}

${plan.ai}

## Experience

${list(roleLines)}

## Work: ${record.work.title.replace(/\.$/, "")}

${groups}

### Also shipped

${list(moreLines)}

## Skills

${list(skillLines)}

### What he brings, by layer

${list(kitLines)}

## Certifications

${list(certs)}

## Education

${finePrint.education}

## Open source and teaching

${list([finePrint.openSource, finePrint.speaking])}

## Languages

${finePrint.languages}

## Contact and links

${list(links)}

## Name variants

${site.name} is also written ${variants}. In Arabic: ${site.nameAr} (given name ${names.givenAr}, family name ${names.familyAr}). His handles: ${names.handles.join(" (GitHub), ")} (LinkedIn). All refer to the same person.

## The CV, word for word

${cvText.headline}

${cvText.reach}

### Summary

${cvText.summary}

### Core skills

${list(cvText.skills.map((s) => `**${s.area}:** ${s.items}`))}

${cvRoles}

### Selected projects

${list(cvText.selectedProjects)}

### Certifications

${list(cvText.certifications)}

### Education

${cvText.education}

### Open source and speaking

${list(cvText.openSourceAndSpeaking)}

### Languages

${cvText.languages}

## About this site

${record.colophon} The code is open: ${site.source}
`;
}
