// Search: the page's structured data (one JSON-LD @graph, rendered in src/app/layout.tsx), built only from site.ts.
// Server-only (the layout, the sitemap, robots, the manifest and the llms routes read it).

import { career, cv, finePrint, names, projects, proof, record, seo, site, work } from "./site";

/** An absolute URL on the site (metadataBase: site.url, overridable by NEXT_PUBLIC_SITE_URL). */
export const abs = (path = "/") => new URL(path, site.url).href;

const ID = {
  website: abs("/#website"),
  page: abs("/#profilepage"),
  person: abs("/#person"),
  employer: abs("/#bim-ventures"),
  work: abs("/#selected-work"),
  cv: abs(cv.pdf),
};

const ref = (id: string) => ({ "@id": id });

/** "Project Management Professional (PMP)" → "PMP". */
const short = (name: string) => name.match(/\(([^)]+)\)/)?.[1] ?? name;

/** "BSc Software Engineering, Applied Science University, Amman, 2018, graded Excellent." */
const [degree, school, schoolCity, gradYear] = finePrint.education.split(/,\s*/);

const employerUrl = work.more.find((m) => m.label === "bimventures.com")?.url;

/** The teams before BIM Ventures (career.roles), as organisations he is an alumnus of; Webook.com with its site. */
const formerEmployers = career.roles
  .filter((r) => r.end !== "now" && r.company !== "Freelance")
  .map((r) => {
    const own = projects.find((p) => p.domain.toLowerCase() === r.company.toLowerCase());
    return {
      "@type": "Organization",
      name: r.company,
      ...(r.company === "Webook.com" ? { alternateName: "Webook" } : {}),
      ...(own ? { url: own.url } : {}),
    };
  });

function person() {
  return {
    "@type": "Person",
    "@id": ID.person,
    name: site.name,
    // the spellings of his name, then his handles on the profiles in sameAs
    alternateName: [...names.variants, ...names.handles],
    givenName: names.given,
    familyName: names.family,
    jobTitle: seo.jobTitles,
    description: seo.about,
    disambiguatingDescription: `${seo.jobTitles.join(" and ")} at BIM Ventures in ${site.city}`,
    url: abs("/"),
    mainEntityOfPage: ref(ID.page),
    email: site.email,
    sameAs: [site.linkedin, site.github],
    address: { "@type": "PostalAddress", addressLocality: site.city, addressCountry: "SA" },
    workLocation: {
      "@type": "Place",
      name: `${site.city}, Saudi Arabia`,
      address: { "@type": "PostalAddress", addressLocality: site.city, addressCountry: "SA" },
    },
    worksFor: {
      "@type": "Organization",
      "@id": ID.employer,
      name: "BIM Ventures",
      ...(employerUrl ? { url: employerUrl } : {}),
    },
    alumniOf: [
      {
        "@type": "CollegeOrUniversity",
        name: school,
        address: { "@type": "PostalAddress", addressLocality: schoolCity, addressCountry: "JO" },
      },
      ...formerEmployers,
    ],
    hasCredential: [
      ...finePrint.certifications.map((c) => ({
        "@type": "EducationalOccupationalCredential",
        name: c.name,
        alternateName: short(c.name),
        credentialCategory: "certification",
        recognizedBy: {
          "@type": "Organization",
          name: c.by,
          ...(seo.issuers[c.by] ? { url: seo.issuers[c.by] } : {}),
        },
        dateCreated: c.year,
      })),
      {
        "@type": "EducationalOccupationalCredential",
        name: degree,
        credentialCategory: "degree",
        educationalLevel: "Bachelor's degree",
        recognizedBy: { "@type": "CollegeOrUniversity", name: school },
        dateCreated: gradYear,
      },
    ],
    knowsLanguage: [
      { "@type": "Language", name: "Arabic", alternateName: "ar" },
      { "@type": "Language", name: "English", alternateName: "en" },
    ],
    knowsAbout: seo.knowsAbout,
    hasOccupation: {
      "@type": "Occupation",
      name: seo.jobTitles[0],
      alternateName: seo.jobTitles.slice(1),
      description: cv.summary,
      occupationLocation: {
        "@type": "City",
        name: site.city,
        containedInPlace: { "@type": "Country", name: "Saudi Arabia" },
      },
      skills: seo.knowsAbout,
    },
    subjectOf: ref(ID.cv),
  };
}

/** The nine platforms of the record, then the also-shipped ones: each a website his teams built (never his alone). */
function selectedWork() {
  const nine = projects.map((p) => ({
    "@type": "WebSite",
    name: p.name,
    url: p.url,
    description: `${p.line} His role: ${proof.role[p.slug]}.`,
    about: { "@type": "Thing", name: proof.sector[p.slug] },
    contributor: ref(ID.person),
  }));
  const more = work.more.map((m) => ({
    "@type": "WebSite",
    name: m.label,
    url: m.url,
    contributor: ref(ID.person),
  }));
  return {
    "@type": "ItemList",
    "@id": ID.work,
    name: `${site.name}: platforms shipped`,
    description: `${record.work.title.replace(/\.$/, "")}, then ${more.length} more ${record.work.more.toLowerCase()}.`,
    numberOfItems: nine.length + more.length,
    itemListElement: [...nine, ...more].map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      item,
    })),
  };
}

/** One @graph: the site, the profile page, the person, his selected work and his CV. */
function jsonLd() {
  const home = abs("/");
  const og = abs(seo.ogImage.url);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": ID.website,
        url: home,
        name: site.name,
        alternateName: [site.nameAr, "AlOulabi", new URL(site.url).hostname],
        description: seo.description,
        inLanguage: ["en", "ar"],
        publisher: ref(ID.person),
        author: ref(ID.person),
      },
      {
        "@type": "ProfilePage",
        "@id": ID.page,
        url: home,
        name: seo.socialTitle,
        description: seo.description,
        inLanguage: "en",
        isPartOf: ref(ID.website),
        mainEntity: ref(ID.person),
        about: ref(ID.person),
        primaryImageOfPage: {
          "@type": "ImageObject",
          url: og,
          contentUrl: og,
          width: seo.ogImage.width,
          height: seo.ogImage.height,
          caption: seo.ogImage.alt,
        },
        image: og,
        dateCreated: seo.created,
        dateModified: seo.updated,
        hasPart: [ref(ID.work), ref(ID.cv)],
      },
      person(),
      selectedWork(),
      {
        "@type": "DigitalDocument",
        "@id": ID.cv,
        name: `${site.name}, CV (${seo.jobTitles.join(" and ")})`,
        url: ID.cv,
        encodingFormat: "application/pdf",
        inLanguage: "en",
        author: ref(ID.person),
        about: ref(ID.person),
        isPartOf: ref(ID.website),
      },
    ],
  };
}

/** JSON for a <script type="application/ld+json">: "<" escaped so no text can close the script. */
export const jsonLdScript = () => JSON.stringify(jsonLd()).replace(/</g, "\\u003c");
