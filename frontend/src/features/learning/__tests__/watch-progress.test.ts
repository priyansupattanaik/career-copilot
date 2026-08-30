import { describe, expect, it } from "vitest";
import {
  applyHeartbeat,
  extractYoutubeVideoId,
  mergeWatchRanges,
  uniqueWatchedSeconds,
  watchPercentFromSeconds,
} from "../watch-progress";

describe("watch progress", () => {
  it("merges overlapping ranges and ignores inverted pairs", () => {
    expect(mergeWatchRanges([[10, 20], [18, 30], [40, 45], [50, 40]])).toEqual([
      [10, 30],
      [40, 45],
    ]);
  });

  it("does not count skipped gaps as watched time", () => {
    expect(uniqueWatchedSeconds([[0, 10], [20, 30]])).toBe(20);
    expect(watchPercentFromSeconds(20, 100)).toBe(20);
  });

  it("does not complete a lesson when the viewer skips to the end", () => {
    const next = applyHeartbeat([], [975, 985], 980, 1000);
    expect(next.watch_status).toBe("in_progress");
    expect(next.watch_percent).toBeLessThan(90);
  });

  it("completes after uniquely watching most of the video", () => {
    const next = applyHeartbeat([[0, 920]], null, 920, 1000);
    expect(next.watch_status).toBe("completed");
    expect(next.watch_percent).toBe(100);
  });

  it("extracts youtube ids from watch and short urls", () => {
    expect(extractYoutubeVideoId("https://www.youtube.com/watch?v=fqMOX6JJhGo")).toBe("fqMOX6JJhGo");
    expect(extractYoutubeVideoId("https://youtu.be/fqMOX6JJhGo")).toBe("fqMOX6JJhGo");
    expect(extractYoutubeVideoId("https://www.youtube.com/results?search_query=docker")).toBeNull();
  });
});
