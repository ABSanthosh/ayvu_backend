import { minify } from "html-minifier-next";
import { ProgressWorker } from "../progress/progress-worker.ts";
import {
  ProcessingStatus,
  ProcessingStep,
  ProgressUpdate,
} from "../progress/progress.ts";

export async function minifyHTML(htmlContent: string): Promise<string> {
  // https://github.com/coderaiser/minify/blob/4481835bfad167ded4045005ee80d043373b8c5e/lib/html.js#L5
  return await minify(htmlContent, {
    removeComments: true,
    removeCommentsFromCDATA: true,
    removeCDATASectionsFromCDATA: true,
    collapseWhitespace: true,
    collapseBooleanAttributes: true,
    removeAttributeQuotes: true,
    removeRedundantAttributes: true,
    useShortDoctype: true,
    removeEmptyAttributes: true,
    removeEmptyElements: false,
    removeOptionalTags: true,
    removeScriptTypeAttributes: true,
    removeStyleLinkTypeAttributes: true,
    minifyJS: true,
    minifyCSS: true,
  });
}

export async function cleanUpHTMLGeneration(
  arxivId: string,
  userHash?: string,
  progressWorker?: ProgressWorker
): Promise<void> {
  // delete all "*.log" from the htmlPath directory
  // delete all "*.cache" from the htmlPath directory
  for await (const dirEntry of Deno.readDir(`./tmp/${arxivId}/html`)) {
    if (
      dirEntry.isFile &&
      (dirEntry.name.endsWith(".log") || dirEntry.name.endsWith(".cache"))
    ) {
      progressWorker?.postProgress({
        userHash,
        arxivId,
        step: ProcessingStep.POSTPROCESS,
        progress: {
          status: ProcessingStatus.IN_PROGRESS,
          message: `Cleaning up ${dirEntry.name} file`,
        },
      } as ProgressUpdate);

      await Deno.remove(`./tmp/${arxivId}/html/${dirEntry.name}`);
    }
  }

  // remove tmp/${arxivId}/latex directory
  await Deno.remove(`./tmp/${arxivId}/latex`, { recursive: true });

  progressWorker?.postProgress({
    userHash,
    arxivId,
    step: ProcessingStep.POSTPROCESS,
    progress: {
      status: ProcessingStatus.COMPLETED,
      message: "HTML generation cleanup completed successfully",
    },
  } as ProgressUpdate);
}
