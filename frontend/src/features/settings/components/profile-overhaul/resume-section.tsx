import { useState, useRef, type ChangeEvent } from "react";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import { Checkbox, Surface } from "@/shared/ui/workbench";
import type { ResumeItem } from "./types";

interface ResumeSectionProps {
  resumes: ResumeItem[];
  activeResumeId?: string | null;
  onSelectActiveResume?: (resumeId: string) => Promise<void>;
  onRenameResume?: (resumeId: string, newTitle: string) => Promise<void>;
  onUploadResume: (file: File, title?: string) => Promise<void>;
  onTriggerAutofill: (resumeId: string, onlyFillEmpty: boolean) => void;
  onlyFillEmpty: boolean;
  onToggleOnlyFillEmpty: (val: boolean) => void;
  uploadBusy?: boolean;
}

export function ResumeSection({
  resumes,
  activeResumeId,
  onSelectActiveResume,
  onRenameResume,
  onUploadResume,
  onTriggerAutofill,
  onlyFillEmpty,
  onToggleOnlyFillEmpty,
  uploadBusy = false,
}: ResumeSectionProps) {
  const fileInputRefA = useRef<HTMLInputElement>(null);
  const fileInputRefB = useRef<HTMLInputElement>(null);

  // New upload draft states
  const [resumeTitle, setResumeTitle] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Rename modal states
  const [renamingResume, setRenamingResume] = useState<ResumeItem | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [renameBusy, setRenameBusy] = useState(false);

  function handleFileSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!resumeTitle.trim()) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setResumeTitle(nameWithoutExt);
      }
    }
  }

  async function handleDirectUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
      await onUploadResume(file, nameWithoutExt);
    }
    if (e.target) e.target.value = "";
  }

  async function handleSubmitUpload() {
    if (!selectedFile) return;
    await onUploadResume(selectedFile, resumeTitle.trim() || undefined);
    setSelectedFile(null);
    setResumeTitle("");
    if (fileInputRefB.current) {
      fileInputRefB.current.value = "";
    }
  }

  function openRenameDialog(r: ResumeItem) {
    setRenamingResume(r);
    setNewTitle(r.filename || r.original_filename || "");
  }

  async function handleSaveRename() {
    if (!renamingResume || !newTitle.trim()) return;
    try {
      setRenameBusy(true);
      if (onRenameResume) {
        await onRenameResume(renamingResume.id, newTitle.trim());
      }
      setRenamingResume(null);
    } finally {
      setRenameBusy(false);
    }
  }

  return (
    <Surface
      id="section-resume"
      className="profile-resume-section"
      style={{
        padding: "var(--space-6, 24px)",
        borderRadius: "var(--radius-lg, 12px)",
        background: "var(--surface-1)",
        border: "1px solid var(--hairline)",
      }}
    >
      {/* Section Header inside Surface */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <h2
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 18,
              lineHeight: "28px",
              fontWeight: 600,
              color: "var(--ink)",
              margin: 0,
            }}
          >
            Resume library
          </h2>
          <span
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              lineHeight: "20px",
              color: "var(--ink-2)",
              fontWeight: 400,
            }}
          >
            {resumes.length}
          </span>
        </div>
        <p
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 14,
            lineHeight: "22px",
            color: "var(--ink-2)",
            margin: "4px 0 0 0",
          }}
        >
          Manage your resumes, choose the active one, and autofill your profile from it.
        </p>
      </div>

      {resumes.length === 0 ? (
        /* Empty State */
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "48px 16px",
            borderRadius: "var(--radius-md, 8px)",
            border: "1px dashed var(--hairline-strong)",
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: "var(--radius-full, 9999px)",
              backgroundColor: "var(--surface-2)",
              border: "1px solid var(--hairline)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--accent)",
              marginBottom: 16,
            }}
          >
            <CopilotIcon name="resume" size={24} />
          </div>

          <h3
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 16,
              lineHeight: "24px",
              fontWeight: 600,
              color: "var(--ink)",
              margin: 0,
            }}
          >
            Start with your resume
          </h3>
          <p
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 14,
              lineHeight: "22px",
              color: "var(--ink-2)",
              maxWidth: 440,
              margin: "8px 0 20px 0",
            }}
          >
            Upload a PDF or DOCX and we'll fill in your profile. You review everything before it's saved.
          </p>

          <input
            ref={fileInputRefA}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            style={{ display: "none" }}
            onChange={handleDirectUpload}
            aria-label="Upload resume file"
          />

          <button
            type="button"
            disabled={uploadBusy}
            onClick={() => fileInputRefA.current?.click()}
            className="wb-button wb-button-primary"
            style={{ height: 40 }}
          >
            {uploadBusy ? (
              <>
                <CopilotIcon name="loader" size={14} loop />
                <span>Uploading…</span>
              </>
            ) : (
              <>
                <CopilotIcon name="upload" size={16} />
                <span>Upload resume</span>
              </>
            )}
          </button>
        </div>
      ) : (
        /* Resume List */
        <div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {resumes.map((r, idx) => {
              const isActive = Boolean(r.is_active || r.id === activeResumeId || idx === 0);
              const title = r.filename || r.original_filename || `Resume ${idx + 1}`;
              const originalFile = r.original_filename || r.filename || "";
              const rawStatus = r.extraction_status || "confirmed";
              const status = rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1).toLowerCase();

              return (
                <div
                  key={r.id}
                  className="profile-resume-row"
                  style={{
                    minHeight: 64,
                    padding: "12px 16px",
                    borderBottom: "1px solid var(--hairline)",
                    borderRadius: "var(--radius-md, 8px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                    transition: "background-color 120ms ease",
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontFamily: "var(--font-sans)",
                          fontSize: 14,
                          lineHeight: "20px",
                          fontWeight: 500,
                          color: "var(--ink)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {title}
                      </span>
                      {isActive && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            height: 24,
                            padding: "0 8px",
                            borderRadius: "var(--radius-full, 9999px)",
                            backgroundColor: "var(--accent-soft)",
                            color: "var(--accent)",
                            fontFamily: "var(--font-sans)",
                            fontSize: 11,
                            lineHeight: "16px",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                          }}
                        >
                          Active
                        </span>
                      )}
                    </div>
                    <p
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 13,
                        lineHeight: "20px",
                        color: "var(--ink-2)",
                        margin: "2px 0 0 0",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {originalFile ? `${originalFile} · ${status}` : status}
                    </p>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                    {!isActive && onSelectActiveResume && (
                      <button
                        type="button"
                        onClick={() => void onSelectActiveResume(r.id)}
                        className="wb-button wb-button-ghost"
                        style={{ height: 40 }}
                      >
                        Set active
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openRenameDialog(r)}
                      className="wb-button wb-button-ghost"
                      style={{ height: 40 }}
                    >
                      Rename
                    </button>

                    <button
                      type="button"
                      onClick={() => onTriggerAutofill(r.id, onlyFillEmpty)}
                      className="wb-button wb-button-primary"
                      style={{ height: 40 }}
                    >
                      Autofill from this resume
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Shared Checkbox below list */}
          <div style={{ margin: "16px 0" }}>
            <Checkbox
              checked={onlyFillEmpty}
              onChange={onToggleOnlyFillEmpty}
              label="Only fill empty profile fields (recommended)"
            />
          </div>

          {/* Hairline Separator */}
          <div style={{ height: 1, backgroundColor: "var(--hairline)", margin: "24px 0" }} />

          {/* Upload a new resume */}
          <div>
            <h3
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 14,
                lineHeight: "20px",
                fontWeight: 600,
                color: "var(--ink)",
                margin: "0 0 12px 0",
              }}
            >
              Upload a new resume
            </h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                alignItems: "center",
                gap: 12,
              }}
              className="profile-upload-row"
            >
              <div>
                <label
                  htmlFor="resume-name-input"
                  style={{
                    position: "absolute",
                    width: 1,
                    height: 1,
                    padding: 0,
                    margin: -1,
                    overflow: "hidden",
                    clip: "rect(0, 0, 0, 0)",
                    border: 0,
                  }}
                >
                  Resume name
                </label>
                <input
                  id="resume-name-input"
                  type="text"
                  value={resumeTitle}
                  onChange={(e) => setResumeTitle(e.target.value)}
                  placeholder="e.g. Senior Backend Resume 2026"
                  style={{
                    width: "100%",
                    height: 40,
                    padding: "0 12px",
                    borderRadius: "var(--radius-md, 8px)",
                    border: "1px solid var(--border-control)",
                    backgroundColor: "var(--surface-2)",
                    color: "var(--ink)",
                    fontFamily: "var(--font-sans)",
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>

              <input
                ref={fileInputRefB}
                type="file"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                style={{ display: "none" }}
                onChange={handleFileSelect}
              />

              <button
                type="button"
                onClick={() => fileInputRefB.current?.click()}
                className="wb-button wb-button-secondary"
                style={{ height: 40 }}
              >
                <span style={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {selectedFile ? selectedFile.name : "Choose PDF or DOCX"}
                </span>
              </button>

              <button
                type="button"
                disabled={!selectedFile || uploadBusy}
                onClick={handleSubmitUpload}
                className="wb-button wb-button-primary"
                style={{ height: 40 }}
              >
                {uploadBusy ? "Uploading…" : "Upload"}
              </button>
            </div>

            <p
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 12,
                lineHeight: "16px",
                color: "var(--ink-3)",
                margin: "8px 0 0 0",
              }}
            >
              PDF or DOCX format. Maximum size: 10 MB.
            </p>
          </div>
        </div>
      )}

      {/* Rename Resume Dialog */}
      {renamingResume && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="rename-dialog-title"
        >
          <div
            style={{
              width: "100%",
              maxWidth: 400,
              borderRadius: "var(--radius-lg, 12px)",
              backgroundColor: "var(--surface-3)",
              border: "1px solid var(--hairline-strong)",
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingBottom: 12,
                borderBottom: "1px solid var(--hairline)",
              }}
            >
              <h4
                id="rename-dialog-title"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: 15,
                  fontWeight: 600,
                  color: "var(--ink)",
                  margin: 0,
                }}
              >
                Rename resume
              </h4>
              <button
                type="button"
                onClick={() => setRenamingResume(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--ink-3)",
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: "pointer",
                  padding: 0,
                }}
                aria-label="Close dialog"
              >
                ×
              </button>
            </div>

            <div>
              <label
                htmlFor="rename-resume-input"
                style={{
                  display: "block",
                  fontFamily: "var(--font-sans)",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--ink-2)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                  marginBottom: 6,
                }}
              >
                New resume title
              </label>
              <input
                id="rename-resume-input"
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                style={{
                  width: "100%",
                  height: 40,
                  padding: "0 12px",
                  borderRadius: "var(--radius-md, 8px)",
                  border: "1px solid var(--border-control)",
                  backgroundColor: "var(--surface-2)",
                  color: "var(--ink)",
                  fontFamily: "var(--font-sans)",
                  fontSize: 14,
                  outline: "none",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                paddingTop: 12,
                borderTop: "1px solid var(--hairline)",
              }}
            >
              <button
                type="button"
                onClick={() => setRenamingResume(null)}
                className="wb-button wb-button-ghost"
                style={{ height: 40 }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newTitle.trim() || renameBusy}
                onClick={handleSaveRename}
                className="wb-button wb-button-primary"
                style={{ height: 40 }}
              >
                {renameBusy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Surface>
  );
}
