import { JSDOM } from "jsdom";

export interface Chunk {
  text: string;
  metadata: {
    sectionId: string;
    title: string;
    hierarchy: "section" | "subsection" | "subsubsection";
    parentSection?: string;
  };
}

interface TocEntry {
  id: string;
  title: string;
  hierarchy: "section" | "subsection" | "subsubsection";
  parentId?: string;
}

export class Chunker {
  private chunks: Chunk[] = [];

  constructor(html: string, private maxChars: number, private overlap = 200) {
    const { toc, contentBlocks } = this.extractHtmlAndToc(html);
    this.chunks = this.chunkContent(contentBlocks, toc);
  }

  getChunks(): Chunk[] {
    return this.chunks;
  }

  private extractHtmlAndToc(html: string): {
    toc: TocEntry[];
    contentBlocks: {
      id: string;
      text: string;
      hierarchy: "section" | "subsection" | "subsubsection";
    }[];
  } {
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    // Extract TOC
    const toc: TocEntry[] = [];
    const tocItems = doc.querySelectorAll(".ltx_TOC .ltx_tocentry");
    tocItems.forEach((item: Element) => {
      const anchor = item.querySelector("a.ltx_ref");
      if (!anchor) return;

      const id = anchor.getAttribute("href")?.slice(1) || "";
      const titleElement = anchor.querySelector(".ltx_ref_title");
      const title = titleElement?.textContent?.trim() || "";
      let hierarchy: "section" | "subsection" | "subsubsection" = "section";

      if (item.classList.contains("ltx_tocentry_subsection")) {
        hierarchy = "subsection";
      } else if (item.classList.contains("ltx_tocentry_subsubsection")) {
        hierarchy = "subsubsection";
      }

      let parentId: string | undefined;
      if (hierarchy === "subsection") {
        // For subsections like "S1.SS1", parent is "S1"
        const parts = id.split(".");
        if (parts.length > 1) {
          parentId = parts[0];
        }
      } else if (hierarchy === "subsubsection") {
        // For subsubsections like "S1.SS1.SSS1", parent is "S1.SS1"
        const parts = id.split(".");
        if (parts.length > 2) {
          parentId = parts.slice(0, 2).join(".");
        }
      }

      toc.push({ id, title, hierarchy, parentId });
    });

    // Extract content blocks
    const contentBlocks: {
      id: string;
      text: string;
      hierarchy: "section" | "subsection" | "subsubsection";
    }[] = [];
    const pageContent = doc.querySelector(".ltx_page_content");
    if (pageContent) {
      toc.forEach((entry) => {
        const sectionElement = pageContent.querySelector(`#${entry.id}`);
        if (!sectionElement) return;

        // Extract text content before any child sections
        let text = "";
        const childSections = sectionElement.querySelectorAll(
          ".ltx_section, .ltx_subsection, .ltx_subsubsection"
        );
        if (childSections.length > 0) {
          // Collect text from direct children before the first child section
          for (const child of sectionElement.childNodes) {
            if (
              child.nodeType === dom.window.Node.ELEMENT_NODE &&
              ["SECTION", "SUBSECTION", "SUBSUBSECTION"].includes(
                (child as Element).tagName.toUpperCase()
              )
            ) {
              break;
            }
            if (
              child.nodeType === dom.window.Node.ELEMENT_NODE ||
              child.nodeType === dom.window.Node.TEXT_NODE
            ) {
              text += child.textContent?.replace(/\n+/g, " ").trim() + " ";
            }
          }
        } else {
          // If no child sections, take all text content
          text = sectionElement.textContent?.replace(/\n+/g, " ").trim() || "";
        }

        if (text) {
          contentBlocks.push({
            id: entry.id,
            text,
            hierarchy: entry.hierarchy,
          });
        }

        // For sections with child subsections, ensure child sections are processed separately
        childSections.forEach((childSection: Element) => {
          const childId = childSection.getAttribute("id");
          if (childId && !contentBlocks.some((block) => block.id === childId)) {
            const childText =
              childSection.textContent?.replace(/\n+/g, " ").trim() || "";
            const childHierarchy = childSection.classList.contains(
              "ltx_subsection"
            )
              ? "subsection"
              : "subsubsection";
            if (childText) {
              contentBlocks.push({
                id: childId,
                text: childText,
                hierarchy: childHierarchy,
              });
            }
          }
        });
      });
    }

    return { toc, contentBlocks };
  }

  private chunkText(text: string, maxChars: number, overlap: number): string[] {
    const chunks: string[] = [];
    let start = 0;
    
    // Ensure we make progress even with small chunk sizes
    const step = Math.max(1, maxChars - overlap);
    
    while (start < text.length) {
      const end = Math.min(text.length, start + maxChars);
      const chunk = text.slice(start, end);
      if (chunk.length > 0) {
        chunks.push(chunk);
      }
      start += step;
      
      // Safety check to prevent infinite loops
      if (step <= 0 || chunks.length > 10000) {
        break;
      }
    }
    return chunks;
  }

  private chunkContent(
    contentBlocks: {
      id: string;
      text: string;
      hierarchy: "section" | "subsection" | "subsubsection";
    }[],
    toc: TocEntry[]
  ): Chunk[] {
    const chunks: Chunk[] = [];
    contentBlocks.forEach((block) => {
      const tocEntry = toc.find((entry) => entry.id === block.id);
      if (!tocEntry) return;

      const textChunks = this.chunkText(
        block.text,
        this.maxChars,
        this.overlap
      );
      textChunks.forEach((text) => {
        chunks.push({
          text,
          metadata: {
            sectionId: block.id,
            title: tocEntry.title,
            hierarchy: block.hierarchy,
            parentSection: tocEntry.parentId
              ? toc.find((entry) => entry.id === tocEntry.parentId)?.title
              : undefined,
          },
        });
      });
    });

    return chunks;
  }
}
