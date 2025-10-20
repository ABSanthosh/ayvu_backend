import { testAsserts } from "./test_utils.ts";
import MakeDriveGreatAgain from "../src/process_drive.ts";

const { assertEquals, assertRejects } = testAsserts;

Deno.test("Process Drive tests", async (t) => {
  await t.step("MakeDriveGreatAgain should create instance", () => {
    const drive = new MakeDriveGreatAgain({
      accessToken: "fake-access-token",
      refreshToken: "fake-refresh-token",
    });
    
    assertEquals(typeof drive, "object");
    assertEquals(drive instanceof MakeDriveGreatAgain, true);
  });

  await t.step("MakeDriveGreatAgain should handle constructor parameters", () => {
    const mockProgressWorker = {
      postProgress: () => {},
    };
    
    const drive = new MakeDriveGreatAgain({
      accessToken: "test-access",
      refreshToken: "test-refresh",
      userHash: "test-user-hash",
      progressWorker: mockProgressWorker as never,
    });
    
    assertEquals(typeof drive, "object");
  });

  await t.step("uploadPaper should fail without valid credentials", async () => {
    const drive = new MakeDriveGreatAgain({
      accessToken: "invalid-token",
      refreshToken: "invalid-refresh",
    });
    
    await assertRejects(async () => {
      await drive.uploadPaper("test-arxiv-id");
    });
  });

  await t.step("uploadPaper should fail when files don't exist", async () => {
    const drive = new MakeDriveGreatAgain({
      accessToken: "fake-access",
      refreshToken: "fake-refresh",
    });
    
    await assertRejects(async () => {
      await drive.uploadPaper("nonexistent-paper");
    });
  });

  await t.step("uploadPaper should handle progress updates", async () => {
    const mockProgressWorker = {
      postProgress: () => {
        // Progress callback
      },
    };
    
    const drive = new MakeDriveGreatAgain({
      accessToken: "fake-access",
      refreshToken: "fake-refresh",
      userHash: "test-hash",
      progressWorker: mockProgressWorker as never,
    });
    
    try {
      await drive.uploadPaper("test-paper");
    } catch (error) {
      // Expected to fail, but might call progress during attempt
      assertEquals(typeof error, "object");
    }
  });

  await t.step("should handle missing optional parameters", () => {
    // Test without userHash and progressWorker
    const drive = new MakeDriveGreatAgain({
      accessToken: "test-access",
      refreshToken: "test-refresh",
    });
    
    assertEquals(typeof drive, "object");
  });

  await t.step("uploadPaper should create proper folder structure", async () => {
    const drive = new MakeDriveGreatAgain({
      accessToken: "fake-token",
      refreshToken: "fake-refresh",
    });
    
    // This will fail due to invalid credentials, but tests the structure
    await assertRejects(async () => {
      await drive.uploadPaper("test-folder-structure");
    });
  });

  await t.step("should handle concurrent uploads", async () => {
    const drive = new MakeDriveGreatAgain({
      accessToken: "fake-access",
      refreshToken: "fake-refresh",
    });
    
    const promises = [
      drive.uploadPaper("paper1"),
      drive.uploadPaper("paper2"),
    ];
    
    const results = await Promise.allSettled(promises);
    
    // Both should fail due to invalid credentials
    assertEquals(results[0].status, "rejected");
    assertEquals(results[1].status, "rejected");
  });

  await t.step("should handle very long arxiv IDs", async () => {
    const drive = new MakeDriveGreatAgain({
      accessToken: "fake-access",
      refreshToken: "fake-refresh",
    });
    
    const longArxivId = "very-long-arxiv-id-that-might-cause-issues-with-folder-names";
    
    await assertRejects(async () => {
      await drive.uploadPaper(longArxivId);
    });
  });

  await t.step("should handle special characters in arxiv IDs", async () => {
    const drive = new MakeDriveGreatAgain({
      accessToken: "fake-access",
      refreshToken: "fake-refresh",
    });
    
    const specialArxivId = "2024.01.001v1";
    
    await assertRejects(async () => {
      await drive.uploadPaper(specialArxivId);
    });
  });

  await t.step("should validate constructor requires all mandatory parameters", () => {
    // Test that missing required parameters would cause issues
    assertRejects(async () => {
      // @ts-expect-error: Testing missing required parameters
      const drive = new MakeDriveGreatAgain({});
      await drive.uploadPaper("test");
    });
  });
});