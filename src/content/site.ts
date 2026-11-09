// Every fact on the site comes from this file, which is built from Mohammad's CV.
// Do not add numbers or claims that are not in the CV.

import type { FigureId, Verb } from "@/lib/journey";

export const site = {
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://oulabi.dev",
  name: "Mohammad AlOulabi",
  nameAr: "محمد العلبي",
  role: "Tech Manager",
  city: "Riyadh",
  email: "it.moh.ou@gmail.com",
  linkedin: "https://www.linkedin.com/in/mohammad-aloulabi/",
  github: "https://github.com/MohOulabi",
  /** This site's code. */
  source: "https://github.com/MohOulabi/oulabi.dev",
  description:
    "Tech manager in Riyadh with 10+ years of building digital products and leading the teams behind them: Riyadh Season, Formula 1 Saudi Arabian Grand Prix and Visit Saudi ticketing, government programs and AI-driven delivery.",
} as const;

export const live = {
  body: "At Webook I led the 15-person team behind ticketing and booking for Riyadh Season, the Formula 1 Saudi Arabian Grand Prix and Visit Saudi.",
  facts: [
    { value: "Millions", label: "of people served" },
    { value: "Hundreds of thousands", label: "of tickets sold" },
    { value: "99%+", label: "uptime through peak on-sales" },
  ],
};

export const plan = {
  bridge:
    "Clients and product owners on one side; engineers, QA and designers on the other. I work in the middle, and I still write production code.",
  stages: [
    {
      id: "brief",
      name: "Brief and RFP",
      line: "Proposals, BRDs and the questions nobody asked yet.",
    },
    {
      id: "scope",
      name: "Scope and architecture",
      line: "Estimates, budgets, vendors, and a system that will hold.",
    },
    {
      id: "build",
      name: "Build with the team",
      line: "Up to 20 engineers, QA and designers, Scrum or Kanban.",
    },
    {
      id: "launch",
      name: "Launch and run",
      line: "CI/CD, hosting and the night it all goes live.",
    },
  ],
  ai: "At BIM Ventures I moved delivery to coding agents with shared skills and instructions. Time to market came down by 60%.",
};

export type Project = {
  slug: string;
  name: string;
  url: string;
  domain: string;
  image: string;
  line: string;
};

export type ProjectGroup = { id: string; title: string; projects: Project[] };

export const work: {
  title: string;
  groups: ProjectGroup[];
  more: { label: string; url: string }[];
} = {
  title: "Platforms I've shipped",
  groups: [
    {
      id: "events",
      title: "National events and tourism",
      projects: [
        {
          slug: "webook",
          name: "webook.com",
          url: "https://webook.com/",
          domain: "webook.com",
          image: "/work/webook.webp",
          line: "Saudi Arabia's events platform: concerts, attractions and the Riyadh Season on-sales.",
        },
        {
          slug: "riyadhseason",
          name: "Riyadh Season",
          url: "https://riyadhseason.com/",
          domain: "riyadhseason.com",
          image: "/work/riyadhseason.webp",
          line: "The gateway to one of the world's largest entertainment festivals: zones, events and tickets.",
        },
        {
          slug: "visitsaudi",
          name: "Visit Saudi booking",
          url: "https://book.visitsaudi.com/",
          domain: "book.visitsaudi.com",
          image: "/work/visitsaudi.webp",
          line: "The official booking experience for Saudi tourism: experiences, events and packages.",
        },
        {
          slug: "kafu",
          name: "Kafu Games",
          url: "https://kafugames.com/",
          domain: "kafugames.com",
          image: "/work/kafu.webp",
          line: "An esports tournament platform for the region's gaming community: brackets, matches and prizes.",
        },
      ],
    },
    {
      id: "government",
      title: "Regulators and government",
      projects: [
        {
          slug: "smart-investor",
          name: "Smart Investor",
          url: "https://si.cma.gov.sa/",
          domain: "si.cma.gov.sa",
          image: "/work/smart-investor.webp",
          line: "The CMA's financial-literacy platform, teaching investment basics to the Saudi public.",
        },
        {
          slug: "eeaward",
          name: "Energy Efficiency Award",
          url: "https://eeaward.seec.gov.sa/en",
          domain: "eeaward.seec.gov.sa",
          image: "/work/eeaward.webp",
          line: "The Saudi Energy Efficiency Center's national award: nominations, judging and recognition.",
        },
        {
          slug: "dco",
          name: "Digital Cooperation Organization",
          url: "https://dco.org/",
          domain: "dco.org",
          image: "/work/dco.webp",
          line: "The multilateral body for digital-economy cooperation between its member states.",
        },
      ],
    },
    {
      id: "ventures",
      title: "Ventures and open source",
      projects: [
        {
          slug: "bimventures",
          name: "BIM Ventures",
          url: "https://bimventures.com/",
          domain: "bimventures.com",
          image: "/work/bimventures.webp",
          line: "A Saudi venture studio that builds companies from the ground up with its expertise, resources and network.",
        },
        {
          slug: "react-brackets",
          name: "React Brackets",
          url: "https://react-brackets.oulabi.dev/",
          domain: "react-brackets.oulabi.dev",
          image: "/work/react-brackets.webp",
          line: "An open-source React library for tournament brackets: elimination, round robin and Swiss, live and swipeable on a phone.",
        },
      ],
    },
  ],
  more: [
    { label: "tickets.saudiarabiangp.com", url: "https://tickets.saudiarabiangp.com/" },
    { label: "soum.tech", url: "https://soum.tech/" },
    { label: "gosteer.sa", url: "https://gosteer.sa/" },
    { label: "wafrawealth.sa", url: "https://wafrawealth.sa/" },
    { label: "thameen.cma.gov.sa", url: "https://thameen.cma.gov.sa/" },
    { label: "mulimgcc.org", url: "https://mulimgcc.org/" },
  ],
};

