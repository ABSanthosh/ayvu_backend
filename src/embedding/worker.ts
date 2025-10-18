import {
  AutoModel,
  AutoTokenizer,
  env,
  type ProgressInfo,
  PreTrainedTokenizer,
  PreTrainedModel,
} from "@huggingface/transformers";
import type { Chunk } from "./chunker.ts";

env.allowLocalModels = true;
env.localModelPath = "./models";
env.allowRemoteModels = false;

const PREFIXES = {
  query: "task: search result | query: ",
  document: "title: {title} | text: ",
};

export enum EmbeddingModel {
  gteSmall = "gte-small",
  embeddingGemma = "onnx-community/embeddinggemma-300m-ONNX",
}

export type EmbeddingMessages =
  | {
      command: "startExtractEmbedding";
      payload: {
        requestID: string;
        chunks: Chunk[];
        model_id: EmbeddingModel;
      };
    }
  | {
      command: "finishExtractEmbedding";
      payload: {
        requestID: string;
        chunks: Chunk[];
        model_id: EmbeddingModel;
        embeddings: number[][];
      };
    }
  | {
      command: "startQueryEmbedding";
      payload: {
        requestID: string;
        query: string;
        model_id: EmbeddingModel;
      };
    }
  | {
      command: "finishQueryEmbedding";
      payload: {
        requestID: string;
        query: string;
        model_id: EmbeddingModel;
        embedding: number[];
      };
    }
  | {
      command: "error";
      payload: {
        requestID: string;
        originalCommand: string;
        message: string;
      };
    }
  | {
      command: "progress";
      payload: {
        requestID: string;
        originalCommand: string;
        progress: ProgressInfo;
      };
    };

class Embeddings {
  public progress: ProgressInfo | null = null;
  private model: PreTrainedModel | null = null;
  private tokenizer: PreTrainedTokenizer | null = null;
  private isInitialized: boolean = false;
  private taskQueue: Array<() => Promise<void>> = [];

  constructor(
    private requestID: string,
    private model_id: EmbeddingModel = EmbeddingModel.gteSmall
  ) {
    this.init();
  }

  private progress_callback(progress: ProgressInfo): void {
    this.progress = progress;
    postMessage({
      command: "progress",
      payload: {
        requestID: this.requestID,
        originalCommand: "init",
        progress,
      },
    });
  }

  public async init(): Promise<void> {
    try {
      [this.tokenizer, this.model] = await Promise.all([
        AutoTokenizer.from_pretrained(this.model_id, {
          progress_callback: this.progress_callback.bind(this),
          local_files_only: true,
        }),
        AutoModel.from_pretrained(this.model_id, {
          dtype: "q4",
          progress_callback: this.progress_callback.bind(this),
          local_files_only: true,
        }),
      ]);
      this.isInitialized = true;
      // Process any queued tasks
      console.log("Processing queued tasks:", this.taskQueue.length);
      await this.processTaskQueue();
    } catch (error) {
      const message: EmbeddingMessages = {
        command: "error",
        payload: {
          requestID: this.requestID,
          originalCommand: "init",
          message: (error as Error).message,
        },
      };
      postMessage(message);
    }
  }

  public async addTaskToQueue(task: () => Promise<void>): Promise<void> {
    this.taskQueue.push(task);
  }

  private async processTaskQueue(): Promise<void> {
    console.log("Processing task queue with", this.taskQueue.length, "tasks");
    while (this.taskQueue.length > 0) {
      const task = this.taskQueue.shift();
      if (task) {
        await task();
      }
    }
  }

  async startExtractEmbedding(chunks: Chunk[]): Promise<void> {
    console.log("Queueing embedding task, not initialized yet.");
    if (!this.isInitialized) {
      // Queue the task if not initialized
      this.taskQueue.push(() => this.startExtractEmbedding(chunks));
      return;
    }
    if (!this.tokenizer || !this.model || this.progress?.status !== "done") {
      throw new Error("Embedding service is not ready.");
    }
    try {
      const inputs = chunks.map((chunk) => {
        const title = chunk.metadata.title || "none";
        const prefix = PREFIXES.document.replace("{title}", title);
        return `${prefix}${chunk.text}`;
      });

      console.log("Inputs for embedding:", inputs.length);

      const tokenized = await this.tokenizer(inputs, { padding: true });
      const { sentence_embedding } = await this.model(tokenized);
      const embeddings: number[][] = sentence_embedding.tolist();

      postMessage({
        command: "finishExtractEmbedding",
        payload: {
          model_id: this.model_id,
          requestID: this.requestID,
          chunks,
          embeddings,
        },
      });
    } catch (error) {
      postMessage({
        command: "error",
        payload: {
          requestID: this.requestID,
          originalCommand: "startExtractEmbedding",
          message: (error as Error).message,
        },
      });
    }
  }

  async queryEmbedding(query: string): Promise<void> {
    if (!this.isInitialized) {
      // Queue the task if not initialized
      this.taskQueue.push(() => this.queryEmbedding(query));
      return;
    }
    if (!this.tokenizer || !this.model || this.progress?.status !== "done") {
      throw new Error("Embedding service is not ready.");
    }
    try {
      const input = `${PREFIXES.query}${query}`;
      const tokenized = await this.tokenizer([input], { padding: true });
      const { sentence_embedding } = await this.model(tokenized);
      const embedding: number[] = sentence_embedding.tolist()[0];

      postMessage({
        command: "finishQueryEmbedding",
        payload: {
          model_id: this.model_id,
          requestID: this.requestID,
          query,
          embedding,
        },
      });
    } catch (error) {
      postMessage({
        command: "error",
        payload: {
          requestID: this.requestID,
          originalCommand: "queryEmbedding",
          message: (error as Error).message,
        },
      });
    }
  }
}

// Create a single instance
let embeddingInstance: Embeddings | null = null;

self.onmessage = async (e: MessageEvent<EmbeddingMessages>) => {
  console.log(
    embeddingInstance !== null
      ? "Using existing embedding instance."
      : "No existing instance."
  );
  if (!embeddingInstance) {
    if (
      e.data.command === "startExtractEmbedding" ||
      e.data.command === "startQueryEmbedding"
    ) {
      embeddingInstance = new Embeddings(
        e.data.payload.requestID,
        e.data.payload.model_id
      );
      // add to queue
      embeddingInstance.addTaskToQueue(async () => {
        switch (e.data.command) {
          case "startExtractEmbedding": {
            const { chunks } = e.data.payload;
            await embeddingInstance!.startExtractEmbedding(chunks);
            break;
          }
          case "startQueryEmbedding": {
            const { query } = e.data.payload;
            await embeddingInstance!.queryEmbedding(query);
            break;
          }
        }
      });
    }
  } else {
    switch (e.data.command) {
      case "startExtractEmbedding": {
        const { chunks } = e.data.payload;
        console.log(
          "Received startExtractEmbedding command with chunks:",
          chunks.length
        );
        await embeddingInstance.startExtractEmbedding(chunks);
        break;
      }
      case "startQueryEmbedding": {
        const { query } = e.data.payload;
        await embeddingInstance.queryEmbedding(query);
        break;
      }
    }
  }
};
