/**
 * A real space between words that are set as separate boxes (the caption's and the ending's words, a label and its
 * Arabic): it is in the text that search engines, AI crawlers and screen readers read ("Every idea", never
 * "Everyidea"), and takes no width (`.wgap`), so the words' own margins still space them on screen.
 */
export function Gap() {
  return <span className="wgap"> </span>;
}