export const projects: Project[] = work.groups.flatMap((g) => g.projects);

export type Role = { company: string; title: string; start: string; end: string; line: string };

export const career: { title: string; roles: Role[] } = {
  title: "Ten years, six teams.",
  roles: [
    {
      company: "BIM Ventures",
      title: "Tech Manager",
      start: "2023",
      end: "now",
      line: "Leads 20 engineers, QA and designers across 16 startup and government projects; technical lead on RFPs, BRDs and architecture.",
    },
    {
      company: "Webook.com",
      title: "Technical Lead and Full Stack Developer",
      start: "2019",
      end: "2023",
      line: "Led a 15-person team on ticketing for Riyadh Season, Formula 1 and Visit Saudi; micro-frontends on Next.js and Nginx.",
    },
    {
      company: "Digital Oasis",
      title: "Software Engineer and System Analyst",
      start: "2019",
      end: "2019",
      line: "Gathered requirements with clients, wrote the UML, and built Node.js and React applications.",
    },
    {
      company: "Balot",
      title: "Team Lead, Full Stack Developer and Business Analyst",
      start: "2018",
      end: "2019",
      line: "Wrote the specifications and prototypes, then led the team that built the APIs and React frontends.",
    },
    {
      company: "DCode",
      title: "Junior Software Developer",
      start: "2016",
      end: "2018",
      line: "Turned client requirements into specifications, Figma designs, and React and PHP web apps.",
    },
    {
      company: "Freelance",
      title: "Frontend Developer",
      start: "2015",
      end: "2016",
      line: "Frontend builds for clients. Where it started.",
    },
  ],
};

export const finePrint = {
  certifications: [
    {
      name: "Project Management Professional (PMP)",
      by: "Project Management Institute",
      year: "2025",
    },
    { name: "Professional Scrum Master I (PSM I)", by: "Scrum.org", year: "2025" },
  ],
  education: "BSc Software Engineering, Applied Science University, Amman, 2018, graded Excellent.",
  openSource:
    "Creator of react-brackets and nextcrazy-cli; maintainer of the WooCommerce provider for Next.js Commerce.",
  speaking:
    "Instructor at a Facebook-hosted developer workshop in Riyadh and at React workshops at Astro Lab.",
  languages: "Arabic, native. English, fluent.",
};

