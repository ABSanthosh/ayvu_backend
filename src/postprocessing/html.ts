import { minify } from "html-minifier-next";

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

export async function cleanUpHTMLGeneration(arxivId: string): Promise<void> {
  // delete all "*.log" from the htmlPath directory
  // delete all "*.cache" from the htmlPath directory
  for await (const dirEntry of Deno.readDir(`./tmp/${arxivId}/html`)) {
    if (
      dirEntry.isFile &&
      (dirEntry.name.endsWith(".log") || dirEntry.name.endsWith(".cache"))
    ) {
      await Deno.remove(`./tmp/${arxivId}/html/${dirEntry.name}`);
    }
  }
}
