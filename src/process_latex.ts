async function findTexFile(latexDir: string): Promise<string | null> {
  for await (const dirEntry of Deno.readDir(latexDir)) {
    if (dirEntry.isFile && dirEntry.name.endsWith(".tex")) {
      return `${latexDir}/${dirEntry.name}`;
    }
  }
  return null;
}

export async function compileLatex(arxivId: string): Promise<void> {
  const htmlPath = `./tmp/${arxivId}/html`;
  await Deno.mkdir(htmlPath, { recursive: true });
  const rootPath = Deno.cwd();
  const latexDir = rootPath + `/tmp/${arxivId}/latex`;

  // Deno.chdir(`./tmp/${arxivId}/latex`);
  const texFile = await findTexFile(latexDir);
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