export const skills: { area: string; items: string }[] = [
  {
    area: "Delivery",
    items:
      "Technical project management, RFPs and proposals, BRDs and SRS, scoping and estimation, budgets, vendors, risk, Scrum and Kanban, Jira",
  },
  {
    area: "Engineering",
    items:
      "Next.js, React, React Native, TypeScript, TanStack, Tailwind CSS, Node.js, Express, Laravel, PHP, MySQL, REST, micro-frontends, system architecture",
  },
  { area: "Cloud", items: "CI/CD, Vercel, Google Cloud, DigitalOcean, Nginx, Git" },
  {
    area: "AI",
    items:
      "Delivery with coding agents (Claude Code), agent skills and instructions, LLM integration (OpenAI, Claude, Vercel AI SDK), self-hosted models (DeepSeek)",
  },
  {
    area: "Product",
    items: "UI/UX collaboration, Figma prototyping, SEO, Google Analytics, Mixpanel",
  },
];

export const cv = {
  pdf: "/cv/Mohammad-AlOulabi-CV.pdf",
  summary:
    "Hands-on technology leader with 10+ years of building digital products. I lead teams of up to 20 engineers, QA and designers, write production code, and work between clients, product owners and engineering.",
  /**
   * The CV sheet (src/components/full-cv.tsx): its words, never its facts (those come from career, work, skills and
   * finePrint above). The section labels are the journal's small mono, lowercase.
   */
  sheet: {
    label: "curriculum vitae",
    role: "Tech Manager and Technical Project Manager",
    sections: {
      summary: "summary",
      experience: "experience",
      work: "platforms",
      more: "also shipped",
      skills: "skills",
      credentials: "credentials",
      certified: "certified",
      studied: "studied",
      languages: "languages",
      openSource: "open source and teaching",
      contact: "contact",
    },
    pdf: "Download PDF",
    pdfShort: "PDF",
    email: "Email",
    close: "Close the CV",
  },
};

export type KitPlate = {
  id: string;
  name: string;
  line: string;
  items: string[];
  hallmarks?: string[];
};

export const kit: { plates: KitPlate[] } = {
  plates: [
    {
      id: "lead",
      name: "Lead",
      line: "Delivery, and the people behind it",
      items: [
        "RFPs and proposals",
        "BRDs and SRS",
        "Scope and estimates",
        "Budgets and vendors",
        "Risk and stakeholders",
        "Scrum, Kanban, Jira",
      ],
      hallmarks: ["PMP 2025", "PSM I 2025"],
    },
    {
      id: "agents",
      name: "Agents",
      line: "Claude Code with shared skills",
      items: [
        "Delivery with coding agents",
        "Agent skills and instructions",
        "OpenAI and Claude APIs",
        "Vercel AI SDK",
        "Self-hosted DeepSeek",
      ],
    },
    {
      id: "interface",
      name: "Interface",
      line: "Next.js and React, hands on",
      items: [
        "Next.js",
        "React and React Native",
        "TypeScript",
        "TanStack",
        "Tailwind CSS",
        "Figma prototypes",
      ],
    },
    {
      id: "platform",
      name: "Platform",
      line: "Node.js, Laravel, micro-frontends",
      items: [
        "Node.js and Express",
        "Laravel and PHP",
        "MySQL",
        "REST APIs",
        "Micro-frontends",
        "System architecture, ERDs, UML",
      ],
    },
    {
      id: "run",
      name: "Run",
      line: "CI/CD on Vercel and Google Cloud",
      items: [
        "CI/CD pipelines",
        "Vercel",
        "Google Cloud",
        "DigitalOcean",
        "Nginx",
        "Analytics and SEO",
      ],
    },
  ],
};

export const proof = {
  /** Sector word under each pane, by project slug. */
  sector: {
    webook: "Events",
    riyadhseason: "Festival",
    visitsaudi: "Tourism booking",
    kafu: "Esports",
    "smart-investor": "Financial literacy",
    eeaward: "National award",
    dco: "Digital economy",
    bimventures: "Venture studio",
    "react-brackets": "Open source",
  } as Record<string, string>,
  /** His role on each platform. */
  role: {
    webook: "Technical lead, Webook",
    riyadhseason: "Technical lead, Webook",
    visitsaudi: "Technical lead, Webook",
    kafu: "Technical lead, Webook",
    "smart-investor": "Tech manager, BIM Ventures",
    eeaward: "Tech manager, BIM Ventures",
    dco: "Technical lead, Webook",
    bimventures: "Tech manager, BIM Ventures",
    "react-brackets": "Creator",
  } as Record<string, string>,
};

