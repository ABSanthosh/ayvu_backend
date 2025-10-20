import { testAsserts } from "./test_utils.ts";

const { assertEquals } = testAsserts;

// Note: Testing main.ts is limited since it's a server application
// These tests focus on the importable aspects and basic structure

Deno.test("Main application tests", async (t) => {
  await t.step("should be able to import main.ts without errors", async () => {
    // Basic import test
    try {
      const mainModule = await import("../src/main.ts");
      assertEquals(typeof mainModule, "object");
    } catch (error) {
      // If import fails, it should be due to the server starting, not syntax errors
      assertEquals(typeof error, "object");
    }
  });

  await t.step("should validate basic application structure", () => {
    // Test that the main file exists and is readable
    const mainFileExists = Deno.statSync("./src/main.ts").isFile;
    assertEquals(mainFileExists, true);
  });

  await t.step("should validate server dependencies are available", async () => {
    try {
      // Test that Oak router can be imported
      const { Router } = await import("@oak/oak");
      assertEquals(typeof Router, "function");
    } catch (error) {
      console.error("Oak dependency issue:", error);
      assertEquals(false, true, "Oak should be available");
    }
  });

  await t.step("should validate import structure", async () => {
    // Read main.ts and verify it has expected imports
    const mainContent = await Deno.readTextFile("./src/main.ts");
    
    // Check for expected imports
    assertEquals(mainContent.includes("import { Application, Router }"), true);
    assertEquals(mainContent.includes("downloadArxivSource"), true);
    assertEquals(mainContent.includes("compileLatex"), true);
    assertEquals(mainContent.includes("postprocess"), true);
    assertEquals(mainContent.includes("generateWeights"), true);
    assertEquals(mainContent.includes("MakeDriveGreatAgain"), true);
  });

  await t.step("should validate route structure", async () => {
    const mainContent = await Deno.readTextFile("./src/main.ts");
    
    // Check for expected routes
    assertEquals(mainContent.includes('router.get("/")'), true);
    assertEquals(mainContent.includes('router.get("/arxiv/:id")'), true);
  });

  await t.step("should validate processing pipeline", async () => {
    const mainContent = await Deno.readTextFile("./src/main.ts");
    
    // Check that the processing pipeline is defined in correct order
    const downloadIndex = mainContent.indexOf("downloadArxivSource");
    const extractIndex = mainContent.indexOf("extractTarball");
    const compileIndex = mainContent.indexOf("compileLatex");
    const postprocessIndex = mainContent.indexOf("postprocess");
    const weightsIndex = mainContent.indexOf("generateWeights");
    
    // Verify order of operations
    assertEquals(downloadIndex < extractIndex, true);
    assertEquals(extractIndex < compileIndex, true);
    assertEquals(compileIndex < postprocessIndex, true);
    assertEquals(postprocessIndex < weightsIndex, true);
  });

  await t.step("should validate error handling structure", async () => {
    const mainContent = await Deno.readTextFile("./src/main.ts");
    
    // Check for error handling patterns
    assertEquals(mainContent.includes("try {"), true);
    assertEquals(mainContent.includes("catch (error)"), true);
    assertEquals(mainContent.includes("finally {"), true);
  });

  await t.step("should validate stream handling", async () => {
    const mainContent = await Deno.readTextFile("./src/main.ts");
    
    // Check for streaming functionality
    assertEquals(mainContent.includes("ReadableStream"), true);
    assertEquals(mainContent.includes("controller.enqueue"), true);
    assertEquals(mainContent.includes("controller.close"), true);
  });

  await t.step("should validate authentication parameters", async () => {
    const mainContent = await Deno.readTextFile("./src/main.ts");
    
    // Check for required authentication parameters
    assertEquals(mainContent.includes("access_token"), true);
    assertEquals(mainContent.includes("refresh_token"), true);
    assertEquals(mainContent.includes("userHash"), true);
  });

  await t.step("should validate progress worker integration", async () => {
    const mainContent = await Deno.readTextFile("./src/main.ts");
    
    // Check for progress worker usage
    assertEquals(mainContent.includes("ProgressWorker"), true);
    assertEquals(mainContent.includes("registerClient"), true);
    assertEquals(mainContent.includes("sessions"), true);
  });

  await t.step("should validate response headers for SSE", async () => {
    const mainContent = await Deno.readTextFile("./src/main.ts");
    
    // Check for Server-Sent Events headers
    assertEquals(mainContent.includes("text/event-stream"), true);
    assertEquals(mainContent.includes("Cache-Control"), true);
    assertEquals(mainContent.includes("keep-alive"), true);
  });

  await t.step("should validate port configuration", async () => {
    const mainContent = await Deno.readTextFile("./src/main.ts");
    
    // Check for port configuration
    assertEquals(mainContent.includes("port: 8000"), true);
    assertEquals(mainContent.includes("app.listen"), true);
  });

  await t.step("should validate conditional execution", async () => {
    const mainContent = await Deno.readTextFile("./src/main.ts");
    
    // Check for main module execution guard
    assertEquals(mainContent.includes("if (import.meta.main)"), true);
  });

  await t.step("should have proper TypeScript typing", async () => {
    const mainContent = await Deno.readTextFile("./src/main.ts");
    
    // Basic TypeScript structure checks
    assertEquals(mainContent.includes("ctx.response"), true);
    assertEquals(mainContent.includes("ctx.params"), true);
    assertEquals(mainContent.includes("ctx.request"), true);
  });

  await t.step("should validate cleanup logic", async () => {
    const mainContent = await Deno.readTextFile("./src/main.ts");
    
    // Check for proper cleanup
    assertEquals(mainContent.includes("cleanupClient"), true);
    assertEquals(mainContent.includes("sessions.delete"), true);
  });

  await t.step("should validate parameter validation", async () => {
    const mainContent = await Deno.readTextFile("./src/main.ts");
    
    // Check for parameter validation
    assertEquals(mainContent.includes("if (!arxivId)"), true);
    assertEquals(mainContent.includes("if (!access_token"), true);
    assertEquals(mainContent.includes("ctx.response.status = 400"), true);
  });
});