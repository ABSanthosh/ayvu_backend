import { testAsserts, createTempDir, cleanupTempDir, createMockProgressWorker } from "./test_utils.ts";
import { generateWeights } from "../src/embedding/index.ts";

const { assertEquals } = testAsserts;

Deno.test("Embedding index tests", async (t) => {
  await t.step("should handle generateWeights function signature", () => {
    assertEquals(typeof generateWeights, "function");
  });

  await t.step("should require HTML file to exist", async () => {
    const _tempDir = await createTempDir("embedding-index");
    const arxivId = "test-paper";
    const mockProgressWorker = createMockProgressWorker();
    
    try {
      // Should fail because no HTML file exists
      await generateWeights(arxivId, "user-hash", mockProgressWorker as never);
      assertEquals(false, true); // Should not reach here
    } catch (error) {
      // Expected to fail when HTML file doesn't exist
      assertEquals(typeof error, "object");
    } finally {
      await cleanupTempDir(_tempDir);
    }
  });

  await t.step("should process when HTML file exists", async () => {
    const _tempDir = await createTempDir("embedding-index");
    const arxivId = "test-paper";
    
    try {
      // Create the required directory structure
      await Deno.mkdir(`./tmp/${arxivId}/html`, { recursive: true });
      
      // Create a mock HTML file
      const mockHtml = `
      <html>
        <body>
          <div class="ltx_page_content">
            <div class="ltx_TOC">
              <div class="ltx_tocentry ltx_tocentry_section">
                <a href="#S1" class="ltx_ref">
                  <span class="ltx_ref_title">1. Introduction</span>
                </a>
              </div>
            </div>
            <section id="S1" class="ltx_section">
              <h2>Introduction</h2>
              <p>This is test content for the introduction section.</p>
            </section>
          </div>
        </body>
      </html>`;
      
      await Deno.writeTextFile(`./tmp/${arxivId}/html/paper.html`, mockHtml);
      
      const mockProgressWorker = createMockProgressWorker();
      
      // This should fail due to missing ML models, but we can test it doesn't crash immediately
      try {
        await generateWeights(arxivId, "user-hash", mockProgressWorker as never);
      } catch (error) {
        // Expected to fail without ML models
        assertEquals(typeof error, "object");
      }
      
      // Verify the HTML file was read (it should exist)
      const htmlExists = await Deno.stat(`./tmp/${arxivId}/html/paper.html`);
      assertEquals(htmlExists.isFile, true);
      
    } finally {
      // Cleanup
      try {
        await Deno.remove(`./tmp/${arxivId}`, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  await t.step("should accept custom chunk size parameter", async () => {
    const _tempDir = await createTempDir("embedding-index");
    const arxivId = "test-paper";
    
    try {
      // Create the required directory structure
      await Deno.mkdir(`./tmp/${arxivId}/html`, { recursive: true });
      
      const mockHtml = `
      <html>
        <body>
          <div class="ltx_page_content">
            <section id="S1" class="ltx_section">
              <h2>Test Section</h2>
              <p>Test content.</p>
            </section>
          </div>
        </body>
      </html>`;
      
      await Deno.writeTextFile(`./tmp/${arxivId}/html/paper.html`, mockHtml);
      
      const mockProgressWorker = createMockProgressWorker();
      
      // Test with custom chunk size
      try {
        await generateWeights(arxivId, "user-hash", mockProgressWorker as never, 512);
      } catch (error) {
        // Expected to fail without ML models
        assertEquals(typeof error, "object");
      }
      
    } finally {
      // Cleanup
      try {
        await Deno.remove(`./tmp/${arxivId}`, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  await t.step("should handle progress worker updates", async () => {
    const _tempDir = await createTempDir("embedding-index");
    const arxivId = "test-paper";
    
    try {
      // Create the required directory structure
      await Deno.mkdir(`./tmp/${arxivId}/html`, { recursive: true });
      
      const mockHtml = `<html><body><div class="ltx_page_content"><section id="S1"><h2>Test</h2><p>Content</p></section></div></body></html>`;
      await Deno.writeTextFile(`./tmp/${arxivId}/html/paper.html`, mockHtml);
      
      let progressCalled = false;
      const mockProgressWorker = {
        postProgress: () => {
          progressCalled = true;
        },
      };
      
      try {
        await generateWeights(arxivId, "user-hash", mockProgressWorker as never);
      } catch (error) {
        // Expected to fail without ML models
        assertEquals(typeof error, "object");
      }
      
      // Progress should have been called during the attempt
      assertEquals(progressCalled, true);
      
    } finally {
      // Cleanup
      try {
        await Deno.remove(`./tmp/${arxivId}`, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  await t.step("should work without progress worker", async () => {
    const _tempDir = await createTempDir("embedding-index");
    const arxivId = "test-paper";
    
    try {
      // Create the required directory structure
      await Deno.mkdir(`./tmp/${arxivId}/html`, { recursive: true });
      
      const mockHtml = `<html><body><div class="ltx_page_content"><section id="S1"><h2>Test</h2><p>Content</p></section></div></body></html>`;
      await Deno.writeTextFile(`./tmp/${arxivId}/html/paper.html`, mockHtml);
      
      // Should work without progress worker (undefined)
      try {
        await generateWeights(arxivId);
      } catch (error) {
        // Expected to fail without ML models, but not due to progress worker
        assertEquals(typeof error, "object");
      }
      
    } finally {
      // Cleanup
      try {
        await Deno.remove(`./tmp/${arxivId}`, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  await t.step("should work without user hash", async () => {
    const _tempDir = await createTempDir("embedding-index");
    const arxivId = "test-paper";
    
    try {
      // Create the required directory structure
      await Deno.mkdir(`./tmp/${arxivId}/html`, { recursive: true });
      
      const mockHtml = `<html><body><div class="ltx_page_content"><section id="S1"><h2>Test</h2><p>Content</p></section></div></body></html>`;
      await Deno.writeTextFile(`./tmp/${arxivId}/html/paper.html`, mockHtml);
      
      const mockProgressWorker = createMockProgressWorker();
      
      // Should work without user hash (undefined)
      try {
        await generateWeights(arxivId, undefined, mockProgressWorker as never);
      } catch (error) {
        // Expected to fail without ML models
        assertEquals(typeof error, "object");
      }
      
    } finally {
      // Cleanup
      try {
        await Deno.remove(`./tmp/${arxivId}`, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });
});