/* ------------------------------------------------------------------ Gravity (docs/STORY.md) */

/** A line of copy in both languages. */
export type Bi = { en: string; ar: string };

type FigureLine = Bi & {
  /**
   * When the line is on screen, as local progress k inside its figure (src/lib/journey.ts figK): it writes itself in
   * over [win[0], win[0] + lineRamp.in] and leaves over [win[1] - lineRamp.out, win[1]]. Scrubbed by scroll.
   */
  win: [number, number];
  /** Added to the line only when it is really between 1:30 and 3:00 at night for the visitor. */
  late?: Bi;
};

/** The gesture hint beside the ring (src/lib/journey.ts HINTS); `touch` replaces it on touch screens. */
export type HintCopy = Bi & { touch?: Bi };

export type FigureCopy = {
  /** 1..12, as the margin reads it: "fig. 5 — alignment". */
  number: number;
  title: Bi;
  lines: FigureLine[];
  /** This figure's own words for a verb, over the shared `hints`. */
  hints?: Partial<Record<Verb, HintCopy>>;
};

/**
 * Figs. 4, 8 and 12 turn with a sideways drag only (an upright one on a touch screen scrolls the story on, by design:
 * src/lib/scroll.ts limitTouch), so on touch the ring says which way. The Arabic is still to be confirmed.
 */
const turnDrag: HintCopy = {
  en: "Drag",
  ar: "اسحب",
  touch: { en: "Drag sideways", ar: "اسحب أفقيًا" },
};

/**
 * The twelve figures' copy, word for word from docs/STORY.md (Arabic included): first person, short, a little wry. The
 * lines are scrubbed by story time in the live show and printed under each still in the flow layout.
 */
