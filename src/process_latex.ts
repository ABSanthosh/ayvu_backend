import { ProgressWorker } from "./progress/progress-worker.ts";
import {
  ProcessingStatus,
  ProcessingStep,
  ProgressUpdate,
} from "./progress/progress.ts";

async function findStyFiles(latexDir: string): Promise<string[]> {
  const styFiles: string[] = [];

  try {
    // Check if directory exists and is accessible
    const dirStat = await Deno.stat(latexDir).catch(() => null);
    if (!dirStat || !dirStat.isDirectory) {
      console.warn(`LaTeX directory not found or not accessible: ${latexDir}`);
      return styFiles;
    }

    // Collect all .sty files (case-insensitive)
    for await (const dirEntry of Deno.readDir(latexDir)) {
      if (dirEntry.isFile && /\.sty$/i.test(dirEntry.name)) {
        const fullPath = `${latexDir}/${dirEntry.name}`;
        styFiles.push(fullPath);
        console.log(`Found .sty file: ${dirEntry.name}`);
      }
    }

    console.log(`Found ${styFiles.length} .sty files in ${latexDir}`);
    return styFiles;
  } catch (error) {
    console.error(
      `Error while searching for .sty files in ${latexDir}:`,
      error
    );
    return styFiles;
  }
}

async function findLtxmlFiles(latexDir: string): Promise<string[]> {
  const ltxmlFiles: string[] = [];

  try {
    // Check if directory exists and is accessible
    const dirStat = await Deno.stat(latexDir).catch(() => null);
    if (!dirStat || !dirStat.isDirectory) {
      console.warn(`LaTeX directory not found or not accessible: ${latexDir}`);
      return ltxmlFiles;
    }

    // Collect all .ltxml files (case-insensitive)
    for await (const dirEntry of Deno.readDir(latexDir)) {
      if (dirEntry.isFile && /\.ltxml$/i.test(dirEntry.name)) {
        const fullPath = `${latexDir}/${dirEntry.name}`;
        ltxmlFiles.push(fullPath);
        console.log(`Found .ltxml file: ${dirEntry.name}`);
      }
    }

    console.log(`Found ${ltxmlFiles.length} .ltxml files in ${latexDir}`);
    return ltxmlFiles;
  } catch (error) {
    console.error(
      `Error while searching for .ltxml files in ${latexDir}:`,
      error
    );
    return ltxmlFiles;
  }
}

