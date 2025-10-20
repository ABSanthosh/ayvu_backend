import { testAsserts } from "./test_utils.ts";
import nanoid from "../src/utils/nanoid.ts";

const { assertEquals, assertExists } = testAsserts;

Deno.test("nanoid utility tests", async (t) => {
  await t.step("should generate a 7-character ID", () => {
    const id = nanoid();
    assertEquals(id.length, 7);
  });

  await t.step("should generate unique IDs", () => {
    const ids = new Set();
    for (let i = 0; i < 1000; i++) {
      ids.add(nanoid());
    }
    // Should generate 1000 unique IDs
    assertEquals(ids.size, 1000);
  });

  await t.step("should only contain lowercase letters, numbers, and URL-safe characters", () => {
    const id = nanoid();
    // Should not contain uppercase letters
    assertEquals(id, id.toLowerCase());
    
    // Should only contain valid URL alphabet characters (minus uppercase)
    const validChars = /^[a-z0-9_-]+$/;
    assertEquals(validChars.test(id), true);
  });

  await t.step("should generate consistent length across multiple calls", () => {
    for (let i = 0; i < 100; i++) {
      const id = nanoid();
      assertEquals(id.length, 7);
    }
  });

  await t.step("should be a function", () => {
    assertEquals(typeof nanoid, "function");
  });

  await t.step("should not contain any forbidden characters", () => {
    const id = nanoid();
    
    // Ensure no uppercase letters
    const hasUppercase = /[A-Z]/.test(id);
    assertEquals(hasUppercase, false);
    
    // Ensure no special characters other than - and _
    const hasInvalidChars = /[^a-z0-9_-]/.test(id);
    assertEquals(hasInvalidChars, false);
  });
});