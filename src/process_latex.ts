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
      /^document\.tex$/i
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
      const matchingFile = texFiles.find(file => pattern.test(file));
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
        const lines = content.split('\n').slice(0, 50);
        const hasDocumentClass = lines.some(line => 
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
    console.log(`Using first available .tex file: ${firstTexFile} (found ${texFiles.length} total)`);
    return `${latexDir}/${firstTexFile}`;

  } catch (error) {
    console.error(`Error while searching for .tex files in ${latexDir}:`, error);
    return null;
  }
}

export async function compileLatex(arxivId: string): Promise<void> {
  const htmlPath = `./tmp/${arxivId}/html`;
  await Deno.mkdir(htmlPath, { recursive: true });
  const rootPath = Deno.cwd();
  const latexDir = rootPath + `/tmp/${arxivId}/latex`;

  // Deno.chdir(`./tmp/${arxivId}/latex`);
  const texFile = await findTexFile(latexDir);
  console.log(texFile)
  if (!texFile) {
    throw new Error(`No .tex file found for arXiv ID ${arxivId}`);
  }

  Deno.chdir(htmlPath);

  const latexmlArgs = [
    "--format",
    "html5",
    // "--mathtex",
    "--nocomments",
    "--quiet",
    "--navigationtoc",
    "context",
    "--nodefaultresources",
    "--timestamp",
    "0",
    "--javascript",
    "https://cdn.jsdelivr.net/npm/mathjax@4/es5/tex-mml-chtml.js?config=MML_HTMLorMML",
    "--path",
    "/home/santhosh/Desktop/Projects/TypeScript/2025/1_Ayvu/latexml/src/latexml/packages",
    "--preload",
    "/home/santhosh/Desktop/Projects/TypeScript/2025/1_Ayvu/latexml/src/latexml/engrafo.ltxml",
    // "--preload", "/usr/share/perl5/LaTeXML/Package/hyperref.sty.ltxml",
    "--xsltparameter",
    "SIMPLIFY_HTML:true",
    "--destination",
    `./paper.html`,
    texFile,
  ];

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

  Deno.chdir(rootPath);
  // Clean up the latex directory to save space
  await Deno.remove(`./tmp/${arxivId}/latex`, { recursive: true });
}