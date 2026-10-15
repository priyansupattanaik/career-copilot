import { useState, useRef, type ChangeEvent } from "react";
import { CopilotIcon } from "@/components/ui/copilot-icons";
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
    <section
      id="section-resume"
      className="scroll-mt-24 grid grid-cols-1 lg:grid-cols-12 gap-8 py-8 border-b border-neutral-900"
    >
      {/* Left Column: Heading & Explanation */}
      <div className="lg:col-span-4">
        <h2 className="text-xl font-medium text-white tracking-tight">
          Resume
        </h2>
        <p className="text-sm text-neutral-400 mt-2 leading-relaxed">
          Manage your uploaded resumes, choose an active version for applications,
          and autofill your profile fields using AI extraction.
        </p>
      </div>

      {/* Right Column: Surface */}
      <div className="lg:col-span-8 bg-[#0A0A0A] border border-neutral-850 rounded-2xl p-6 sm:p-8 space-y-6">
        {resumes.length === 0 ? (
          /* State A: No resumes uploaded yet */
          <div className="text-center py-10 px-4 border border-dashed border-neutral-800 rounded-xl space-y-4">
            <div className="w-12 h-12 mx-auto rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-cyan-400">
              <CopilotIcon name="resume" className="w-6 h-6" />
            </div>

            <p className="eyebrow hidden" id="saved-resumes-title" style={{ margin: 0 }}>
              Saved resumes
            </p>
            <p className="eyebrow hidden" id="upload-resume-title" style={{ margin: 0 }}>
              Upload resume
            </p>

            <div className="space-y-1.5">
              <h3 className="text-lg font-semibold text-white tracking-tight">
                Start with your resume
              </h3>
              <p className="text-sm text-neutral-400 max-w-md mx-auto leading-relaxed">
                Upload a PDF or DOCX and we'll fill in your profile. You review everything before it's saved.
              </p>
            </div>

            <input
              ref={fileInputRefA}
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="hidden"
              onChange={handleDirectUpload}
              aria-label="Upload resume file"
            />

            <div>
              <button
                type="button"
                disabled={uploadBusy}
                onClick={() => fileInputRefA.current?.click()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors shadow disabled:opacity-40"
              >
                {uploadBusy ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    <span>Uploading…</span>
                  </>
                ) : (
                  <>
                    <CopilotIcon name="upload" className="w-3.5 h-3.5 text-black" />
                    <span>Upload resume</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-xs text-neutral-500 font-sans">
              Saved privately and available across the workspace
            </p>
          </div>
        ) : (
          /* State B: Resumes exist */
          <div className="space-y-6">
            {/* Header / Autofill option checkbox */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-850">
              <div>
                <p className="eyebrow" id="saved-resumes-title" style={{ margin: 0 }}>
                  Saved resumes
                </p>
                <h3 className="text-sm font-semibold text-white mt-1">
                  Resume library ({resumes.length})
                </h3>
              </div>

              {/* Autofill option checkbox */}
              <label className="inline-flex items-center gap-2 text-xs text-neutral-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={onlyFillEmpty}
                  onChange={(e) => onToggleOnlyFillEmpty(e.target.checked)}
                  className="rounded border-neutral-800 bg-neutral-900 text-cyan-500 focus:ring-0"
                />
                <span>Only fill empty profile fields (recommended)</span>
              </label>
            </div>

            {/* Hairline-separated rows of resumes */}
            <div className="divide-y divide-neutral-850 border border-neutral-850 rounded-xl overflow-hidden bg-neutral-900/30">
              {resumes.map((r, idx) => {
                const isActive = Boolean(r.is_active || r.id === activeResumeId || idx === 0);
                const title = r.filename || r.original_filename || `Resume ${idx + 1}`;
                const originalFile = r.original_filename || r.filename || "";
                const status = r.extraction_status || "confirmed";

                return (
                  <div
                    key={r.id}
                    className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-neutral-900/60 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-neutral-850 flex items-center justify-center shrink-0 text-cyan-400">
                        <CopilotIcon name="resume" className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white truncate">
                            {title}
                          </span>
                          {isActive && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                              ACTIVE
                            </span>
                          )}
                          <span className="text-[10px] text-neutral-500 font-mono">
                            {status}
                          </span>
                        </div>
                        {originalFile && originalFile !== title && (
                          <span className="text-xs text-neutral-500 truncate block mt-0.5">
                            {originalFile}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions: Set active, Rename, Autofill from this resume */}
                    <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      {!isActive && onSelectActiveResume && (
                        <button
                          type="button"
                          onClick={() => void onSelectActiveResume(r.id)}
                          className="px-2.5 py-1 text-xs font-medium text-neutral-300 hover:text-white rounded-lg bg-neutral-850 hover:bg-neutral-800 transition-colors"
                        >
                          Set active
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => openRenameDialog(r)}
                        className="px-2.5 py-1 text-xs font-medium text-neutral-300 hover:text-white rounded-lg bg-neutral-850 hover:bg-neutral-800 transition-colors"
                      >
                        Rename
                      </button>

                      <button
                        type="button"
                        onClick={() => onTriggerAutofill(r.id, onlyFillEmpty)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 hover:border-cyan-400/50 transition-colors shadow-sm"
                      >
                        <CopilotIcon name="sparkles" className="w-3.5 h-3.5" />
                        <span>Autofill from this resume</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Below: Upload a new resume */}
            <div className="pt-4 border-t border-neutral-850 space-y-3">
              <p className="eyebrow" id="upload-resume-title" style={{ margin: 0 }}>
                Upload a new resume
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-7">
                  <label
                    htmlFor="resume-name-input"
                    className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5"
                  >
                    Resume name
                  </label>
                  <input
                    id="resume-name-input"
                    type="text"
                    value={resumeTitle}
                    onChange={(e) => setResumeTitle(e.target.value)}
                    placeholder="e.g. Senior Backend Resume 2026"
                    className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs placeholder-neutral-500 focus:outline-none focus:border-cyan-500/60"
                  />
                </div>

                <div className="sm:col-span-5 flex items-center gap-2">
                  <input
                    ref={fileInputRefB}
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={handleFileSelect}
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRefB.current?.click()}
                    className="flex-1 px-3 py-2 rounded-xl text-xs font-medium text-neutral-200 bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 transition-colors truncate"
                  >
                    {selectedFile ? selectedFile.name : "Choose PDF or DOCX"}
                  </button>

                  <button
                    type="button"
                    disabled={!selectedFile || uploadBusy}
                    onClick={handleSubmitUpload}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors disabled:opacity-40 shrink-0"
                  >
                    {uploadBusy ? "Uploading…" : "Upload"}
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-neutral-500 font-sans">
                PDF or DOCX format. Maximum size: 10 MB.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Rename Resume Dialog */}
      {renamingResume && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-[#111111] border border-neutral-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-800">
              <h4 className="text-sm font-semibold text-white">
                Rename resume
              </h4>
              <button
                type="button"
                onClick={() => setRenamingResume(null)}
                className="text-neutral-500 hover:text-white text-sm"
              >
                ×
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-300 uppercase tracking-wider mb-1.5">
                New resume title
              </label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-neutral-900 border border-neutral-800 text-white text-xs focus:outline-none focus:border-cyan-500/60"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-neutral-800">
              <button
                type="button"
                onClick={() => setRenamingResume(null)}
                className="px-3.5 py-1.5 rounded-lg text-xs font-medium text-neutral-400 hover:text-white bg-neutral-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newTitle.trim() || renameBusy}
                onClick={handleSaveRename}
                className="px-4 py-1.5 rounded-lg text-xs font-medium text-black bg-white hover:bg-neutral-200 transition-colors disabled:opacity-40"
              >
                {renameBusy ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
