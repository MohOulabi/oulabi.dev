// The public CV (public/cv/Mohammad-AlOulabi-CV.pdf), word for word, for /llms-full.txt (src/content/llms.ts).
// Server-only: the page itself takes its facts from site.ts. When the PDF changes, change this to match it.

export type CVRole = {
  title: string;
  company: string;
  place?: string;
  when: string;
  points: string[];
};

export const cvText = {
  heading: "Mohammad AlOulabi – CV (Tech Manager / TPM)",
  headline: "Tech Manager | Technical Project Manager | PMP · PSM I",
  reach: "it.moh.ou@gmail.com · linkedin.com/in/mohammad-aloulabi · Riyadh, Saudi Arabia",
  summary:
    "Hands-on technology leader with 10+ years taking digital products from RFP to production. I lead teams of up to 20 engineers, QA and designers, write production code in Next.js, React, Node.js and Laravel, and act as the bridge between clients, product owners and engineering. Delivered high-traffic platforms for Riyadh Season, Formula 1 Saudi Arabian Grand Prix and Visit Saudi, and manage startup and government programs end to end: RFPs, BRDs, scoping, budgets, vendors and delivery. PMP and PSM I certified. Currently leading AI-driven delivery with coding agents such as Claude Code, and shipping AI-powered MVPs on OpenAI, Claude and self-hosted models.",
  skills: [
    {
      area: "Delivery & Project Management",
      items:
        "Technical project management, RFPs and proposals, BRDs and SRS, requirements gathering, scoping and estimation, budgeting, vendor management, risk management, stakeholder management, Agile (Scrum, Kanban), Jira",
    },
    {
      area: "Engineering",
      items:
        "Next.js, React, React Native, TypeScript, TanStack (Query, Router, Table), Tailwind CSS, Node.js, Express, Laravel, PHP, MySQL, REST APIs, micro-frontends, system architecture, ERDs and UML",
    },
    {
      area: "Cloud & DevOps",
      items: "CI/CD pipelines, Vercel, Google Cloud, DigitalOcean, Nginx, Git",
    },
    {
      area: "AI",
      items:
        "AI-assisted delivery with coding agents (Claude Code), agent skills and instructions, LLM integration (OpenAI, Claude, Vercel AI SDK), self-hosted open-source models (DeepSeek)",
    },
    {
      area: "Product & Design",
      items:
        "UI/UX collaboration, prototyping (Figma), SEO, analytics (Google Analytics, Mixpanel)",
    },
  ],
  experience: [
    {
      title: "Tech Manager",
      company: "BIM Ventures",
      place: "Riyadh",
      when: "May 2023 – Present",
      points: [
        "Lead a team of 20 engineers, QA specialists and designers delivering 16 projects across BIM’s startup portfolio and government programs.",
        "Act as technical lead on RFPs and proposals: write BRDs, define scope and estimates, and turn client needs into delivery plans for founders, product owners and government PMOs.",
        "Integrated multiple platforms with ZATCA e-invoicing (Fatoora), covering onboarding, clearance and reporting; designed the architecture around provider rate limits and managed provider agreements and pricing.",
        "Led the move to AI-driven delivery: rolled out coding agents (Claude Code), shared agent skills and instructions, and automated core tasks, reducing time to market by 60%.",
        "Shipped AI-powered MVPs to production, integrating OpenAI and Claude APIs and self-hosted open-source models such as DeepSeek.",
        "Set architecture and long-term technical strategy for new ventures, from first prototype to scalable production.",
        "Work closely with UI/UX designers to close gaps between design, client expectations and engineering.",
      ],
    },
    {
      title: "Technical Lead & Full Stack Developer",
      company: "Webook.com",
      place: "Riyadh",
      when: "Oct 2019 – May 2023",
      points: [
        "Led a 15-person team building ticketing and booking platforms for Riyadh Season, Formula 1 Saudi Arabian Grand Prix and Visit Saudi, serving millions of users and selling hundreds of thousands of tickets.",
        "Owned planning, requirements analysis and progress reporting to stakeholders for each launch.",
        "Built frontends with React, Next.js, React Native, TypeScript and Tailwind CSS, and backends with Node.js, Laravel and MySQL.",
        "Designed a micro-frontend architecture with Next.js and Nginx, so teams could release independently.",
        "Ran CI/CD and hosting on Vercel, Google Cloud and DigitalOcean, keeping 99%+ uptime during peak on-sales.",
        "Integrated Google Analytics, Mixpanel and tracking pixels, and worked with marketing on SEO.",
      ],
    },
    {
      title: "Software Engineer & System Analyst",
      company: "Digital Oasis",
      place: "Riyadh",
      when: "Feb 2019 – Oct 2019",
      points: [
        "Led development teams and gathered requirements directly with clients, producing documentation and UML diagrams.",
        "Built full-stack applications with Node.js, Express and React, and improved SEO for React apps with server-side snapshots and React Helmet.",
      ],
    },
    {
      title: "Team Lead & Full Stack Developer / Business Analyst",
      company: "Balot",
      place: "Riyadh",
      when: "Jun 2018 – Feb 2019",
      points: [
        "Gathered requirements, wrote specifications and UML diagrams, and built high-fidelity prototypes.",
        "Led the development team; built Node.js and Express APIs and React frontends, with Google Analytics and Facebook Pixel tracking.",
      ],
    },
    {
      title: "Junior Software Developer",
      company: "DCode",
      place: "Riyadh",
      when: "Jul 2016 – Jun 2018",
      points: [
        "Turned client requirements into technical specifications, designed UIs in Figma, and built React, jQuery and PHP web apps.",
      ],
    },
    { title: "Frontend Developer", company: "Freelance", when: "Jan 2015 – Feb 2016", points: [] },
  ] as CVRole[],
  selectedProjects: [
    "Events & tourism (Webook): webook.com ticketing platform · riyadhseason.com · tickets.saudiarabiangp.com (Formula 1) · book.visitsaudi.com (Visit Saudi booking) · kafugames.com (esports)",
    "Ventures & startups (BIM Ventures and others): bimventures.com · soum.tech · gosteer.sa · wafrawealth.sa",
  ],
  certifications: [
    "Project Management Professional (PMP), Project Management Institute — 2025",
    "Professional Scrum Master I (PSM I), Scrum.org — 2025",
  ],
  education:
    "Bachelor of Software Engineering, Applied Science University, Amman, Jordan — 2018, Grade: Excellent",
  openSourceAndSpeaking: [
    "Creator of react-brackets (React library) and nextcrazy-cli (Next.js CLI); maintainer of the WooCommerce provider for Next.js Commerce.",
    "Instructor at a Facebook-hosted developer workshop in Riyadh and React workshops at Astro Lab Coworking Space.",
    "Second place, ASU Projects Competition, for a student social network integrated with university systems.",
  ],
  languages: "Arabic (native) · English (fluent)",
};
