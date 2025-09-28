import { JSDOM } from "jsdom";
import processFigures from "./figures.ts";
import processFootnotes from "./footnotes.ts";
import processHeadings from "./headings.ts";
import processLinks from "./links.ts";
import processMath from "./math.ts";
import processInlineStyles from "./styles.ts";
// import { minifyHTML } from "./html.ts";

export function postprocess(arxivId: string): void {
  const htmlContent = Deno.readTextFileSync(`./tmp/${arxivId}/html/paper.html`);
  const dom = new JSDOM(htmlContent);
  const document = dom.window.document;

  processFigures(document);
  processFootnotes(document);
  processHeadings(document);
  processLinks(document);
  processMath(document);
  processInlineStyles(document);

  // const processedHTML = await minifyHTML(dom.serialize());
  const processedHTML = dom.serialize();
  Deno.writeTextFileSync(`./tmp/${arxivId}/html/paper.html`, processedHTML);
}
