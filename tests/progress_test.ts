import { testAsserts, createMockController } from "./test_utils.ts";
import { ProgressWorker } from "../src/progress/progress-worker.ts";
import {
  ProcessingStep,
  ProcessingStatus,
  ProgressUpdate,
  UserSession,
  ArxivTaskProgress,
} from "../src/progress/progress.ts";

const { assertEquals } = testAsserts;

Deno.test("ProgressWorker tests", async (t) => {
  await t.step("should create a new ProgressWorker instance", () => {
    const worker: ProgressWorker = new ProgressWorker();
    assertEquals(typeof worker, "object");
    assertEquals(worker.sessions.size, 0);
  });

  await t.step("should generate consistent userHash from tokens", () => {
    const worker = new ProgressWorker();
    const accessToken = "test-access-token";
    const refreshToken = "test-refresh-token";
    
    const hash1 = worker.userHash(accessToken, refreshToken);
    const hash2 = worker.userHash(accessToken, refreshToken);
    
    assertEquals(hash1, hash2);
    assertEquals(typeof hash1, "string");
    assertEquals(hash1.length > 0, true);
  });

  await t.step("should generate different userHash for different tokens", () => {
    const worker = new ProgressWorker();
    
    const hash1 = worker.userHash("token1", "refresh1");
    const hash2 = worker.userHash("token2", "refresh2");
    
    assertEquals(hash1 !== hash2, true);
  });

  await t.step("should register a client and create session", () => {
    const worker = new ProgressWorker();
    const controller = createMockController();
    const arxivId = "2101.00001";
    
    const userHash = worker.registerClient("access", "refresh", arxivId, controller);
    
    assertEquals(typeof userHash, "string");
    assertEquals(worker.sessions.size, 1);
    
    const session: UserSession | undefined = worker.sessions.get(userHash);
    assertEquals(session !== undefined, true);
    if (session) {
      assertEquals(session.tasks.size, 1);
      assertEquals(session.clients.size, 1);
      
      const task: ArxivTaskProgress | undefined = session.tasks.get(arxivId);
      assertEquals(task !== undefined, true);
      if (task) {
        assertEquals(task.arxivId, arxivId);
        assertEquals(task.overallStatus, ProcessingStatus.PENDING);
      }
    }
  });

  await t.step("should initialize task with all processing steps", () => {
    const worker = new ProgressWorker();
    const controller = createMockController();
    const arxivId = "2101.00001";
    
    const userHash = worker.registerClient("access", "refresh", arxivId, controller);
    const session = worker.sessions.get(userHash)!;
    const task = session.tasks.get(arxivId)!;
    
    const expectedSteps = [
      ProcessingStep.DOWNLOAD_SOURCE,
      ProcessingStep.EXTRACT_TARBALL,
      ProcessingStep.COMPILE_LATEX,
      ProcessingStep.POSTPROCESS,
      ProcessingStep.GENERATE_WEIGHTS,
      ProcessingStep.UPLOAD_TO_DRIVE,
    ];
    
    expectedSteps.forEach(step => {
      assertEquals(task.steps[step] !== undefined, true);
      assertEquals(task.steps[step].status, ProcessingStatus.PENDING);
    });
  });

  await t.step("should post progress updates", () => {
    const worker = new ProgressWorker();
    const controller = createMockController();
    const arxivId = "2101.00001";
    
    const userHash = worker.registerClient("access", "refresh", arxivId, controller);
    
    // Post a progress update
    const update: ProgressUpdate = {
      userHash,
      arxivId,
      step: ProcessingStep.DOWNLOAD_SOURCE,
      progress: {
        status: ProcessingStatus.IN_PROGRESS,
        message: "Downloading source...",
        progress: 50,
      },
    };
    
    worker.postProgress(update);
    
    const session = worker.sessions.get(userHash)!;
    const task = session.tasks.get(arxivId)!;
    
    assertEquals(task.steps[ProcessingStep.DOWNLOAD_SOURCE].status, ProcessingStatus.IN_PROGRESS);
    assertEquals(task.steps[ProcessingStep.DOWNLOAD_SOURCE].message, "Downloading source...");
    assertEquals(task.steps[ProcessingStep.DOWNLOAD_SOURCE].progress, 50);
    assertEquals(task.overallStatus, ProcessingStatus.IN_PROGRESS);
  });

  await t.step("should update overall status to completed when all steps complete", () => {
    const worker = new ProgressWorker();
    const controller = createMockController();
    const arxivId = "2101.00001";
    
    const userHash = worker.registerClient("access", "refresh", arxivId, controller);
    
    // Complete all steps
    const steps = [
      ProcessingStep.DOWNLOAD_SOURCE,
      ProcessingStep.EXTRACT_TARBALL,
      ProcessingStep.COMPILE_LATEX,
      ProcessingStep.POSTPROCESS,
      ProcessingStep.GENERATE_WEIGHTS,
      ProcessingStep.UPLOAD_TO_DRIVE,
    ];
    
    steps.forEach(step => {
      worker.postProgress({
        userHash,
        arxivId,
        step,
        progress: { status: ProcessingStatus.COMPLETED },
      });
    });
    
    const session = worker.sessions.get(userHash)!;
    const task = session.tasks.get(arxivId)!;
    
    assertEquals(task.overallStatus, ProcessingStatus.COMPLETED);
  });

  await t.step("should update overall status to failed when any step fails", () => {
    const worker = new ProgressWorker();
    const controller = createMockController();
    const arxivId = "2101.00001";
    
    const userHash = worker.registerClient("access", "refresh", arxivId, controller);
    
    // Fail one step
    worker.postProgress({
      userHash,
      arxivId,
      step: ProcessingStep.DOWNLOAD_SOURCE,
      progress: {
        status: ProcessingStatus.FAILED,
        error: "Download failed",
      },
    });
    
    const session = worker.sessions.get(userHash)!;
    const task = session.tasks.get(arxivId)!;
    
    assertEquals(task.overallStatus, ProcessingStatus.FAILED);
    assertEquals(task.steps[ProcessingStep.DOWNLOAD_SOURCE].error, "Download failed");
  });

  await t.step("should cleanup client and task", () => {
    const worker = new ProgressWorker();
    const controller = createMockController();
    const arxivId = "2101.00001";
    
    const userHash = worker.registerClient("access", "refresh", arxivId, controller);
    assertEquals(worker.sessions.size, 1);
    
    worker.cleanupClient(userHash, arxivId);
    assertEquals(worker.sessions.size, 0);
  });

  await t.step("should handle multiple clients for same user", () => {
    const worker = new ProgressWorker();
    const controller1 = createMockController();
    const controller2 = createMockController();
    const arxivId1 = "2101.00001";
    const arxivId2 = "2101.00002";
    
    const userHash1 = worker.registerClient("access", "refresh", arxivId1, controller1 as ReadableStreamDefaultController);
    const userHash2 = worker.registerClient("access", "refresh", arxivId2, controller2 as ReadableStreamDefaultController);
    
    // Should be same user hash
    assertEquals(userHash1, userHash2);
    assertEquals(worker.sessions.size, 1);
    
    const session = worker.sessions.get(userHash1)!;
    assertEquals(session.tasks.size, 2);
    assertEquals(session.clients.size, 2);
  });

  await t.step("should handle non-existent session in postProgress", () => {
    const worker = new ProgressWorker();
    
    // Should not throw when posting to non-existent session
    worker.postProgress({
      userHash: "non-existent",
      arxivId: "2101.00001",
      step: ProcessingStep.DOWNLOAD_SOURCE,
      progress: { status: ProcessingStatus.IN_PROGRESS },
    });
    
    // Should complete without errors
    assertEquals(worker.sessions.size, 0);
  });

  await t.step("should handle non-existent task in postProgress", () => {
    const worker = new ProgressWorker();
    const controller = createMockController();
    const arxivId = "2101.00001";
    
    const userHash = worker.registerClient("access", "refresh", arxivId, controller);
    
    // Post progress for non-existent arxiv ID
    worker.postProgress({
      userHash,
      arxivId: "non-existent",
      step: ProcessingStep.DOWNLOAD_SOURCE,
      progress: { status: ProcessingStatus.IN_PROGRESS },
    });
    
    // Original task should be unchanged
    const session = worker.sessions.get(userHash)!;
    const task = session.tasks.get(arxivId)!;
    assertEquals(task.steps[ProcessingStep.DOWNLOAD_SOURCE].status, ProcessingStatus.PENDING);
  });
});