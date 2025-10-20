import { assertEquals, assertExists, assertRejects, assertThrows } from "@std/assert";
import type { ProgressUpdate, UserSession } from "../src/progress/progress.ts";

// Common test utilities and mocks

export interface MockProgressWorker {
  postProgress: (update: ProgressUpdate) => void;
  registerClient: (accessToken: string, refreshToken: string, arxivId: string, controller: ReadableStreamDefaultController) => string;
  userHash: (accessToken: string, refreshToken: string) => string;
  sessions: Map<string, UserSession>;
}

export function createMockProgressWorker(): MockProgressWorker {
  return {
    postProgress: () => {},
    registerClient: () => "mock-user-hash",
    userHash: () => "mock-user-hash",
    sessions: new Map(),
  };
}

export function createMockController(): ReadableStreamDefaultController {
  const messages: string[] = [];
  return {
    enqueue: (data: Uint8Array) => {
      messages.push(new TextDecoder().decode(data));
    },
    close: () => {},
    error: () => {},
    desiredSize: null,
    messages,
  } as unknown as ReadableStreamDefaultController;
}

export async function createTempDir(name: string): Promise<string> {
  const tempDir = `./tmp/test-${name}-${Date.now()}`;
  await Deno.mkdir(tempDir, { recursive: true });
  return tempDir;
}

export async function cleanupTempDir(path: string): Promise<void> {
  try {
    await Deno.remove(path, { recursive: true });
  } catch {
    // Ignore cleanup errors
  }
}

export function createMockHTMLContent(): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <title>Test Paper</title>
</head>
<body>
  <div class="ltx_page_content">
    <div class="ltx_TOC">
      <div class="ltx_tocentry ltx_tocentry_section">
        <a href="#S1" class="ltx_ref">
          <span class="ltx_ref_title">1. Introduction</span>
        </a>
      </div>
      <div class="ltx_tocentry ltx_tocentry_subsection">
        <a href="#S1.SS1" class="ltx_ref">
          <span class="ltx_ref_title">1.1 Background</span>
        </a>
      </div>
    </div>
    <section id="S1" class="ltx_section">
      <h2 class="ltx_title ltx_title_section">
        <span class="ltx_tag ltx_tag_section">1 </span>Introduction
      </h2>
      <div class="ltx_para">
        <p>This is the introduction section content.</p>
      </div>
      <section id="S1.SS1" class="ltx_subsection">
        <h3 class="ltx_title ltx_title_subsection">
          <span class="ltx_tag ltx_tag_subsection">1.1 </span>Background
        </h3>
        <div class="ltx_para">
          <p>This is the background subsection content.</p>
        </div>
      </section>
    </section>
  </div>
</body>
</html>`;
}

export const testAsserts = {
  assertEquals,
  assertExists,
  assertRejects,
  assertThrows,
};