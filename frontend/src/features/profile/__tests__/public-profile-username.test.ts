import { describe, it, expect } from "vitest";
import {
  normalizePublicProfileUsername,
  isPublicProfileUsername,
  isProfileOwner,
} from "../model/public-profile-username";

describe("public-profile-username", () => {
  describe("normalizePublicProfileUsername", () => {
    it("trims whitespace and converts to lowercase", () => {
      expect(normalizePublicProfileUsername("  JohnDoe  ")).toBe("johndoe");
      expect(normalizePublicProfileUsername("@AlexSmith")).toBe("alexsmith");
      expect(normalizePublicProfileUsername("@@Jane_Doe")).toBe("jane_doe");
    });

    it("replaces internal whitespace with underscores", () => {
      expect(normalizePublicProfileUsername("priyansu pattanaik")).toBe(
        "priyansu_pattanaik",
      );
    });

    it("handles undefined and empty string gracefully", () => {
      expect(normalizePublicProfileUsername(undefined)).toBe("");
      expect(normalizePublicProfileUsername("")).toBe("");
    });
  });

  describe("isPublicProfileUsername", () => {
    it("validates legitimate usernames", () => {
      expect(isPublicProfileUsername("johndoe")).toBe(true);
      expect(isPublicProfileUsername("priyansu_p")).toBe(true);
      expect(isPublicProfileUsername("dev_123_engineer")).toBe(true);
      expect(isPublicProfileUsername("dev1")).toBe(true);
    });

    it("rejects reserved system usernames", () => {
      expect(isPublicProfileUsername("dashboard")).toBe(false);
      expect(isPublicProfileUsername("settings")).toBe(false);
      expect(isPublicProfileUsername("admin")).toBe(false);
      expect(isPublicProfileUsername("api")).toBe(false);
      expect(isPublicProfileUsername("jobs")).toBe(false);
      expect(isPublicProfileUsername("community")).toBe(false);
      expect(isPublicProfileUsername("learning")).toBe(false);
    });

    it("rejects usernames that are too short or too long", () => {
      expect(isPublicProfileUsername("ab")).toBe(false);
      expect(isPublicProfileUsername("a".repeat(31))).toBe(false);
      expect(isPublicProfileUsername("a".repeat(30))).toBe(true);
    });

    it("rejects usernames starting or ending with underscores or special chars", () => {
      expect(isPublicProfileUsername("_username")).toBe(false);
      expect(isPublicProfileUsername("username_")).toBe(false);
      expect(isPublicProfileUsername("user-name")).toBe(false);
      expect(isPublicProfileUsername("user.name")).toBe(false);
      expect(isPublicProfileUsername("user$name")).toBe(false);
    });
  });

  describe("isProfileOwner", () => {
    it("returns true when current username matches target profile", () => {
      expect(isProfileOwner("johndoe", "johndoe")).toBe(true);
      expect(isProfileOwner("@johndoe", "johndoe")).toBe(true);
      expect(isProfileOwner("JohnDoe", "johndoe")).toBe(true);
      expect(isProfileOwner("john_doe", "john_doe")).toBe(true);
    });

    it("returns false when user is not the profile owner", () => {
      expect(isProfileOwner("alice", "bob")).toBe(false);
      expect(isProfileOwner("alice_smith", "bob_jones")).toBe(false);
    });

    it("returns false when current user is not logged in (null/undefined/empty)", () => {
      expect(isProfileOwner(null, "johndoe")).toBe(false);
      expect(isProfileOwner(undefined, "johndoe")).toBe(false);
      expect(isProfileOwner("", "johndoe")).toBe(false);
      expect(isProfileOwner("johndoe", null)).toBe(false);
      expect(isProfileOwner("johndoe", "")).toBe(false);
    });
  });
});

