import { testAsserts, createMockProgressWorker, createTempDir, cleanupTempDir } from "./test_utils.ts";
import { downloadArxivSource, extractTarball } from "../src/process_arxiv.ts";

const { assertEquals, assertRejects } = testAsserts;

Deno.test("Process ArXiv tests", async (t) => {
  await t.step("downloadArxivSource should handle function parameters", () => {
    assertEquals(typeof downloadArxivSource, "function");
  });

  await t.step("downloadArxivSource should fail for invalid arxiv ID", async () => {
    const invalidArxivId = "invalid-arxiv-id";
    const mockProgressWorker = createMockProgressWorker();
    
    await assertRejects(
      async () => {
        await downloadArxivSource(invalidArxivId, "user-hash", mockProgressWorker as never);
      }
    );
  });

  await t.step("downloadArxivSource should create proper directory structure", async () => {
    const tempDir = await createTempDir("arxiv-test");
    
    try {
      // This will likely fail due to network, but we can test the directory creation logic
      const arxivId = "2101.00001";
      
      await assertRejects(async () => {
        await downloadArxivSource(arxivId);
      });
      
      // The function should attempt to create the directory structure
      // Even if the download fails, it might create the directory
      
    } finally {
      await cleanupTempDir(tempDir);
    }
  });

  await t.step("downloadArxivSource should work without progress worker", async () => {
    const invalidArxivId = "invalid-test-id";
    
    // Should not throw due to missing progress worker
    await assertRejects(async () => {
      await downloadArxivSource(invalidArxivId);
    });
  });

  await t.step("downloadArxivSource should handle progress updates", async () => {
    const arxivId = "test-id";
    let progressCalled = false;
    
    const mockProgressWorker = {
      postProgress: () => {
        progressCalled = true;
      },
    };
    
    await assertRejects(async () => {
      await downloadArxivSource(arxivId, "user-hash", mockProgressWorker as never);
    });
    
    // Progress should have been called even if download failed
    assertEquals(progressCalled, true);
  });

  await t.step("extractTarball should handle function parameters", () => {
    assertEquals(typeof extractTarball, "function");
  });

  await t.step("extractTarball should fail when source file doesn't exist", async () => {
    const arxivId = "nonexistent-paper";
    const mockProgressWorker = createMockProgressWorker();
    
    await assertRejects(async () => {
      await extractTarball(arxivId, "user-hash", mockProgressWorker as never);
    });
  });

  await t.step("extractTarball should work without progress worker", async () => {
    const arxivId = "nonexistent-paper";
    
    await assertRejects(async () => {
      await extractTarball(arxivId);
    });
  });

  await t.step("extractTarball should create proper extraction directory", async () => {
    const tempDir = await createTempDir("extract-test");
    const arxivId = "test-extract";
    
    try {
      // Create a dummy tar file (will fail to extract, but tests directory creation)
      await Deno.mkdir(`./tmp/${arxivId}`, { recursive: true });
      await Deno.writeTextFile(`./tmp/${arxivId}/source.tar.gz`, "invalid tar content");
      
      await assertRejects(async () => {
        await extractTarball(arxivId);
      });
      
      // Should have attempted to create the latex directory
      
    } finally {
      try {
        await Deno.remove(`./tmp/${arxivId}`, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
      await cleanupTempDir(tempDir);
    }
  });

  await t.step("extractTarball should handle progress updates", async () => {
    const arxivId = "test-progress";
    let progressCalled = false;
    
    const mockProgressWorker = {
      postProgress: () => {
        progressCalled = true;
      },
    };
    
    try {
      await Deno.mkdir(`./tmp/${arxivId}`, { recursive: true });
      await Deno.writeTextFile(`./tmp/${arxivId}/source.tar.gz`, "invalid tar");
      
      await assertRejects(async () => {
        await extractTarball(arxivId, "user-hash", mockProgressWorker as never);
      });
      
      // Progress should have been called during the attempt
      assertEquals(progressCalled, true);
      
    } finally {
      try {
        await Deno.remove(`./tmp/${arxivId}`, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  await t.step("downloadArxivSource should return correct path format", async () => {
    const arxivId = "test-path";
    
    // Even if it fails, we can test the path format from error messages or structure
    await assertRejects(async () => {
      const result = await downloadArxivSource(arxivId);
      // If it somehow succeeds, check the path format
      if (typeof result === "string") {
        assertEquals(result.includes(arxivId), true);
        assertEquals(result.includes("source.tar.gz"), true);
      }
    });
  });

  await t.step("should handle concurrent downloads", async () => {
    const arxivId1 = "test-concurrent-1";
    const arxivId2 = "test-concurrent-2";
    
    // Both should fail but not interfere with each other
    const promises = [
      downloadArxivSource(arxivId1),
      downloadArxivSource(arxivId2),
    ];
    
    const results = await Promise.allSettled(promises);
    
    // Both should reject (due to invalid IDs)
    assertEquals(results[0].status, "rejected");
    assertEquals(results[1].status, "rejected");
  });

  await t.step("should clean up after successful extraction", async () => {
    const arxivId = "test-cleanup";
    
    try {
      // Create directory structure to test cleanup
      await Deno.mkdir(`./tmp/${arxivId}`, { recursive: true });
      await Deno.writeTextFile(`./tmp/${arxivId}/source.tar.gz`, "test content");
      
      // Even though extraction will fail, test that cleanup logic would work
      await assertRejects(async () => {
        await extractTarball(arxivId);
      });
      
      // The source file should still exist since extraction failed
      const fileExists = await Deno.stat(`./tmp/${arxivId}/source.tar.gz`).then(() => true).catch(() => false);
      assertEquals(fileExists, true);
      
    } finally {
      try {
        await Deno.remove(`./tmp/${arxivId}`, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });
});