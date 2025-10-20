import { ProgressWorker } from "../progress/progress-worker.ts";
import {
  ProcessingStatus,
  ProcessingStep,
  ProgressUpdate,
} from "../progress/progress.ts";
import { Chunker, type Chunk } from "./chunker.ts";
import { EmbeddingModel, Embeddings } from "./worker.ts";

export async function generateWeights(
  arxivId: string,
  userHash?: string,
  progressWorker?: ProgressWorker,
  numChunks = 2048
): Promise<void> {
  const html = Deno.readTextFileSync(`./tmp/${arxivId}/html/paper.html`);
  const htmlChunks: Chunk[] = new Chunker(html, numChunks).getChunks();

  const startTime = Date.now();
  const embeddingInstance = new Embeddings(
    arxivId,
    EmbeddingModel.embeddingGemma,
    (message) => {
      progressWorker?.postProgress({
        userHash,
        arxivId,
        step: ProcessingStep.GENERATE_WEIGHTS,
        progress: {
          status: ProcessingStatus.IN_PROGRESS,
          message,
        },
      } as ProgressUpdate);
    }
  );

  await embeddingInstance.init();
  const result = await embeddingInstance!.startExtractEmbedding(htmlChunks);

  if (result.command === "finishExtractEmbedding") {
    const index = result.payload.chunks.map((chunk, idx) => ({
      metadata: chunk,
      embedding: result.payload.embeddings[idx],
    }));

    await Deno.writeTextFile(
      `./tmp/${arxivId}/html/embeddings.json`,
      JSON.stringify(index),
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
    console.log(`It took ${Date.now() - startTime} ms to generate embeddings.`);
  }
}
