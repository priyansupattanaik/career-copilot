import { describe, expect, it } from "vitest";
import { publicAppOrigin, publicProfileUrl } from "../public-origin";

describe("public profile origin", () => {
  it("builds the live site profile URL", () => {
    expect(publicProfileUrl("priyansu")).toBe(
      "https://careercopilotai.vercel.app/priyansu",
    );
    expect(publicProfileUrl("@Priyansu")).toBe(
      "https://careercopilotai.vercel.app/priyansu",
    );
  });

  it("ignores the retired Neon host from env and from the current page", () => {
    expect(
      publicAppOrigin({
        envOrigin: "https://career-copilot-neon.vercel.app",
        currentOrigin: "https://careercopilotai.vercel.app",
      }),
    ).toBe("https://careercopilotai.vercel.app");
    expect(
      publicAppOrigin({
        envOrigin: "https://career-copilot-neon.vercel.app/",
        currentOrigin: "https://career-copilot-neon.vercel.app",
      }),
    ).toBe("https://careercopilotai.vercel.app");
  });
});
