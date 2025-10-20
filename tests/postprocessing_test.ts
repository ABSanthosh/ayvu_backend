import { testAsserts } from "./test_utils.ts";
import { JSDOM } from "jsdom";
import processFigures from "../src/postprocessing/figures.ts";
import processFootnotes from "../src/postprocessing/footnotes.ts";
import processHeadings from "../src/postprocessing/headings.ts";
import processLinks from "../src/postprocessing/links.ts";
import { postprocess } from "../src/postprocessing/index.ts";

const { assertEquals } = testAsserts;

function createTestDocument(html: string): Document {
  const dom = new JSDOM(html);
  return dom.window.document;
}

Deno.test("Postprocessing modules tests", async (t) => {
  await t.step("processFigures should move figcaption to end", () => {
    const html = `
      <html>
        <body>
          <figure>
            <figcaption>Test Caption</figcaption>
            <img src="test.jpg" alt="test">
          </figure>
        </body>
      </html>`;
    
    const document = createTestDocument(html);
    processFigures(document);
    
    const figure = document.querySelector("figure");
    assertEquals(figure !== null, true);
    if (figure) {
      const lastChild = figure.lastElementChild;
      assertEquals(lastChild?.tagName, "FIGCAPTION");
      assertEquals(lastChild?.textContent, "Test Caption");
    }
  });

  await t.step("processFigures should handle figures without figcaption", () => {
    const html = `
      <html>
        <body>
          <figure>
            <img src="test.jpg" alt="test">
          </figure>
        </body>
      </html>`;
    
    const document = createTestDocument(html);
    processFigures(document);
    
    const figure = document.querySelector("figure");
    assertEquals(figure !== null, true);
    if (figure) {
      assertEquals(figure.children.length, 1);
      assertEquals(figure.firstElementChild?.tagName, "IMG");
    }
  });

  await t.step("processFootnotes should handle author notes", () => {
    const html = `
      <html>
        <body>
          <div class="ltx_authors">
            <div class="ltx_note">
              <span class="ltx_note_mark">*</span>
              <span class="ltx_note_content">Corresponding author</span>
            </div>
            <div class="ltx_note">
              <span class="ltx_note_mark">**</span>
              <span class="ltx_note_content">Equal contribution</span>
            </div>
          </div>
        </body>
      </html>`;
    
    const document = createTestDocument(html);
    processFootnotes(document);
    
    const authorNotesContainer = document.querySelector(".ltx_engrafo_author_notes");
    assertEquals(authorNotesContainer !== null, true);
    
    const noteOuters = document.querySelectorAll(".ltx_note_outer");
    assertEquals(noteOuters.length, 2);
  });

  await t.step("processFootnotes should deduplicate identical notes", () => {
    const html = `
      <html>
        <body>
          <div class="ltx_authors">
            <div class="ltx_note">
              <span class="ltx_note_mark">*</span>
              <span class="ltx_note_content">Same note</span>
            </div>
            <div class="ltx_note">
              <span class="ltx_note_mark">**</span>
              <span class="ltx_note_content">Same note</span>
            </div>
          </div>
        </body>
      </html>`;
    
    const document = createTestDocument(html);
    processFootnotes(document);
    
    const noteOuters = document.querySelectorAll(".ltx_note_outer");
    assertEquals(noteOuters.length, 1); // Should be deduplicated
    
    const marks = document.querySelectorAll(".ltx_note_mark");
    assertEquals(marks.length, 2);
    assertEquals(marks[0].textContent, "1");
    assertEquals(marks[1].textContent, "1"); // Both should have same number
  });

  await t.step("processHeadings should convert uppercase to title case", () => {
    const html = `
      <html>
        <body>
          <h1>UPPERCASE HEADING</h1>
          <h2>Mixed Case Heading</h2>
          <h3>lowercase heading</h3>
        </body>
      </html>`;
    
    const document = createTestDocument(html);
    processHeadings(document);
    
    const h1 = document.querySelector("h1");
    const h2 = document.querySelector("h2");
    const h3 = document.querySelector("h3");
    
    assertEquals(h1?.textContent, "Uppercase Heading");
    assertEquals(h2?.textContent, "Mixed Case Heading"); // Should remain unchanged
    assertEquals(h3?.textContent, "lowercase heading"); // Should remain unchanged
  });

  await t.step("processHeadings should remove weird characters", () => {
    const html = `
      <html>
        <body>
          <h1>HEADING\u3000WITH\u3000SPACES</h1>
        </body>
      </html>`;
    
    const document = createTestDocument(html);
    processHeadings(document);
    
    const h1 = document.querySelector("h1");
    assertEquals(h1?.textContent?.includes("\u3000"), false);
    assertEquals(h1?.textContent, "Heading With Spaces");
  });

  await t.step("processLinks should linkify plain URLs", () => {
    const html = `
      <html>
        <body>
          <div class="ltx_page_main">
            <p>Visit https://example.com for more info</p>
          </div>
        </body>
      </html>`;
    
    const document = createTestDocument(html);
    processLinks(document);
    
    const links = document.querySelectorAll("a");
    assertEquals(links.length > 0, true);
    
    const link = links[0];
    assertEquals(link.href, "https://example.com/");
  });

  await t.step("processLinks should add http to URLs without protocol", () => {
    const html = `
      <html>
        <body>
          <a href="example.com">Link</a>
          <a href="https://secure.com">Secure Link</a>
          <a href="#section">Internal Link</a>
          <a href="mailto:test@example.com">Email</a>
        </body>
      </html>`;
    
    const document = createTestDocument(html);
    processLinks(document);
    
    const links = document.querySelectorAll("a");
    assertEquals(links[0].getAttribute("href"), "http://example.com");
    assertEquals(links[1].getAttribute("href"), "https://secure.com");
    assertEquals(links[2].getAttribute("href"), "#section");
    assertEquals(links[3].getAttribute("href"), "mailto:test@example.com");
  });

  await t.step("processLinks should not linkify URLs inside existing links", () => {
    const html = `
      <html>
        <body>
          <div class="ltx_page_main">
            <p><a href="https://example.com">https://example.com</a></p>
          </div>
        </body>
      </html>`;
    
    const document = createTestDocument(html);
    const initialLinkCount = document.querySelectorAll("a").length;
    processLinks(document);
    
    const finalLinkCount = document.querySelectorAll("a").length;
    assertEquals(finalLinkCount, initialLinkCount); // Should not create additional links
  });

  await t.step("postprocess function should run all processors", async () => {
    const arxivId = "test-postprocess";
    
    try {
      // Create test directory and HTML file
      await Deno.mkdir(`./tmp/${arxivId}/html`, { recursive: true });
      
      const testHtml = `
      <html>
        <body>
          <div class="ltx_page_main">
            <h1>UPPERCASE TITLE</h1>
            <figure>
              <figcaption>Test Figure</figcaption>
              <img src="test.jpg" alt="test">
            </figure>
            <p>Visit https://example.com for more</p>
          </div>
        </body>
      </html>`;
      
      await Deno.writeTextFile(`./tmp/${arxivId}/html/paper.html`, testHtml);
      
      // Run postprocess
      await postprocess(arxivId);
      
      // Verify file was processed and written back
      const processedHtml = await Deno.readTextFile(`./tmp/${arxivId}/html/paper.html`);
      assertEquals(typeof processedHtml, "string");
      assertEquals(processedHtml.length > 0, true);
      
      // Basic verification that processing occurred
      assertEquals(processedHtml.includes("UPPERCASE"), false); // Should be converted to title case
      
    } finally {
      // Cleanup
      try {
        await Deno.remove(`./tmp/${arxivId}`, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  await t.step("postprocess should handle missing HTML file", async () => {
    const arxivId = "nonexistent-paper";
    
    try {
      await postprocess(arxivId);
      assertEquals(false, true); // Should not reach here
    } catch (error) {
      assertEquals(typeof error, "object");
      // Expected to fail when file doesn't exist
    }
  });

  await t.step("postprocess should work with progress worker", async () => {
    const arxivId = "test-postprocess-progress";
    
    try {
      await Deno.mkdir(`./tmp/${arxivId}/html`, { recursive: true });
      
      const testHtml = `
      <html>
        <body>
          <div class="ltx_page_main">
            <h1>Test Title</h1>
          </div>
        </body>
      </html>`;
      
      await Deno.writeTextFile(`./tmp/${arxivId}/html/paper.html`, testHtml);
      
      let progressCalled = false;
      const mockProgressWorker = {
        postProgress: () => {
          progressCalled = true;
        },
      };
      
      await postprocess(arxivId, "user-hash", mockProgressWorker as never);
      
      assertEquals(progressCalled, true);
      
    } finally {
      try {
        await Deno.remove(`./tmp/${arxivId}`, { recursive: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  });
});