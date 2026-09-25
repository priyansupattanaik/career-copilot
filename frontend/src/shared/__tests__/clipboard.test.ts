import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { copyTextToClipboard } from "../utils/clipboard";

describe("copyTextToClipboard", () => {
  const originalWindow = (globalThis as unknown as { window?: unknown }).window;
  const originalDocument = (globalThis as unknown as { document?: unknown }).document;
  const originalNavigatorDesc = Object.getOwnPropertyDescriptor(globalThis, "navigator");

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    (globalThis as unknown as { window?: unknown }).window = originalWindow;
    (globalThis as unknown as { document?: unknown }).document = originalDocument;
    if (originalNavigatorDesc) {
      Object.defineProperty(globalThis, "navigator", originalNavigatorDesc);
    }
  });

  it("returns false for empty input", async () => {
    const res = await copyTextToClipboard("");
    expect(res).toBe(false);
  });

  it("returns false when window is undefined", async () => {
    (globalThis as unknown as { window?: unknown }).window = undefined;
    const res = await copyTextToClipboard("https://copilot.test");
    expect(res).toBe(false);
  });

  it("uses navigator.clipboard.writeText when available and successful", async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    (globalThis as unknown as { window?: unknown }).window = { location: { href: "https://copilot.test" } };
    Object.defineProperty(globalThis, "navigator", {
      value: { clipboard: { writeText: writeTextMock } },
      configurable: true,
      writable: true,
    });

    const res = await copyTextToClipboard("https://copilot.test/jane_doe");
    expect(res).toBe(true);
    expect(writeTextMock).toHaveBeenCalledWith("https://copilot.test/jane_doe");
  });

  it("falls back to document.execCommand when navigator.clipboard fails", async () => {
    const writeTextMock = vi.fn().mockRejectedValue(new Error("Permission denied"));
    const appendChildMock = vi.fn();
    const removeChildMock = vi.fn();
    const execMock = vi.fn().mockReturnValue(true);

    const dummyElement = {
      value: "",
      style: {},
      setAttribute: vi.fn(),
      focus: vi.fn(),
      select: vi.fn(),
    };

    (globalThis as unknown as { window?: unknown }).window = { location: { href: "https://copilot.test" } };
    Object.defineProperty(globalThis, "navigator", {
      value: { clipboard: { writeText: writeTextMock } },
      configurable: true,
      writable: true,
    });
    (globalThis as unknown as { document?: unknown }).document = {
      createElement: vi.fn().mockReturnValue(dummyElement),
      body: {
        appendChild: appendChildMock,
        removeChild: removeChildMock,
      },
      execCommand: execMock,
    };

    const res = await copyTextToClipboard("https://copilot.test/jane_doe");
    expect(res).toBe(true);
    expect(execMock).toHaveBeenCalledWith("copy");
    expect(appendChildMock).toHaveBeenCalled();
    expect(removeChildMock).toHaveBeenCalled();
  });
});
