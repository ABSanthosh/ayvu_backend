import { testAsserts } from "./test_utils.ts";
import { JSDOM } from "jsdom";
import { removeAll, nodeFromString } from "../src/postprocessing/utils.ts";

const { assertEquals, assertThrows } = testAsserts;

function createTestDocument(html: string): Document {
  const dom = new JSDOM(html);
  return dom.window.document;
}

Deno.test("Postprocessing utils tests", async (t) => {
  await t.step("removeAll should remove all elements from NodeList", () => {
    const html = `
      <html>
        <body>
          <div class="test">First</div>
          <div class="test">Second</div>
          <div class="test">Third</div>
          <div class="other">Keep this</div>
        </body>
      </html>`;
    
    const document = createTestDocument(html);
    const elementsToRemove = document.querySelectorAll(".test");
    
    assertEquals(elementsToRemove.length, 3);
    assertEquals(document.querySelectorAll(".test").length, 3);
    
    removeAll(elementsToRemove);
    
    assertEquals(document.querySelectorAll(".test").length, 0);
    assertEquals(document.querySelectorAll(".other").length, 1);
  });

  await t.step("removeAll should handle empty NodeList", () => {
    const html = `<html><body><div>Test</div></body></html>`;
    const document = createTestDocument(html);
    const emptyNodeList = document.querySelectorAll(".nonexistent");
    
    assertEquals(emptyNodeList.length, 0);
    
    // Should not throw an error
    removeAll(emptyNodeList);
    
    assertEquals(document.querySelectorAll("div").length, 1);
  });

  await t.step("nodeFromString should create element from HTML string", () => {
    const html = `<html><body></body></html>`;
    const document = createTestDocument(html);
    
    const node = nodeFromString(document, '<div class="test">Hello World</div>');
    
    assertEquals(node.nodeType, 1); // Element node
    assertEquals((node as Element).tagName, "DIV");
    assertEquals((node as Element).className, "test");
    assertEquals(node.textContent, "Hello World");
  });

  await t.step("nodeFromString should handle complex HTML", () => {
    const html = `<html><body></body></html>`;
    const document = createTestDocument(html);
    
    const complexHtml = `<div class="container">
        <h2>Title</h2>
        <p>Paragraph with <strong>bold</strong> text</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
        </ul>
      </div>`;
    
    const node = nodeFromString(document, complexHtml.trim());
    
    assertEquals((node as Element).tagName, "DIV");
    assertEquals((node as Element).className, "container");
    assertEquals((node as Element).querySelector("h2")?.textContent?.trim(), "Title");
    assertEquals((node as Element).querySelectorAll("li").length, 2);
  });

  await t.step("nodeFromString should handle text nodes", () => {
    const html = `<html><body></body></html>`;
    const document = createTestDocument(html);
    
    const node = nodeFromString(document, "Just plain text");
    
    assertEquals(node.nodeType, 3); // Text node
    assertEquals(node.textContent, "Just plain text");
  });

  await t.step("nodeFromString should handle self-closing tags", () => {
    const html = `<html><body></body></html>`;
    const document = createTestDocument(html);
    
    const node = nodeFromString(document, '<img src="test.jpg" alt="test" />');
    
    assertEquals((node as Element).tagName, "IMG");
    assertEquals((node as Element).getAttribute("src"), "test.jpg");
    assertEquals((node as Element).getAttribute("alt"), "test");
  });

  await t.step("nodeFromString should throw error for invalid HTML", () => {
    const html = `<html><body></body></html>`;
    const document = createTestDocument(html);
    
    assertThrows(() => {
      nodeFromString(document, "");
    });
  });

  await t.step("nodeFromString should handle whitespace-only string", () => {
    const html = `<html><body></body></html>`;
    const document = createTestDocument(html);
    
    const node = nodeFromString(document, "   ");
    
    assertEquals(node.nodeType, 3); // Text node
    assertEquals(node.textContent, "   ");
  });

  await t.step("nodeFromString should return first child only", () => {
    const html = `<html><body></body></html>`;
    const document = createTestDocument(html);
    
    const node = nodeFromString(document, '<div>First</div><div>Second</div>');
    
    assertEquals((node as Element).tagName, "DIV");
    assertEquals(node.textContent, "First");
    // Should only return the first div, not both
  });

  await t.step("removeAll should handle elements with event listeners", () => {
    const html = `
      <html>
        <body>
          <button class="btn">Button 1</button>
          <button class="btn">Button 2</button>
        </body>
      </html>`;
    
    const document = createTestDocument(html);
    const buttons = document.querySelectorAll(".btn");
    
    // Add event listeners (even though they won't work in JSDOM, this tests the removal)
    buttons.forEach(button => {
      button.addEventListener("click", () => {});
    });
    
    assertEquals(buttons.length, 2);
    
    removeAll(buttons);
    
    assertEquals(document.querySelectorAll(".btn").length, 0);
  });

  await t.step("removeAll should handle nested elements", () => {
    const html = `
      <html>
        <body>
          <div class="parent">
            <div class="child">Child 1</div>
            <div class="child">Child 2</div>
          </div>
          <div class="parent">
            <div class="child">Child 3</div>
          </div>
        </body>
      </html>`;
    
    const document = createTestDocument(html);
    const parents = document.querySelectorAll(".parent");
    
    assertEquals(parents.length, 2);
    assertEquals(document.querySelectorAll(".child").length, 3);
    
    removeAll(parents);
    
    assertEquals(document.querySelectorAll(".parent").length, 0);
    assertEquals(document.querySelectorAll(".child").length, 0); // Children should be removed too
  });
});