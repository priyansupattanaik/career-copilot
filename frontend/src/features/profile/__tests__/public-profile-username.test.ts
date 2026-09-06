import { describe, expect, it } from "vitest";
import {
  isPublicProfileUsername,
  normalizePublicProfileUsername,
} from "../model/public-profile-username";

describe("isPublicProfileUsername", () => {
  it("accepts real usernames", () => {
    expect(isPublicProfileUsername("priyansu")).toBe(true);
    expect(isPublicProfileUsername("@Ada_Lovelace")).toBe(true);
  });

  it("rejects reserved app slugs that were being fetched as profiles", () => {
    expect(isPublicProfileUsername("about")).toBe(false);
    expect(isPublicProfileUsername("careers")).toBe(false);
    expect(isPublicProfileUsername("dashboard")).toBe(false);
    expect(isPublicProfileUsername("community")).toBe(false);
  });

  it("rejects values that cannot be usernames", () => {
    expect(isPublicProfileUsername("ab")).toBe(false);
    expect(isPublicProfileUsername("user-name")).toBe(false);
    expect(isPublicProfileUsername("")).toBe(false);
  });
});

describe("normalizePublicProfileUsername", () => {
  it("strips @ and lowercases", () => {
    expect(normalizePublicProfileUsername("  @Priyansu  ")).toBe("priyansu");
  });
});