export const figures: Record<FigureId, FigureCopy> = {
  point: {
    number: 1,
    title: { en: "The point", ar: "النقطة" },
    lines: [
      // on arrival, until the hold or the burst takes it (show-dom times this one)
      { en: "Every idea starts as a point.", ar: "كل فكرة تبدأ بنقطة.", win: [0, 0.1] },
      // a moment after the burst, or scrubbed in
      { en: "This one is yours.", ar: "وهذه نقطتك.", win: [0.1, 0.94] },
    ],
    // The first screen's gate (src/lib/gate.ts): the page waits here until the visitor lets the light go, by a hold
    // (the big bang) or a single click (a smaller one). On a touch screen the invitation is the tap: phones let the
    // music start only after a tap (a long press ends as a cancelled touch on an iPhone), and a tap there gives the
    // whole bang (src/gl/show/figures/genesis.ts, src/audio/score.ts).
    hints: {
      hold: {
        en: "Hold, or click, to begin",
        ar: "اضغط مطوّلًا أو انقر لتبدأ",
        touch: { en: "Tap to begin", ar: "المس لتبدأ" },
      },
    },
  },
  versions: {
    number: 2,
    title: { en: "A hundred versions", ar: "مئة نسخة" },
    lines: [
      {
        en: "Share an idea, and it turns into a hundred versions of itself.",
        ar: "شارك فكرة، وستولد منها مئة نسخة.",
        win: [0.1, 0.9],
      },
    ],
  },
  center: {
    number: 3,
    title: { en: "The center", ar: "المركز" },
    lines: [
      {
        en: "My first job is finding its center.",
        ar: "مهمتي الأولى أن أجد مركز ثقلها.",
        win: [0.02, 0.42],
      },
      // leaves before the sun's first light takes the frame (BEATS.center.ignite)
      {
        en: "Not the loudest part. The heaviest.",
        ar: "ليس الأعلى صوتًا، بل الأثقل.",
        win: [0.46, 0.84],
      },
    ],
    // (a click anywhere picks the knot nearest to it, the one the pointer lifts)
    hints: {
      click: {
        en: "Click the heaviest",
        ar: "انقر الأثقل",
        touch: { en: "Tap the heaviest", ar: "المس الأثقل" },
      },
    },
  },
  gathering: {
    number: 4,
    title: { en: "Gathering", ar: "التجمّع" },
    lines: [{ en: "Then people gather around it.", ar: "ثم يلتفّ الناس حولها.", win: [0.08, 0.9] }],
    hints: { drag: turnDrag },
  },
  alignment: {
    number: 5,
    title: { en: "Alignment", ar: "التناغم" },
    lines: [
      { en: "Everyone moves at their own speed.", ar: "لكلٍّ سرعته.", win: [0.04, 0.46] },
      {
        en: "That's fine, as long as they share a center.",
        ar: "ولا بأس، ما دام المركز واحدًا.",
        win: [0.5, 0.94],
      },
    ],
  },
  window: {
    number: 6,
    title: { en: "The window", ar: "النافذة" },
    lines: [
      { en: "Some days everything lines up.", ar: "في بعض الأيام يصطفّ كل شيء.", win: [0.04, 0.46] },
      { en: "Those are the days you launch.", ar: "وتلك أيام الإطلاق.", win: [0.5, 0.94] },
    ],
  },
  assist: {
    number: 7,
    title: { en: "Gravity assist", ar: "دفعة الجاذبية" },
    lines: [
      {
        en: "Borrow a little pull from everyone,",
        ar: "استمدّ من كلٍّ شيئًا من جاذبيته،",
        win: [0.16, 0.5],
      },
      {
        en: "and it goes further than any of us could alone.",
        ar: "لتمضي الفكرة أبعد مما يستطيع أيّ منا بمفرده.",
        win: [0.52, 0.86],
      },
    ],
  },
  theirs: {
    number: 8,
    title: { en: "Theirs", ar: "لهم" },
    lines: [
      {
        en: "Then it isn't ours anymore. It's theirs.",
        ar: "ثم لا تعود لنا، بل تصبح لهم.",
        win: [0.14, 0.92],
      },
    ],
    hints: { drag: turnDrag },
  },
  storm: {
    number: 9,
    title: { en: "The storm", ar: "العاصفة" },
    lines: [
      {
        en: "Something always breaks at 2 a.m.",
        ar: "دائمًا ما يتعطّل شيء في الثانية فجرًا.",
        win: [0.02, 0.32],
        late: { en: "Like now.", ar: "مثل الآن." },
      },
      // the middle line is the point of the figure: it stays readable for as long as the other two
      { en: "The job is that nobody notices.", ar: "والمهمة ألّا يلاحظ أحد.", win: [0.36, 0.66] },
      {
        en: "Sometimes it's even beautiful.",
        ar: "وأحيانًا يكون ذلك جميلًا أيضًا.",
        win: [0.7, 0.97],
      },
    ],
    // (holding speeds the storm up and the field pushes back harder; letting go eases both back)
    hints: { hold: { en: "Hold to push back", ar: "اضغط مطوّلًا لصدّ العاصفة" } },
  },
  flock: {
    number: 10,
    title: { en: "The flock", ar: "السرب" },
    lines: [
      { en: "At first, they follow you.", ar: "في البداية، يتبعونك.", win: [0.08, 0.48] },
      { en: "Then they don't need to.", ar: "ثم لا يحتاجون إلى ذلك.", win: [0.54, 0.94] },
    ],
    hints: {
      // (a finger leads them only while it is down and moving across: an upright drag scrolls the story on. The Arabic
      // of the touch words is still to be confirmed)
      move: {
        en: "Lead them",
        ar: "قُدهم",
        touch: { en: "Drag sideways to lead them", ar: "اسحب أفقيًا لتقودهم" },
      },
      letgo: { en: "Let go", ar: "دعهم ينطلقون" },
    },
  },
  again: {
    number: 11,
    title: { en: "Again", ar: "من جديد" },
    lines: [
      { en: "Then you do it again.", ar: "ثم تعيدها من جديد.", win: [0.04, 0.46] },
      { en: "Fifty-something times so far.", ar: "أكثر من خمسين مرة حتى الآن.", win: [0.5, 0.92] },
    ],
    hints: {
      hover: {
        en: "Hover a star",
        ar: "مرّر فوق نجمة",
        touch: { en: "Tap a star", ar: "المس نجمة" },
      },
    },
  },
  sky: {
    number: 12,
    title: { en: "The sky", ar: "السماء" },
    lines: [
      { en: "You never see gravity.", ar: "الجاذبية لا تُرى.", win: [0.06, 0.44] },
      { en: "Only what it holds together.", ar: "وإنما نرى ما تجمعه.", win: [0.48, 0.88] },
    ],
    hints: { drag: turnDrag },
  },
};

