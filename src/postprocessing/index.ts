import { JSDOM } from "jsdom";
import processFigures from "./figures.ts";
import processFootnotes from "./footnotes.ts";
import processHeadings from "./headings.ts";
import processLinks from "./links.ts";
import processMath from "./math.ts";
import processInlineStyles from "./styles.ts";
import { ProgressWorker } from "../progress/progress-worker.ts";
import {
  ProcessingStatus,
  ProcessingStep,
  ProgressUpdate,
} from "../progress/progress.ts";
// import { minifyHTML } from "./html.ts";

export function postprocess(
  arxivId: string,
  userHash?: string,
  progressWorker?: ProgressWorker
): void {
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
  progressWorker?.postProgress({
    userHash,
    arxivId,
    step: ProcessingStep.POSTPROCESS,
    progress: {
      status: ProcessingStatus.COMPLETED,
      message: "Post-processing completed successfully",
    },
  } as ProgressUpdate);
}