async function findTexFile(latexDir: string): Promise<string | null> {
  try {
    // Check if directory exists and is accessible
    const dirStat = await Deno.stat(latexDir).catch(() => null);
    if (!dirStat || !dirStat.isDirectory) {
      console.warn(`LaTeX directory not found or not accessible: ${latexDir}`);
      return null;
    }

    const texFiles: string[] = [];
    const priorityPatterns = [
      /^main\.tex$/i,
      /^paper\.tex$/i,
      /^manuscript\.tex$/i,
      /^article\.tex$/i,
      /^thesis\.tex$/i,
      /^document\.tex$/i,
    ];

    // Collect all .tex files (case-insensitive)
    for await (const dirEntry of Deno.readDir(latexDir)) {
      if (dirEntry.isFile && /\.tex$/i.test(dirEntry.name)) {
        texFiles.push(dirEntry.name);
      }
    }

    if (texFiles.length === 0) {
      console.warn(`No .tex files found in directory: ${latexDir}`);
      return null;
    }

    // First, try to find files matching priority patterns
    for (const pattern of priorityPatterns) {
      const matchingFile = texFiles.find((file) => pattern.test(file));
      if (matchingFile) {
        console.log(`Found priority .tex file: ${matchingFile}`);
        return `${latexDir}/${matchingFile}`;
      }
    }

    // If no priority files found, look for files containing \documentclass
    for (const texFile of texFiles) {
      try {
        const filePath = `${latexDir}/${texFile}`;
        const content = await Deno.readTextFile(filePath);

        // Look for \documentclass in the first few lines (typically should be near the top)
        const lines = content.split("\n").slice(0, 50);
        const hasDocumentClass = lines.some((line) =>
          /\\documentclass\s*(\[.*?\])?\s*\{/.test(line.trim())
        );

        if (hasDocumentClass) {
          console.log(`Found .tex file with \\documentclass: ${texFile}`);
          return filePath;
        }
      } catch (error) {
        console.warn(`Could not read .tex file ${texFile}: ${error}`);
        continue;
      }
    }

    // If still no main file found, return the first .tex file
    const firstTexFile = texFiles[0];
    console.log(
      `Using first available .tex file: ${firstTexFile} (found ${texFiles.length} total)`
    );
    return `${latexDir}/${firstTexFile}`;
  } catch (error) {
    console.error(
      `Error while searching for .tex files in ${latexDir}:`,
      error
    );
    return null;
  }
}

export async function compileLatex(
  arxivId: string,
  userHash?: string,
  progressWorker?: ProgressWorker
): Promise<void> {
  const htmlPath = `./tmp/${arxivId}/html`;
  await Deno.mkdir(htmlPath, { recursive: true });
  const rootPath = Deno.cwd();
  const latexDir = rootPath + `/tmp/${arxivId}/latex`;

  // Deno.chdir(`./tmp/${arxivId}/latex`);
  const texFile = await findTexFile(latexDir);

  if (!texFile) {
    throw new Error(`No .tex file found for arXiv ID ${arxivId}`);
  }

  // Find any .sty files in the latex directory
  const styFiles = await findStyFiles(latexDir);
  const ltxmlFiles = await findLtxmlFiles(latexDir);

  Deno.chdir(htmlPath);

  const latexmlArgs = [
    "--format=html5",
    // "--mathtex",
    "--nocomments",
    "--quiet",
    "--navigationtoc=context",
    "--nodefaultresources",
    "--timestamp=0",
    // "--javascript=https://cdn.jsdelivr.net/npm/mathjax@4/es5/tex-mml-chtml.js?config=MML_HTMLorMML",
    "--path=/home/santhosh/Desktop/Projects/TypeScript/2025/1_Ayvu/latexml/src/latexml/packages",
    "--path=/home/santhosh/Desktop/Projects/TypeScript/2025/1_Ayvu/latexml/src/latexml/bindings",
    "--path=/home/santhosh/Desktop/Projects/TypeScript/2025/1_Ayvu/latexml/src/latexml/originals",
    "--path=/home/santhosh/Desktop/Projects/TypeScript/2025/1_Ayvu/latexml/src/latexml/supported_originals",
    "--includestyles",
    ...ltxmlFiles.flatMap((ltxmlFile) => ["--preload", ltxmlFile]),
    "--xsltparameter=SIMPLIFY_HTML:true",
    "--destination=./paper.html",
    "--preload=/home/santhosh/Desktop/Projects/TypeScript/2025/1_Ayvu/latexml/src/latexml/engrafo.ltxml",
    "--preload=LaTeX.pool",
    "--preload=[noproblems]article.cls",
    "--preload=[noproblems]amsmath.sty",
    "--preload=[noproblems]amsthm.sty",
    "--preload=[noproblems]graphicx.sty",
    "--preload=[noproblems]hyperref.sty",
    "--preload=[noproblems]natbib.sty",
    "--preload=[noproblems]booktabs.sty",
    "--preload=[noproblems]makecell.sty",
    "--preload=[noproblems]multirow.sty",
    "--preload=[noproblems]siunitx.sty",
    "--preload=[noproblems]algorithm.sty",
    "--preload=[noproblems]algorithmic.sty",
    texFile,
  ];

  progressWorker?.postProgress({
    userHash,
    arxivId,
    step: ProcessingStep.COMPILE_LATEX,
    progress: {
      status: ProcessingStatus.IN_PROGRESS,
      message: "Starting LaTeX compilation with LaTeXML",
    },
  } as ProgressUpdate);

  const command = new Deno.Command("latexmlc", {
    args: latexmlArgs,
  });

  const { code, stderr } = await command.output();

  if (code !== 0) {
    throw new Error(
      `Latexml compilation failed with code ${code}: ${
        stderr ? new TextDecoder().decode(stderr) : "No stderr"
      }`
    );
  }

  progressWorker?.postProgress({
    userHash,
    arxivId,
    step: ProcessingStep.COMPILE_LATEX,
    progress: {
      status: ProcessingStatus.COMPLETED,
      message: "LaTeX compilation completed successfully",
    },
  } as ProgressUpdate);

  Deno.chdir(rootPath);
  // Clean up the latex directory to save space
  // await Deno.remove(`./tmp/${arxivId}/latex`, { recursive: true });
}
