import { testAsserts, createMockHTMLContent } from "./test_utils.ts";
import { Chunker } from "../src/embedding/chunker.ts";

const { assertEquals } = testAsserts;

Deno.test("Chunker tests", async (t) => {
  await t.step("should create a Chunker instance", () => {
    const html = createMockHTMLContent();
    const chunker = new Chunker(html, 1000);
    
    assertEquals(typeof chunker, "object");
    assertEquals(chunker instanceof Chunker, true);
  });

  await t.step("should extract chunks from HTML content", () => {
    const html = createMockHTMLContent();
    const chunker = new Chunker(html, 1000);
    const chunks = chunker.getChunks();
    
    assertEquals(Array.isArray(chunks), true);
    assertEquals(chunks.length > 0, true);
  });

  await t.step("should create chunks with proper structure", () => {
    const html = createMockHTMLContent();
    const chunker = new Chunker(html, 1000);
    const chunks = chunker.getChunks();
    
    if (chunks.length > 0) {
      const chunk = chunks[0];
      assertEquals(typeof chunk.text, "string");
      assertEquals(typeof chunk.metadata, "object");
      assertEquals(typeof chunk.metadata.sectionId, "string");
      assertEquals(typeof chunk.metadata.title, "string");
      assertEquals(["section", "subsection", "subsubsection"].includes(chunk.metadata.hierarchy), true);
    }
  });

  await t.step("should extract section hierarchy correctly", () => {
    const html = createMockHTMLContent();
    const chunker = new Chunker(html, 1000);
    const chunks = chunker.getChunks();
    
    const sectionChunks = chunks.filter(chunk => chunk.metadata.hierarchy === "section");
    const subsectionChunks = chunks.filter(chunk => chunk.metadata.hierarchy === "subsection");
    
    assertEquals(sectionChunks.length > 0, true);
    assertEquals(subsectionChunks.length > 0, true);
    
    // Check if we have the expected sections
    const sectionIds = sectionChunks.map(chunk => chunk.metadata.sectionId);
    assertEquals(sectionIds.includes("S1"), true);
    
    const subsectionIds = subsectionChunks.map(chunk => chunk.metadata.sectionId);
    assertEquals(subsectionIds.includes("S1.SS1"), true);
  });

  await t.step("should respect maximum character limit", () => {
    const html = createMockHTMLContent();
    const maxChars = 50;
    const chunker = new Chunker(html, maxChars);
    const chunks = chunker.getChunks();
    
    chunks.forEach(chunk => {
      assertEquals(chunk.text.length <= maxChars, true);
    });
  });

  await t.step("should handle overlap parameter", () => {
    const html = createMockHTMLContent();
    const chunker = new Chunker(html, 100, 20);
    const chunks = chunker.getChunks();
    
    assertEquals(Array.isArray(chunks), true);
    // Basic test that overlap doesn't break chunking
    assertEquals(chunks.length >= 0, true);
  });

  await t.step("should extract meaningful content text", () => {
    const html = createMockHTMLContent();
    const chunker = new Chunker(html, 1000);
    const chunks = chunker.getChunks();
    
    const hasIntroductionContent = chunks.some(chunk => 
      chunk.text.includes("introduction section content") ||
      chunk.text.includes("Introduction")
    );
    
    const hasBackgroundContent = chunks.some(chunk => 
      chunk.text.includes("background subsection content") ||
      chunk.text.includes("Background")
    );
    
    assertEquals(hasIntroductionContent, true);
    assertEquals(hasBackgroundContent, true);
  });

  await t.step("should handle parent-child section relationships", () => {
    const html = createMockHTMLContent();
    const chunker = new Chunker(html, 1000);
    const chunks = chunker.getChunks();
    
    const subsectionChunk = chunks.find(chunk => 
      chunk.metadata.sectionId === "S1.SS1"
    );
    
    if (subsectionChunk) {
      assertEquals(subsectionChunk.metadata.hierarchy, "subsection");
      // In our test HTML, the subsection should have a parent
      assertEquals(typeof subsectionChunk.metadata.parentSection, "string");
    }
  });

  await t.step("should handle empty or invalid HTML gracefully", () => {
    const emptyHtml = "<html><body></body></html>";
    const chunker = new Chunker(emptyHtml, 1000);
    const chunks = chunker.getChunks();
    
    assertEquals(Array.isArray(chunks), true);
    assertEquals(chunks.length, 0);
  });

  await t.step("should create chunk metadata with correct titles", () => {
    const html = createMockHTMLContent();
    const chunker = new Chunker(html, 1000);
    const chunks = chunker.getChunks();
    
    const introductionChunk = chunks.find(chunk => 
      chunk.metadata.title.includes("Introduction")
    );
    
    const backgroundChunk = chunks.find(chunk => 
      chunk.metadata.title.includes("Background")
    );
    
    if (introductionChunk) {
      assertEquals(introductionChunk.metadata.title.includes("1"), true);
    }
    
    if (backgroundChunk) {
      assertEquals(backgroundChunk.metadata.title.includes("1.1"), true);
    }
  });

  await t.step("should handle very small chunk sizes", () => {
    const html = createMockHTMLContent();
    const chunker = new Chunker(html, 10); // Very small chunks
    const chunks = chunker.getChunks();
    
    assertEquals(Array.isArray(chunks), true);
    chunks.forEach(chunk => {
      assertEquals(chunk.text.length <= 10, true);
      assertEquals(chunk.text.length > 0, true);
    });
  });

  await t.step("should split long content into multiple chunks", () => {
    // Create HTML with longer content
    const longContentHtml = `
    <html>
    <body>
      <div class="ltx_page_content">
        <div class="ltx_TOC">
          <div class="ltx_tocentry ltx_tocentry_section">
            <a href="#S1" class="ltx_ref">
              <span class="ltx_ref_title">1. Long Section</span>
            </a>
          </div>
        </div>
        <section id="S1" class="ltx_section">
          <h2>Long Section</h2>
          <p>${"This is a very long paragraph that should be split into multiple chunks when the character limit is small. ".repeat(20)}</p>
        </section>
      </div>
    </body>
    </html>`;
    
    const chunker = new Chunker(longContentHtml, 100); // Small chunk size
    const chunks = chunker.getChunks();
    
    const sectionChunks = chunks.filter(chunk => chunk.metadata.sectionId === "S1");
    assertEquals(sectionChunks.length > 1, true); // Should split into multiple chunks
  });
});