import { FONT_OPTIONS, type PresentationSettings, type ResumeContent } from "./resume-schema";

export type FormatNote = { tone: "ok" | "caution"; message: string };

export function atsFormatNotes(
  presentation: PresentationSettings,
  content: ResumeContent,
): FormatNote[] {
  const notes: FormatNote[] = [];
  const font = FONT_OPTIONS.find((item) => item.id === presentation.font_family);
  if (font && !font.atsSafe) {
    notes.push({ tone: "caution", message: "May reduce parser readability — consider a simpler font." });
  }
  if (presentation.font_size < 9.5) {
    notes.push({ tone: "caution", message: "Body text below 9.5pt may reduce parser readability." });
  }
  if (presentation.margin_left < 12 || presentation.margin_right < 12) {
    notes.push({ tone: "caution", message: "Narrow side margins can crowd parsed text. Consider 12mm or more." });
  }
  if (presentation.template === "modern" && presentation.divider === "line") {
    notes.push({ tone: "ok", message: "Accent lines are decorative; keep headings as plain text." });
  }
  const custom = content.additional.some((item) => item.title.trim() && !/^[A-Za-z][A-Za-z ]{1,40}$/.test(item.title));
  if (custom) {
    notes.push({
      tone: "caution",
      message: "Consider a simpler layout heading — unusual section titles may be harder to parse.",
    });
  }
  if (!notes.length) {
    notes.push({
      tone: "ok",
      message: "Formatting uses standard headings, readable type, and selectable text. This does not guarantee ATS results.",
    });
  }
  return notes;
}
