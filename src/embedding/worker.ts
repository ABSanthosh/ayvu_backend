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

export interface OtherProgressInfo {
  task: string;
  status: "progress" | "done" | "error";
  progress: number;
  file?: string;
}

export class Embeddings {
  public progress: ProgressInfo | null = null;
  private model: PreTrainedModel | null = null;
  private tokenizer: PreTrainedTokenizer | null = null;
  private taskQueue: Array<() => Promise<void>> = [];

  constructor(
    private requestID: string,
    private model_id: EmbeddingModel = EmbeddingModel.gteSmall,
    private onProgress?: (message: string) => void
  ) {
    // this.init();
  }

  private progress_callback(progress: ProgressInfo): void {
    this.onProgress?.(
      `Loading model (${(progress.status === "progress"
        ? (progress.loaded / progress.total) * 100
        : 0
      ).toFixed(2)}%)`
    );
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

  public addTaskToQueue(task: () => Promise<void>): void {
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

  async startExtractEmbedding(chunks: Chunk[]): Promise<EmbeddingMessages> {
    // if (!this.tokenizer || !this.model) {
    //   this.addTaskToQueue(async () => {
    //     await this.startExtractEmbedding(chunks);
    //   });
    //   return {
    //     command: "error",
    //     payload: {
    //       requestID: this.requestID,
    //       originalCommand: "startExtractEmbedding",
    //       message: "Model or tokenizer not initialized yet.",
    //     },
    //   };
    // }
    try {
      const inputs = chunks.map((chunk) => {
        const title = chunk.metadata.title || "none";
        const prefix = PREFIXES.document.replace("{title}", title);
        return `${prefix}${chunk.text}`;
      });

      console.log("Inputs for embedding:", inputs.length);
      this.onProgress?.(`Generating embeddings for ${inputs.length} chunks...`);

      const tokenized = await this.tokenizer!(inputs, { padding: true });
      const { sentence_embedding } = await this.model!(tokenized);
      const embeddings: number[][] = sentence_embedding.tolist();

      this.onProgress?.(`Finished generating embeddings for ${inputs.length} chunks.`);

      return {
        command: "finishExtractEmbedding",
        payload: {
          model_id: this.model_id,
          requestID: this.requestID,
          chunks,
          embeddings,
        },
      };
    } catch (error) {
      return {
        command: "error",
        payload: {
          requestID: this.requestID,
          originalCommand: "startExtractEmbedding",
          message: (error as Error).message,
        },
      };
    }
  }
}
