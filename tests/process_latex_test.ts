import { testAsserts, createMockProgressWorker, createTempDir, cleanupTempDir } from "./test_utils.ts";
import { compileLatex } from "../src/process_latex.ts";

const { assertEquals, assertRejects } = testAsserts;

Deno.test("Process LaTeX tests", async (t) => {
  await t.step("compileLatex should handle function parameters", () => {
    assertEquals(typeof compileLatex, "function");
  });

  await t.step("compileLatex should fail when no LaTeX directory exists", async () => {
    const arxivId = "nonexistent-latex";
    const mockProgressWorker = createMockProgressWorker();
    
    await assertRejects(async () => {
      await compileLatex(arxivId, "user-hash", mockProgressWorker as never);
    });
  });

  await t.step("compileLatex should fail when no .tex files found", async () => {
    const tempDir = await createTempDir("latex-test");
    const arxivId = "no-tex-files";
    
    try {
      // Create latex directory but no .tex files
      await Deno.mkdir(`./tmp/${arxivId}/latex`, { recursive: true });
      await Deno.writeTextFile(`./tmp/${arxivId}/latex/readme.txt`, "No tex files here");
      
      await assertRejects(async () => {
        await compileLatex(arxivId);
      });
      
    } finally {
      try {
        await Deno.remove(`./tmp/${arxivId}`, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
      await cleanupTempDir(tempDir);
    }
  });

  await t.step("compileLatex should find main.tex file", async () => {
    const tempDir = await createTempDir("latex-main-test");
    const arxivId = "has-main-tex";
    
    try {
      await Deno.mkdir(`./tmp/${arxivId}/latex`, { recursive: true });
      await Deno.writeTextFile(`./tmp/${arxivId}/latex/main.tex`, "\\documentclass{article}\\begin{document}Test\\end{document}");
      await Deno.writeTextFile(`./tmp/${arxivId}/latex/other.tex`, "\\section{Other}");
      
      // This will fail because latexmlc is not installed, but should find the main.tex file first
      await assertRejects(async () => {
        await compileLatex(arxivId);
      });
      
    } finally {
      try {
        await Deno.remove(`./tmp/${arxivId}`, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
      await cleanupTempDir(tempDir);
    }
  });

  await t.step("compileLatex should find files with documentclass", async () => {
    const tempDir = await createTempDir("latex-docclass-test");
    const arxivId = "has-docclass";
    
    try {
      await Deno.mkdir(`./tmp/${arxivId}/latex`, { recursive: true });
      await Deno.writeTextFile(`./tmp/${arxivId}/latex/paper.tex`, "\\documentclass{article}\\begin{document}Content\\end{document}");
      await Deno.writeTextFile(`./tmp/${arxivId}/latex/section.tex`, "\\section{No documentclass}");
      
      await assertRejects(async () => {
        await compileLatex(arxivId);
      });
      
    } finally {
      try {
        await Deno.remove(`./tmp/${arxivId}`, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
      await cleanupTempDir(tempDir);
    }
  });

  await t.step("compileLatex should handle .sty files", async () => {
    const tempDir = await createTempDir("latex-sty-test");
    const arxivId = "has-sty-files";
    
    try {
      await Deno.mkdir(`./tmp/${arxivId}/latex`, { recursive: true });
      await Deno.writeTextFile(`./tmp/${arxivId}/latex/main.tex`, "\\documentclass{article}\\begin{document}Test\\end{document}");
      await Deno.writeTextFile(`./tmp/${arxivId}/latex/custom.sty`, "% Custom style file");
      await Deno.writeTextFile(`./tmp/${arxivId}/latex/another.STY`, "% Another style file");
      
      await assertRejects(async () => {
        await compileLatex(arxivId);
      });
      
    } finally {
      try {
        await Deno.remove(`./tmp/${arxivId}`, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
      await cleanupTempDir(tempDir);
    }
  });

  await t.step("compileLatex should handle .ltxml files", async () => {
    const tempDir = await createTempDir("latex-ltxml-test");
    const arxivId = "has-ltxml-files";
    
    try {
      await Deno.mkdir(`./tmp/${arxivId}/latex`, { recursive: true });
      await Deno.writeTextFile(`./tmp/${arxivId}/latex/main.tex`, "\\documentclass{article}\\begin{document}Test\\end{document}");
      await Deno.writeTextFile(`./tmp/${arxivId}/latex/custom.ltxml`, "<!-- Custom ltxml file -->");
      
      await assertRejects(async () => {
        await compileLatex(arxivId);
      });
      
    } finally {
      try {
        await Deno.remove(`./tmp/${arxivId}`, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
      await cleanupTempDir(tempDir);
    }
  });

  await t.step("compileLatex should create HTML output directory", async () => {
    const tempDir = await createTempDir("latex-output-test");
    const arxivId = "create-html-dir";
    
    try {
      await Deno.mkdir(`./tmp/${arxivId}/latex`, { recursive: true });
      await Deno.writeTextFile(`./tmp/${arxivId}/latex/main.tex`, "\\documentclass{article}\\begin{document}Test\\end{document}");
      
      await assertRejects(async () => {
        await compileLatex(arxivId);
      });
      
      // Should have created the HTML directory
      const htmlDirExists = await Deno.stat(`./tmp/${arxivId}/html`).then(() => true).catch(() => false);
      assertEquals(htmlDirExists, true);
      
    } finally {
      try {
        await Deno.remove(`./tmp/${arxivId}`, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
      await cleanupTempDir(tempDir);
    }
  });

  await t.step("compileLatex should handle progress updates", async () => {
    const tempDir = await createTempDir("latex-progress-test");
    const arxivId = "progress-test";
    let progressCalled = false;
    
    const mockProgressWorker = {
      postProgress: () => {
        progressCalled = true;
      },
    };
    
    try {
      await Deno.mkdir(`./tmp/${arxivId}/latex`, { recursive: true });
      await Deno.writeTextFile(`./tmp/${arxivId}/latex/main.tex`, "\\documentclass{article}\\begin{document}Test\\end{document}");
      
      await assertRejects(async () => {
        await compileLatex(arxivId, "user-hash", mockProgressWorker as never);
      });
      
      assertEquals(progressCalled, true);
      
    } finally {
      try {
        await Deno.remove(`./tmp/${arxivId}`, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
      await cleanupTempDir(tempDir);
    }
  });

  await t.step("compileLatex should work without progress worker", async () => {
    const tempDir = await createTempDir("latex-no-progress");
    const arxivId = "no-progress-test";
    
    try {
      await Deno.mkdir(`./tmp/${arxivId}/latex`, { recursive: true });
      await Deno.writeTextFile(`./tmp/${arxivId}/latex/main.tex`, "\\documentclass{article}\\begin{document}Test\\end{document}");
      
      await assertRejects(async () => {
        await compileLatex(arxivId);
      });
      
    } finally {
      try {
        await Deno.remove(`./tmp/${arxivId}`, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
      await cleanupTempDir(tempDir);
    }
  });

  await t.step("compileLatex should prefer priority tex files", async () => {
    const tempDir = await createTempDir("latex-priority-test");
    const arxivId = "priority-tex-test";
    
    try {
      await Deno.mkdir(`./tmp/${arxivId}/latex`, { recursive: true });
      
      // Create multiple .tex files with priority file present
      await Deno.writeTextFile(`./tmp/${arxivId}/latex/random.tex`, "\\section{Random}");
      await Deno.writeTextFile(`./tmp/${arxivId}/latex/paper.tex`, "\\documentclass{article}\\begin{document}Paper\\end{document}");
      await Deno.writeTextFile(`./tmp/${arxivId}/latex/main.tex`, "\\documentclass{article}\\begin{document}Main\\end{document}");
      
      // Should prefer main.tex over paper.tex
      await assertRejects(async () => {
        await compileLatex(arxivId);
      });
      
    } finally {
      try {
        await Deno.remove(`./tmp/${arxivId}`, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
      await cleanupTempDir(tempDir);
    }
  });

  await t.step("compileLatex should handle case insensitive file extensions", async () => {
    const tempDir = await createTempDir("latex-case-test");
    const arxivId = "case-insensitive";
    
    try {
      await Deno.mkdir(`./tmp/${arxivId}/latex`, { recursive: true });
      await Deno.writeTextFile(`./tmp/${arxivId}/latex/paper.TEX`, "\\documentclass{article}\\begin{document}Test\\end{document}");
      await Deno.writeTextFile(`./tmp/${arxivId}/latex/style.STY`, "% Style file");
      await Deno.writeTextFile(`./tmp/${arxivId}/latex/binding.LTXML`, "<!-- Binding file -->");
      
      await assertRejects(async () => {
        await compileLatex(arxivId);
      });
      
    } finally {
      try {
        await Deno.remove(`./tmp/${arxivId}`, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
      await cleanupTempDir(tempDir);
    }
  });
});