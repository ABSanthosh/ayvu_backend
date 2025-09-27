import { Application, Router } from "@oak/oak";
import { downloadArxivSource, extractTarball } from "./process_arxiv.ts";
import { compileLatex } from "./process_latex.ts";
import { cleanUpHTMLGeneration } from "./postprocessing/html.ts";
import { postprocess } from "./postprocessing/index.ts";

if (import.meta.main) {
  // Remove everything in the tmp directory
  try {
    await Deno.remove("./tmp", { recursive: true });
  } catch {
    // ignore
  }
  await Deno.mkdir("./tmp");

  const router = new Router();

  router.get("/", (ctx) => {
    ctx.response.body = "Hello world";
  });

  router.get("/arxiv/:id", async (ctx) => {
    const arxivId = ctx.params.id;
    if (!arxivId) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Missing 'id' parameter" };
      return;
    }

    try {
      await downloadArxivSource(arxivId);
      await extractTarball(arxivId);
      await compileLatex(arxivId);
      await postprocess(arxivId);
      await cleanUpHTMLGeneration(arxivId);

      ctx.response.body = { message: "Extraction successful" };
    } catch (error) {
      ctx.response.status = 500;
      ctx.response.body = {
        error: error instanceof Error ? error.message : String(error),
      };
    }
  });

  const app = new Application();
  app.use(router.routes());
  app.use(router.allowedMethods());

  await app.listen({ port: 8000 });
}
