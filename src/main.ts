import { Application, Router } from "@oak/oak";
import { downloadArxivSource, extractTarball } from "./process_arxiv.ts";
import { compileLatex } from "./process_latex.ts";
import { cleanUpHTMLGeneration } from "./postprocessing/html.ts";
import { postprocess } from "./postprocessing/index.ts";
import MakeDriveGreatAgain from "./process_drive.ts";
import { generateWeights } from "./embedding/index.ts";
import { ProgressWorker } from "./progress/progress-worker.ts";
import { ModuleProgress, ProgressUpdate } from "./progress/progress.ts";

if (import.meta.main) {
  // Remove everything in the tmp directory
  // try {
  //   await Deno.remove("./tmp", { recursive: true });
  // } catch {
  //   // ignore
  // }
  // await Deno.mkdir("./tmp");

  const router = new Router();
  const progressWorker = new ProgressWorker();

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

    ctx.response.headers.set("Content-Type", "text/event-stream");
    ctx.response.headers.set("Cache-Control", "no-cache");
    ctx.response.headers.set("Connection", "keep-alive");

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

    const stream = new ReadableStream({
      start(controller) {
        const userHash = progressWorker.registerClient(
          access_token,
          refresh_token,
          arxivId,
          controller
        );

        (async () => {
          try {
            // await downloadArxivSource(arxivId, userHash, progressWorker);
            // await extractTarball(arxivId, userHash, progressWorker);
            // await compileLatex(arxivId, userHash, progressWorker);
            // postprocess(arxivId, userHash, progressWorker);
            // await cleanUpHTMLGeneration(arxivId, userHash, progressWorker);
            await generateWeights(arxivId, userHash, progressWorker);

            // const drive = new MakeDriveGreatAgain({
            //   accessToken: access_token,
            //   refreshToken: refresh_token,
            //   userHash: userHash,
            //   progressWorker: progressWorker,
            // });
            // await drive.uploadPaper(arxivId);
          } catch (error) {
            ctx.response.status = 500;
            ctx.response.body = {
              error: error instanceof Error ? error.message : String(error),
            };
          }
        })();
      },
      cancel() {
        // Clean up on client disconnection
        const userHash = progressWorker.userHash(access_token, refresh_token);
        const session = progressWorker.sessions.get(userHash);
        if (session) {
          session.clients.delete(userHash + "-" + arxivId);
          if (session.tasks.size === 0 && session.clients.size === 0) {
            progressWorker.sessions.delete(userHash);
          }
        }
      },
    });

    ctx.response.body = stream;
  });

  const app = new Application();
  app.use(router.routes());
  app.use(router.allowedMethods());

  await app.listen({ port: 8000 });
}
