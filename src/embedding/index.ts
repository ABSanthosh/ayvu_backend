import { Chunker, type Chunk } from "./chunker.ts";
import { EmbeddingMessages, EmbeddingModel } from "./worker.ts";

const embeddingWorker = new Worker(
  new URL("./worker.ts", import.meta.url).href,
  {
    type: "module",
  }
);

export function generateWeights(arxivId: string, numChunks = 2048): void {
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
  embeddingWorker.onmessage = async (event) => {
    const message = event.data as EmbeddingMessages;
    switch (message.command) {
      case "error":
        // console.error("Embedding Worker Error:", message.payload);
        break;
      case "progress":
        // console.log(
        //   `Embedding Progress [${message.payload.requestID}]: ${JSON.stringify(message.payload.progress)}%`
        // );
        break;
      case "finishExtractEmbedding":
        if (message.payload.requestID === arxivId) {
          embeddingWorker.terminate();
          await Deno.writeTextFile(
            `./tmp/${arxivId}/html/embeddings.json`,
            JSON.stringify(message.payload.embeddings)
          );
          return message.payload.embeddings.flat();
        }
    }
  };

  console.log(`It took ${Date.now() - startTime} ms to generate embeddings.`);
}
