import { ProgressWorker } from "../progress/progress-worker.ts";
import {
  ProcessingStatus,
  ProcessingStep,
  ProgressUpdate,
} from "../progress/progress.ts";
import { Chunker, type Chunk } from "./chunker.ts";
import { EmbeddingMessages, EmbeddingModel } from "./worker.ts";

const embeddingWorker = new Worker(
  new URL("./worker.ts", import.meta.url).href,
  {
    type: "module",
  }
);

export async function generateWeights(
  arxivId: string,
  userHash?: string,
  progressWorker?: ProgressWorker,
  numChunks = 2048
): Promise<void> {
  const html = Deno.readTextFileSync(`./tmp/${arxivId}/html/paper.html`);
  const htmlChunks: Chunk[] = new Chunker(html, numChunks).getChunks();
  embeddingWorker.postMessage({
    command: "startExtractEmbedding",
    payload: {
      chunks: htmlChunks,
      requestID: arxivId,
      model_id: EmbeddingModel.embeddingGemma,
    },
  } as EmbeddingMessages);
  const startTime = Date.now();

  let resolver: ((value: unknown) => void) | undefined = undefined;
  const workerPromise = new Promise((resolve) => (resolver = resolve));

  embeddingWorker.onmessage = async (event) => {
    const message = event.data as EmbeddingMessages;
    switch (message.command) {
      case "error":
        break;
      case "progress":
        progressWorker?.postProgress({
          userHash,
          arxivId,
          step: ProcessingStep.GENERATE_WEIGHTS,
          progress: {
            status: ProcessingStatus.IN_PROGRESS,
            message: message.payload.progress.status,
          },
        } as ProgressUpdate);
        break;
      case "finishExtractEmbedding":
        if (message.payload.requestID === arxivId) {
          embeddingWorker.terminate();
          await Deno.writeTextFile(
            `./tmp/${arxivId}/html/embeddings.json`,
            JSON.stringify(message.payload.embeddings)
          );

          progressWorker?.postProgress({
            userHash,
            arxivId,
            step: ProcessingStep.GENERATE_WEIGHTS,
            progress: {
              status: ProcessingStatus.COMPLETED,
              message: `Finished generating weights for ${arxivId}`,
            },
          } as ProgressUpdate);
          return message.payload.embeddings.flat();
        }
    }

    embeddingWorker.onmessage = (_) => {};
    resolver?.(message);
  };

  await workerPromise;
  console.log(`It took ${Date.now() - startTime} ms to generate embeddings.`);
}
