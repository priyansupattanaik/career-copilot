import { describe, it, expect, afterEach, vi } from "vitest";
import { createClient, isDefinitiveSessionRejection } from "../client";

describe("isDefinitiveSessionRejection", () => {
  it("treats 401/403 as definitive", () => {
    expect(isDefinitiveSessionRejection({ status: 401 })).toBe(true);
    expect(isDefinitiveSessionRejection({ status: 403 })).toBe(true);
  });

  it("treats transient failures as non-definitive", () => {
    expect(isDefinitiveSessionRejection({ status: 500 })).toBe(false);
    expect(isDefinitiveSessionRejection({ status: 503 })).toBe(false);
    expect(isDefinitiveSessionRejection({})).toBe(false);
    expect(isDefinitiveSessionRejection(null)).toBe(false);
    expect(isDefinitiveSessionRejection(undefined)).toBe(false);
  });
});

describe("auth facade getUser status mapping", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("surfaces HTTP 500 as a non-definitive session error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ error: { code: "internal_error", message: "boom" } }), { status: 500 }),
    ));
    const { data, error } = await createClient().auth.getUser();
    expect(data.user).toBeNull();
    expect(error?.status).toBe(500);
    expect(isDefinitiveSessionRejection(error)).toBe(false);
  });

  it("surfaces HTTP 401 as a definitive rejection", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ error: { code: "invalid_token", message: "bad token" } }), { status: 401 }),
    ));
    const { data, error } = await createClient().auth.getUser();
    expect(data.user).toBeNull();
    expect(error?.status).toBe(401);
    expect(isDefinitiveSessionRejection(error)).toBe(true);
  });
});
