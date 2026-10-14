import { describe, expect, it } from "vitest";
import { apiRequestErrorFromBody } from "@/shared/api/errors";

describe("apiRequestErrorFromBody", () => {
  it("keeps the server message and code", () => {
    const error = apiRequestErrorFromBody(409, {
      error: { code: "resume_not_confirmed", message: "Confirm the resume first.", request_id: "abc" },
    });
    expect(error).toMatchObject({
      message: "Confirm the resume first.",
      status: 409,
      code: "resume_not_confirmed",
      requestId: "abc",
    });
    expect(error).toBeInstanceOf(Error);
  });

  it("uses the session message when the server omits one", () => {
    const error = apiRequestErrorFromBody(401, {});
    expect(error.message).toBe("Your session has expired. Sign in again.");
    expect(error.code).toBe("session_expired");
  });

  it("uses the status fallback when the body is empty", () => {
    const error = apiRequestErrorFromBody(500, {});
    expect(error.message).toBe("Request failed (500).");
    expect(error.code).toBe("request_failed");
  });
});
