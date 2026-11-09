/**
 * Fig. 11's star card (docs/STORY.md: hover a star to see which platform it is): a small note in the journal's hand
 * beside the platform star under the pointer, with a hairline to it: the platform's picture (Project.image), the
 * sector, its name, its line, his role (src/content/site.ts), and how to open it. Empty here; src/bridges/star-card.ts
 * fills it, places it beside its star every frame and fades it. Hidden from assistive tech: Work, after the show,
 * carries the same words as links.
 */
export function StarCard() {
  return (
    <div id="nq-star-card" className="star-card" aria-hidden="true">
      <span className="sc-lead" />
      <div className="sc-box">
        {/* biome-ignore lint/performance/noImgElement: a static export; the same file Work shows, decoded once */}
        <img className="sc-img" alt="" width={1440} height={900} decoding="async" />
        <p className="sc-kicker" />
        <p className="sc-name" />
        <p className="sc-line" />
        <p className="sc-role" />
        <p className="sc-open">
          <span className="sc-open-en" />
          <span className="sc-open-ar" lang="ar" dir="rtl" />
        </p>
      </div>
    </div>
  );
}
