import type { Metadata } from "next";
import { notFound, site } from "@/content/site";

/** Its own title, and no claim to be the profile (Next adds the noindex itself): no canonical, no JSON-LD, no card. */
export const metadata: Metadata = {
  title: notFound.title,
  description: notFound.line,
};

/** Any address the site does not have: one quiet line and the way home. */
export default function NotFound() {
  return (
    <main className="nf">
      <p className="nf-name">
        {site.name}{" "}
        <span lang="ar" dir="rtl">
          {site.nameAr}
        </span>
      </p>
      <h1 className="nf-title">{notFound.title}</h1>
      <p className="nf-line">{notFound.line}</p>
      <p>
        <a className="pill pill-solid" href="/">
          {notFound.home}
        </a>
      </p>
    </main>
  );
}
