import { describe, expect, it } from "vitest";
import { chooseAnswerTranscript } from "../interview-stt";
import { pickFillerRichAlternative } from "../interview-voice";

describe("chooseAnswerTranscript", () => {
  it("keeps a typed answer when the candidate did not speak", () => {
    expect(
      chooseAnswerTranscript({
        typedOrSpeech: "I owned the migration and shipped it.",
        whispered: "um",
        speechDetected: false,
      }),
    ).toBe("I owned the migration and shipped it.");
  });

  it("prefers the verbatim whisper transcript when they spoke", () => {
    expect(
      chooseAnswerTranscript({
        typedOrSpeech: "I fixed the bug",
        whispered: "Um I fixed the bug because uh it was urgent",
        speechDetected: true,
      }),
    ).toMatch(/um/i);
  });

  it("uses whisper when live captions were empty", () => {
    expect(
      chooseAnswerTranscript({
        typedOrSpeech: "",
        whispered: "Uh I led the rollback",
        speechDetected: false,
      }),
    ).toBe("Uh I led the rollback");
  });
});

describe("pickFillerRichAlternative", () => {
  it("keeps um over a cleaned alternative", () => {
    expect(pickFillerRichAlternative(["I fixed it", "Um I fixed it"])).toMatch(/um/i);
  });
});