/** How long a line takes to write itself in and to leave, in local k. */
export const lineRamp = { in: 0.08, out: 0.07 };

/** "fig. 5 — alignment": the margin numbering of a figure (small mono, lowercase). */
export const figLabel = (id: FigureId) =>
  `fig. ${figures[id].number} — ${figures[id].title.en.toLowerCase()}`;

/**
 * The verb beside the hint ring, one per gesture (a figure may use its own words, `figures[id].hints`). Every gesture
 * is optional; the ring only invites. The flock's Arabic is from docs/STORY.md.
 */
export const hints: Record<Verb, HintCopy> = {
  hold: { en: "Hold", ar: "اضغط مطوّلًا" },
  drag: { en: "Drag", ar: "اسحب" },
  click: { en: "Click", ar: "انقر", touch: { en: "Tap", ar: "المس" } },
  move: { en: "Move", ar: "حرّك" },
  letgo: { en: "Let go", ar: "اترك" },
  hover: { en: "Hover", ar: "مرّر المؤشر", touch: { en: "Tap", ar: "المس" } },
};

/**
 * Fig. 11 on a touch screen: the first tap names a star, a second tap on it opens it in Work. Once one is named, the
 * ring says so.
 */
export const tapAgain: Bi = { en: "Tap it again to open it", ar: "المسها مرة أخرى لفتحها" };

/**
 * Fig. 11's star card, beside the platform star under the pointer (src/bridges/star-card.ts): the platform's own words
 * from Work above (its name, its line, `proof` sector and role; the also-shipped ones: their domain and
 * record.work.more), then how to open it (on touch: tapAgain).
 */
export const starCard = { open: { en: "Click to open", ar: "انقر لفتحها" } as Bi };

/**
 * The ending, after the last figure: the journal is signed (his name drawn in ink, Arabic and English), the last
 * line, his email, and the souvenir. `screens` is how far it reads on past the last figure (viewport heights) before
 * the record rises over it; the sky's section is FIG_SCREENS.sky + screens long.
 */
export const ending = {
  nameEn: site.name,
  nameAr: site.nameAr,
  role: "tech manager, riyadh",
  line: {
    en: "Every idea starts as a point. Bring me yours.",
    ar: "كل فكرة تبدأ بنقطة. فلنبدأ بنقطتك.",
  } as Bi,
  email: site.email,
  /**
   * The quiet link under the actions: back to the top with the light in the sky again, waiting for a new hold
   * (src/lib/scroll.ts startOver).
   */
  again: { en: "Start over", ar: "ابدأ من جديد" } as Bi,
  screens: 1.6,
};

/** The 404 page (src/app/not-found.tsx). */
export const notFound = {
  title: "Page not found",
  line: "There is nothing at this address.",
  home: "Go to Mohammad AlOulabi's page",
};

/** The first screen and the show's controls. */
export const firstScreen = {
  line: "Tech manager in Riyadh",
  skip: "Skip the show",
  /** The heading over the twelve figures (visually hidden: the outline's h2 for the show, its figures are h3). */
  showTitle: "The show, in twelve figures",
  /** The keyboard's hold (the hold button, in the tab order while a figure invites a hold), per figure. */
  holdKey: {
    point: "Press Space to begin, or hold it to gather the light.",
    alignment: "Hold Space to deepen the center's pull.",
    storm: "Hold Space to push back against the storm.",
  } as Partial<Record<FigureId, string>> & { point: string },
  keepSky: "Keep your sky",
  keepSkyBusy: "Saving your sky",
  keepSkyDone: "Saved. Look in your downloads.",
  open: "Open",
};

