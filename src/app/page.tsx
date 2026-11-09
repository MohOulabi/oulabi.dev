import type { Metadata } from "next";
import { Chrome } from "@/components/chrome";
import { Cursor } from "@/components/cursor";
import { Experience } from "@/components/experience";
import { FullCV } from "@/components/full-cv";
import { Record } from "@/components/sections/record";
import { Show } from "@/components/sections/show";
import { abs, jsonLdScript } from "@/content/seo";
import { names, seo, site } from "@/content/site";

/** The profile's head, for search, social cards and AI search: every word from src/content/site.ts (seo, names). */
export const metadata: Metadata = {
  alternates: {
    canonical: abs("/"),
    // the same profile in plain markdown, for AI search and assistants (llmstxt.org)
    types: {
      "text/markdown": [
        { url: "/llms.txt", title: `${site.name}: profile for AI search (llms.txt)` },
        { url: "/llms-full.txt", title: `${site.name}: full profile and CV (llms-full.txt)` },
      ],
    },
  },
  robots: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
    "max-video-preview": -1,
  },
  openGraph: {
    type: "profile",
    firstName: names.given,
    lastName: names.family,
    username: names.handles[1],
    title: seo.socialTitle,
    description: seo.description,
    url: abs("/"),
    siteName: site.name,
    locale: "en_US",
    images: [{ ...seo.ogImage, type: "image/jpeg" }],
  },
  twitter: {
    card: "summary_large_image",
    title: seo.socialTitle,
    description: seo.description,
    images: [{ url: seo.ogImage.url, alt: seo.ogImage.alt }],
  },
};

/**
 * Runs as soon as it is parsed, before hydration: a reload never restores the old scroll position (the journey starts
 * at the top, the light waiting for the hold; a hash such as #work still lands there: src/lib/scroll.ts), the layout
 * mode (flow for reduced motion and ?q=static), and the loader dot that follows the pointer from the first frame. Its
 * ring is real load progress (src/bridges/boot.ts), whether a button is down (`b`) and when the page last scrolled (`s`):
 * a scrollbar dragged, or a scroll still gliding, as the gate takes over is the visitor's own hand, never an explicit
 * move (src/lib/scroll.ts). While the stage loads it also holds the page at the top (a
 * wheel, a finger, the scroll keys, the scrollbar dragged: the first screen's gate, which src/lib/scroll.ts takes over
 * and releases this hold for); never in the flow layout, never for a link with a hash, and never past 15 s, so a page
 * whose script failed still scrolls.
 */
const BOOT = `(function(){var d=document.documentElement;try{if('scrollRestoration' in history)history.scrollRestoration='manual'}catch(e){}try{var m=localStorage.getItem('launch-night:motion');if(m==='reduce'||(m!=='full'&&matchMedia('(prefers-reduced-motion: reduce)').matches)){d.classList.add('reduce-motion','flow')}}catch(e){}
if(d.classList.contains('no-stage'))d.classList.add('flow');
var c=document.getElementById('nq-cursor');var p=window.__nuqtaPointer={x:innerWidth/2,y:innerHeight/2,seen:false,b:0};
function put(){if(!window.__nuqtaLive&&c){c.style.transform='translate3d('+p.x+'px,'+p.y+'px,0)'}}
function mv(e){p.x=e.clientX;p.y=e.clientY;p.seen=true;p.b=e.buttons;if(e.pointerType==='mouse')d.classList.add('has-pointer');put()}
addEventListener('pointermove',mv,{passive:true});addEventListener('pointerdown',mv,{passive:true});addEventListener('pointerup',function(e){p.b=e.buttons},{passive:true});addEventListener('pointercancel',function(){p.b=0},{passive:true});put();
var ho={passive:false,capture:true};function hd(e){if(d.classList.contains('flow')||location.hash.length>1||performance.now()>15000)return;if(e.type==='wheel'){if(e.ctrlKey||e.deltaY<=0)return}else if(e.type==='touchmove'){if(e.touches.length!==1)return}else{var y=e.key,t=e.target;if(!(y===' '||y==='PageDown'||y==='End'||y==='ArrowDown'))return;if(t&&t.closest&&t.closest('input,textarea,select,button,[contenteditable]'))return}if(e.cancelable)e.preventDefault()}
function sc(){p.s=performance.now();if(p.b&&scrollY>0&&!d.classList.contains('flow')&&location.hash.length<2&&performance.now()<15000)scrollTo(0,0)}
window.__nuqtaUnhold=function(){removeEventListener('wheel',hd,ho);removeEventListener('touchmove',hd,ho);removeEventListener('keydown',hd,ho);removeEventListener('scroll',sc)};if(!d.classList.contains('flow')){addEventListener('wheel',hd,ho);addEventListener('touchmove',hd,ho);addEventListener('keydown',hd,ho);addEventListener('scroll',sc,{passive:true})}
var k=0,ring=document.getElementById('nq-load');window.__nuqtaBoot=function(v){if(v<=k)return;k=v;if(ring)ring.style.strokeDashoffset=String(100-100*k)};window.__nuqtaBoot(0.1);
document.addEventListener('DOMContentLoaded',function(){window.__nuqtaBoot(0.16)});try{document.fonts.ready.then(function(){window.__nuqtaBoot(0.22)})}catch(e){}})();`;

export default function Page() {
  return (
    <>
      <div className="sky-css" aria-hidden="true" />
      <div className="scrim" aria-hidden="true" />
      <Cursor />
      <script
        // biome-ignore lint/security/noDangerouslySetInnerHtml: static inline boot script
        dangerouslySetInnerHTML={{ __html: BOOT }}
      />
      {/* who he is, for search engines: one @graph (WebSite, ProfilePage, Person, his work, his CV), src/content/seo.ts */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD
        dangerouslySetInnerHTML={{ __html: jsonLdScript() }}
      />
      {/* his profiles elsewhere are the same person (React hoists these links into the head) */}
      <link rel="me" href={site.linkedin} />
      <link rel="me" href={site.github} />
      <Chrome />
      <Show />
      <Record />
      <Experience />
      <FullCV />
    </>
  );
}
