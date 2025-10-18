import { Application, Router } from "@oak/oak";
import { downloadArxivSource, extractTarball } from "./process_arxiv.ts";
import { compileLatex } from "./process_latex.ts";
import { cleanUpHTMLGeneration } from "./postprocessing/html.ts";
import { postprocess } from "./postprocessing/index.ts";
import { uploadToGoogleDrive } from "./process_drive.ts";
import { generateWeights } from "./embedding/index.ts";

if (import.meta.main) {
  // Remove everything in the tmp directory
  // try {
  //   await Deno.remove("./tmp", { recursive: true });
  // } catch {
  //   // ignore
  // }
  // await Deno.mkdir("./tmp");

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

    // Get tokens from URL parameters
    const refresh_token = ctx.request.url.searchParams.get("refresh_token");
    const access_token = ctx.request.url.searchParams.get("access_token");

    if (!access_token || !refresh_token) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: "Missing 'access_token' or 'refresh_token' query parameters",
      };
      return;
    }

    try {
      await downloadArxivSource(arxivId);
      await extractTarball(arxivId);
      await compileLatex(arxivId);
      postprocess(arxivId);
      await cleanUpHTMLGeneration(arxivId);
      await generateWeights(arxivId);

      const folderId = await uploadToGoogleDrive(arxivId, {
        accessToken: access_token,
        refreshToken: refresh_token,
      });

      ctx.response.body = {
        message: "Extraction and upload successful",
        folderId: folderId,
      };
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