/**
 * The sound switch (src/components/ui/sound-toggle.tsx), the quiet line under the first figure's hold hint (shown until
 * the visitor's first gesture starts the music; the hold fulfils it) and the line beside the switch that a visitor who
 * only scrolls sees once (a click or a tap anywhere starts it).
 */
export const soundCopy = {
  label: { en: "Sound", ar: "الصوت" } as Bi,
  /** The switch's accessible state, as a screen reader announces it. */
  state: {
    ready: "ready, it starts with your first click, tap or key",
    playing: "playing",
    off: "off",
  },
  withSound: { en: "with sound", ar: "مع الصوت" } as Bi,
  nudge: { en: "click anywhere for sound", ar: "انقر في أي مكان لتشغيل الصوت" } as Bi,
  nudgeTouch: { en: "tap anywhere for sound", ar: "المس الشاشة لتشغيل الصوت" } as Bi,
  volume: "Volume",
};

/** The record, after the show. Every figure is a fact from the CV; its line says what stands behind it. */
export const record = {
  opener: ["What I build,", "millions touch."],
  intro: cv.summary,
  figures: [
    {
      value: "10+",
      label: "years building digital products",
      source:
        "From frontend engineer in 2015 to Tech Manager at BIM Ventures, leading engineering, QA and design.",
    },
    {
      value: "50+",
      label: "projects and platforms shipped",
      source:
        "From Riyadh Season and Formula 1 ticketing used by millions to the ventures and government programs I lead at BIM.",
    },
    {
      value: "60%",
      label: "faster time to market",
      source: "After I led BIM Ventures' move to AI-driven delivery with coding agents.",
    },
  ],
  work: { label: "Work", title: "Nine of 50+ projects and platforms.", more: "Also shipped" },
  skills: { label: "Skills", title: "What I work with." },
  experience: {
    label: "Experience",
    title: "Ten years, six teams.",
    band: {
      certified: "Certified",
      studied: "Studied",
      openSource: "Open source",
      teaching: "Teaching",
      languages: "Languages",
    },
    fullCV: "Read the full CV",
    pdf: "Download the PDF",
  },
  contact: {
    label: "Contact",
    title: "Tell me what has to go live, and when.",
    linkedin: "LinkedIn",
    github: "GitHub",
  },
  colophon:
    "Made in Riyadh with coding agents. Every point of light is drawn live in WebGL; the stars are tonight's sky over Riyadh, from the Yale Bright Star Catalogue.",
  source: "The code is open on GitHub.",
  back: "Back to the first point",
};

/* ------------------------------------------------------------------ Search: names, metadata, structured data */

/**
 * His name as people write it, in English and Arabic: the forms a search for him may use. Read by the JSON-LD
 * (alternateName, src/content/seo.ts), llms.txt and the record's footer line (`aka`).
 */
export const names = {
  given: "Mohammad",
  family: "AlOulabi",
  givenAr: "محمد",
  familyAr: "العلبي",
  variants: [
    "Mohammad Al Oulabi",
    "Mohammad Al-Oulabi",
    "Mohammad Aloulabi",
    "Mohammed AlOulabi",
    "Mohammed Al Oulabi",
    "Mohamed AlOulabi",
    "Mohamed Al Oulabi",
    "Mohamad AlOulabi",
    "Muhammad AlOulabi",
    "Muhammad Al Oulabi",
    "Mohammad Oulabi",
    "Mohammed Oulabi",
    "AlOulabi",
    "Al Oulabi",
    "محمد العلبي",
    "العلبي",
  ],
  /** His handles on the profiles he links to (site.linkedin, site.github): Google reads a profile's handle as an alternateName. */
  handles: ["MohOulabi", "mohammad-aloulabi"],
};

/** The record's footer, under the colophon: his name in Arabic, then the spellings it turns up under, in his voice. */
export const aka =
  "My name also turns up as Mohammed, Mohamed, Mohamad or Muhammad, and AlOulabi as Al Oulabi, Al-Oulabi, Aloulabi or plain Oulabi. All of them are me.";

