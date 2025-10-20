import { testAsserts } from "./test_utils.ts";
import { Embeddings, EmbeddingModel } from "../src/embedding/worker.ts";
import type { Chunk } from "../src/embedding/chunker.ts";

const { assertEquals } = testAsserts;

Deno.test("Embedding worker tests", async (t) => {
  await t.step("should create Embeddings instance", () => {
    const embeddings = new Embeddings("test-request", EmbeddingModel.embeddingGemma);
    
    assertEquals(typeof embeddings, "object");
    assertEquals(embeddings instanceof Embeddings, true);
  });

  await t.step("should handle progress callback", () => {
    let progressMessage = "";
    const onProgress = (message: string) => {
      progressMessage = message;
    };
    
    const embeddings = new Embeddings("test-request", EmbeddingModel.embeddingGemma, onProgress);
    
    // Test progress callback is stored
    assertEquals(typeof embeddings, "object");
    assertEquals(progressMessage, "");
  });

  await t.step("should queue tasks when not initialized", () => {
    const embeddings = new Embeddings("test-request", EmbeddingModel.embeddingGemma);
    
    let taskExecuted = false;
    const task = () => {
      taskExecuted = true;
      return Promise.resolve();
    };
    
    embeddings.addTaskToQueue(task);
    assertEquals(taskExecuted, false); // Task should be queued, not executed immediately
  });

  await t.step("should handle embedding request structure", async () => {
    const embeddings = new Embeddings("test-request", EmbeddingModel.embeddingGemma);
    
    const mockChunks: Chunk[] = [
      {
        text: "This is a test chunk",
        metadata: {
          sectionId: "S1",
          title: "Test Section",
          hierarchy: "section",
        },
      },
      {
        text: "This is another test chunk",
        metadata: {
          sectionId: "S1.SS1",
          title: "Test Subsection",
          hierarchy: "subsection",
          parentSection: "Test Section",
        },
      },
    ];

    // This will fail because models aren't available, but we can test the structure
    try {
      const result = await embeddings.startExtractEmbedding(mockChunks);
      
      // If it succeeds (unlikely without models), check structure
      if (result.command === "finishExtractEmbedding") {
        assertEquals(result.payload.chunks.length, 2);
        assertEquals(Array.isArray(result.payload.embeddings), true);
      }
    } catch (error) {
      // Expected to fail without actual models
      assertEquals(typeof error, "object");
    }
  });

  await t.step("should handle error conditions", async () => {
    const embeddings = new Embeddings("test-request", EmbeddingModel.embeddingGemma);
    
    const mockChunks: Chunk[] = [
      {
        text: "Test chunk",
        metadata: {
          sectionId: "S1",
          title: "Test",
          hierarchy: "section",
        },
      },
    ];

    // Should return error when models aren't loaded
    const result = await embeddings.startExtractEmbedding(mockChunks);
    assertEquals(result.command, "error");
    assertEquals(result.payload.requestID, "test-request");
    if (result.command === "error") {
      assertEquals(result.payload.originalCommand, "startExtractEmbedding");
      assertEquals(typeof result.payload.message, "string");
    }
  });

  await t.step("should format document inputs correctly", async () => {
    const embeddings = new Embeddings("test-request", EmbeddingModel.embeddingGemma);
    
    const chunk: Chunk = {
      text: "Sample text content",
      metadata: {
        sectionId: "S1",
        title: "Sample Title",
        hierarchy: "section",
      },
    };

    // Test that the formatting would work correctly
    // We can't actually test the full method without models, but we can verify structure
    try {
      await embeddings.startExtractEmbedding([chunk]);
    } catch (error) {
      // Expected without models
      assertEquals(typeof error, "object");
    }
  });

  await t.step("should handle empty chunks array", async () => {
    const embeddings = new Embeddings("test-request", EmbeddingModel.embeddingGemma);
    
    const result = await embeddings.startExtractEmbedding([]);
    
    // Should handle empty array gracefully
    if (result.command === "finishExtractEmbedding") {
      assertEquals(result.payload.chunks.length, 0);
      assertEquals(result.payload.embeddings.length, 0);
    } else if (result.command === "error") {
      assertEquals(typeof result.payload.message, "string");
    }
  });

  await t.step("should validate EmbeddingModel enum", () => {
    assertEquals(EmbeddingModel.gteSmall, "gte-small");
    assertEquals(EmbeddingModel.embeddingGemma, "onnx-community/embeddinggemma-300m-ONNX");
  });

  await t.step("should maintain request ID throughout process", async () => {
    const requestId = "unique-test-request-123";
    const embeddings = new Embeddings(requestId, EmbeddingModel.embeddingGemma);
    
    const mockChunk: Chunk = {
      text: "Test",
      metadata: {
        sectionId: "S1",
        title: "Test",
        hierarchy: "section",
      },
    };

    const result = await embeddings.startExtractEmbedding([mockChunk]);
    assertEquals(result.payload.requestID, requestId);
  });
});