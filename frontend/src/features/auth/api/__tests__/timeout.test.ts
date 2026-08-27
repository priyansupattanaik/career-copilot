import { describe, expect, it } from "vitest";
import { isTimeoutError, withTimeout } from "../timeout";

describe("withTimeout", () => {
  it("resolves when the promise wins", async () => {
    await expect(withTimeout(Promise.resolve("ok"), "fast", 50)).resolves.toBe("ok");
  });

  it("rejects when the promise never settles", async () => {
    const hung = new Promise<string>(() => undefined);
    await expect(withTimeout(hung, "Firebase sign-in", 20)).rejects.toThrow(/Firebase sign-in timed out after 20ms/);
  });

  it("detects timeout errors", () => {
    expect(isTimeoutError(new Error("Firebase sign-in timed out after 4000ms"))).toBe(true);
    expect(isTimeoutError(new Error("Invalid login credentials"))).toBe(false);
  });
});