/**
 * The page's metadata (src/app/layout.tsx) and structured data (src/content/seo.ts). Every word is from the facts
 * above: his role and city (site, cv.sheet.role), 10+ years and 50+ projects and platforms (record.figures), the
 * platforms (work, live), PMP (finePrint). `title` stays within 60 characters for search results; `socialTitle` is the
 * longer card title.
 */
export const seo = {
  title: "Mohammad AlOulabi · Tech Manager & Technical Project Manager",
  socialTitle: "Mohammad AlOulabi · Tech Manager & Technical Project Manager in Riyadh",
  /** The short name (the manifest's short_name, the iOS home-screen title). */
  shortName: "AlOulabi",
  description:
    "Tech manager and PMP in Riyadh. 10+ years, 50+ projects and platforms shipped, including Riyadh Season, Formula 1 Saudi Arabian Grand Prix and Visit Saudi.",
  /** His roles as recruiters search them (cv.sheet.role). */
  jobTitles: ["Tech Manager", "Technical Project Manager"],
  /** When this site was first built. */
  created: "2026-11-07T02:50:23+03:00",
  /**
   * When the facts on the page last changed (the JSON-LD dateModified, the sitemap's lastmod). Set it by hand when the
   * content changes, never at build time: a date that moves on every deploy tells search engines nothing.
   */
  updated: "2026-11-08T21:50:00+03:00",
  /**
   * Who he is in one paragraph, for search and AI answers (the JSON-LD description, llms.txt): career, live, finePrint
   * and the CV summary, said plainly in the third person.
   */
  about:
    "Mohammad AlOulabi (محمد العلبي) is a tech manager and technical project manager in Riyadh, Saudi Arabia, with 10+ years of building digital products. At BIM Ventures he leads 20 engineers, QA and designers across 16 startup and government projects; at Webook he led the 15-person team behind ticketing and booking for Riyadh Season, the Formula 1 Saudi Arabian Grand Prix and Visit Saudi. PMP and PSM I certified, he still writes production code in Next.js, React, Node.js and Laravel, and runs delivery with coding agents such as Claude Code.",
  /** The card image (public/og.jpg): a real frame of the show with his name and role. */
  ogImage: {
    url: "/og.jpg",
    width: 1200,
    height: 630,
    alt: "Mohammad AlOulabi (محمد العلبي), Tech Manager and Technical Project Manager in Riyadh",
  },
  /** Who grants PMP and PSM I (finePrint.certifications[].by). */
  issuers: {
    "Project Management Institute": "https://www.pmi.org/",
    "Scrum.org": "https://www.scrum.org/",
  } as Record<string, string>,
  /**
   * His skills as the plain terms people search for, every one from `skills` and `kit` above (knowsAbout in the
   * JSON-LD, the skills in llms.txt).
   */
  knowsAbout: [
    "Technical Project Management",
    "Project Management (PMP)",
    "Agile",
    "Scrum",
    "Kanban",
    "Jira",
    "RFPs and Proposals",
    "Business Requirements Documents (BRD)",
    "Software Requirements Specifications (SRS)",
    "Scoping and Estimation",
    "Budgeting",
    "Vendor Management",
    "Risk Management",
    "Stakeholder Management",
    "Engineering Team Leadership",
    "Next.js",
    "React",
    "React Native",
    "TypeScript",
    "TanStack",
    "Tailwind CSS",
    "Node.js",
    "Express",
    "Laravel",
    "PHP",
    "MySQL",
    "REST APIs",
    "Micro-frontends",
    "System Architecture",
    "CI/CD",
    "Vercel",
    "Google Cloud",
    "DigitalOcean",
    "Nginx",
    "Git",
    "AI-assisted Software Delivery",
    "Coding Agents",
    "Claude Code",
    "Agent Skills",
    "LLM Integration",
    "OpenAI API",
    "Claude API",
    "Vercel AI SDK",
    "Self-hosted LLMs (DeepSeek)",
    "UI/UX Collaboration",
    "Figma Prototyping",
    "SEO",
    "Google Analytics",
    "Mixpanel",
  ],
};
