import { useEffect, useState, useRef } from "react";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import { apiRequest } from "@/shared/api/client";
import type {
  AutofillParseResponse,
  AutofillApplyPayload,
  AutofillProposalField,
} from "./types";

interface AutofillDialogProps {
  resumeId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onApplied: () => Promise<void>;
  onlyFillEmpty?: boolean;
}

type DialogStage = "idle" | "parsing" | "review" | "empty" | "applying" | "error";

interface ErrorInfo {
  copy: string;
  canRetry: boolean;
}

function mapAutofillError(err: any): ErrorInfo {
  const code = String(err?.code || err?.error || "").toUpperCase();
  const status = Number(err?.status || err?.status_code || 0);

  if (code === "UNSUPPORTED_FILE" || status === 415) {
    return { copy: "Upload a PDF or DOCX file.", canRetry: false };
  }
  if (code === "FILE_TOO_LARGE" || status === 413) {
    return { copy: "This file is too large. The limit is 10 MB.", canRetry: false };
  }
  if (code === "RATE_LIMITED" || (status === 429 && code.includes("RATE"))) {
    return { copy: "You've reached the hourly limit for autofill. Try again later.", canRetry: false };
  }
  if (code === "NO_TEXT") {
    return {
      copy: "We couldn't read any text in this file. If it's a scan, upload a text-based PDF or a DOCX.",
      canRetry: true,
    };
  }
  if (code === "TEXT_TOO_LONG") {
    return {
      copy: "This resume is longer than we can read. Try a shorter version.",
      canRetry: true,
    };
  }
  if (code === "PARSE_BUSY" || status === 429) {
    return { copy: "Autofill is busy right now. Try again in a minute.", canRetry: true };
  }
  if (code === "PARSE_INVALID" || (status === 422 && code.includes("INVALID"))) {
    return {
      copy: "We couldn't read this resume reliably. You can fill your profile manually.",
      canRetry: true,
    };
  }
  if (code === "PARSE_UNAVAILABLE" || status === 503) {
    return {
      copy: "Autofill isn't available right now. You can fill your profile manually and try again later.",
      canRetry: true,
    };
  }
  if (status === 422) {
    return {
      copy: "We couldn't read this resume reliably. You can fill your profile manually.",
      canRetry: true,
    };
  }
  return {
    copy: "Autofill isn't available right now. You can fill your profile manually and try again later.",
    canRetry: true,
  };
}

export function AutofillDialog({
  resumeId,
  isOpen,
  onClose,
  onApplied,
  onlyFillEmpty = true,
}: AutofillDialogProps) {
  const [stage, setStage] = useState<DialogStage>("idle");
  const [coldStartNotice, setColdStartNotice] = useState(false);
  const [errorInfo, setErrorInfo] = useState<ErrorInfo | null>(null);
  const [parseResult, setParseResult] = useState<AutofillParseResponse | null>(null);
  const [partialSaveError, setPartialSaveError] = useState<string>("");

  // Selections
  const [selectedAbout, setSelectedAbout] = useState<Record<string, boolean>>({});
  const [selectedSkills, setSelectedSkills] = useState<Record<number, boolean>>({});
  const [selectedExperience, setSelectedExperience] = useState<Record<number, boolean>>({});
  const [selectedEducation, setSelectedEducation] = useState<Record<number, boolean>>({});
  const [selectedLinks, setSelectedLinks] = useState<Record<number, boolean>>({});

  // Expandable evidence state
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({});

  const abortControllerRef = useRef<AbortController | null>(null);

  function toggleEvidence(key: string) {
    setExpandedEvidence((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function runParse() {
    if (!resumeId) return;
    setStage("parsing");
    setColdStartNotice(false);
    setErrorInfo(null);
    setPartialSaveError("");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Show cold start notice after 4 seconds
    const coldTimer = setTimeout(() => {
      setColdStartNotice(true);
    }, 4000);

    // 80 seconds timeout
    const timeoutTimer = setTimeout(() => {
      controller.abort();
      setStage("error");
      setErrorInfo({
        copy: "Autofill isn't available right now. You can fill your profile manually and try again later.",
        canRetry: true,
      });
    }, 80000);

    try {
      const res = await apiRequest<AutofillParseResponse>("/profile/autofill/parse", {
        method: "POST",
        body: JSON.stringify({
          resume_id: resumeId,
          only_fill_empty: onlyFillEmpty,
        }),
        signal: controller.signal,
      });

      clearTimeout(coldTimer);
      clearTimeout(timeoutTimer);

      if (res.quality === "empty") {
        setStage("empty");
        setParseResult(res);
        return;
      }

      setParseResult(res);

      // Initialize selections per Step 4.3:
      // IF onlyFillEmpty -> only "new" is checked
      // IF OFF -> "new" and "differs" are checked
      // "duplicate" and "unmapped" are never checked by default
      const isEligible = (field?: AutofillProposalField) => {
        if (!field) return false;
        if (field.status === "duplicate" || field.status === "unmapped") return false;
        if (onlyFillEmpty) return field.status === "new";
        return field.status === "new" || field.status === "differs";
      };

      const aboutInit: Record<string, boolean> = {};
      const aboutProps = res.proposals?.about || {};
      for (const [k, field] of Object.entries(aboutProps)) {
        aboutInit[k] = isEligible(field);
      }
      setSelectedAbout(aboutInit);

      const skillInit: Record<number, boolean> = {};
      (res.proposals?.skills || []).forEach((s, idx) => {
        skillInit[idx] = isEligible(s);
      });
      setSelectedSkills(skillInit);

      const expInit: Record<number, boolean> = {};
      (res.proposals?.experience || []).forEach((e, idx) => {
        expInit[idx] = isEligible(e);
      });
      setSelectedExperience(expInit);

      const eduInit: Record<number, boolean> = {};
      (res.proposals?.education || []).forEach((ed, idx) => {
        eduInit[idx] = isEligible(ed);
      });
      setSelectedEducation(eduInit);

      const linkInit: Record<number, boolean> = {};
      (res.proposals?.links || []).forEach((l, idx) => {
        linkInit[idx] = isEligible(l);
      });
      setSelectedLinks(linkInit);

      setStage("review");
    } catch (err: any) {
      clearTimeout(coldTimer);
      clearTimeout(timeoutTimer);
      if (controller.signal.aborted) return;
      setStage("error");
      setErrorInfo(mapAutofillError(err));
    }
  }

  useEffect(() => {
    if (!isOpen || !resumeId) {
      setStage("idle");
      setColdStartNotice(false);
      setErrorInfo(null);
      setParseResult(null);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      return;
    }

    void runParse();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [isOpen, resumeId, onlyFillEmpty]);

  // Apply selected changes
  async function handleApply() {
    if (!parseResult || !resumeId) return;

    setStage("applying");
    setPartialSaveError("");

    try {
      const proposals = parseResult.proposals;
      const changes: AutofillApplyPayload = {};

      // 1. About
      const aboutObj: Record<string, any> = {};
      if (selectedAbout.full_name && proposals.about?.full_name?.value) {
        aboutObj.full_name = proposals.about.full_name.value;
      }
      if (selectedAbout.headline && proposals.about?.headline?.value) {
        aboutObj.headline = proposals.about.headline.value;
      }
      if (selectedAbout.bio && proposals.about?.bio?.value) {
        aboutObj.bio = proposals.about.bio.value;
      }
      if (selectedAbout.current_role && proposals.about?.current_role?.value) {
        aboutObj.current_role = proposals.about.current_role.value;
      }
      if (selectedAbout.location && proposals.about?.location?.value) {
        aboutObj.location = proposals.about.location.value;
      }
      if (
        selectedAbout.years_of_experience &&
        proposals.about?.years_of_experience?.value !== undefined
      ) {
        aboutObj.years_of_experience = proposals.about.years_of_experience.value;
      }
      if (Object.keys(aboutObj).length > 0) {
        changes.about = aboutObj;
      }

      // 2. Skills
      const skillsList: string[] = [];
      (proposals.skills || []).forEach((s, idx) => {
        if (selectedSkills[idx] && s.value) {
          skillsList.push(s.value);
        }
      });
      if (skillsList.length > 0) {
        changes.skills = skillsList;
      }

      // 3. Experience
      const expList: any[] = [];
      (proposals.experience || []).forEach((e, idx) => {
        if (selectedExperience[idx] && e.value) {
          expList.push(e.value);
        }
      });
      if (expList.length > 0) {
        changes.experience = expList;
      }

      // 4. Education
      const eduList: any[] = [];
      (proposals.education || []).forEach((ed, idx) => {
        if (selectedEducation[idx] && ed.value) {
          eduList.push(ed.value);
        }
      });
      if (eduList.length > 0) {
        changes.education = eduList;
      }

      // 5. Links
      const linkList: any[] = [];
      (proposals.links || []).forEach((l, idx) => {
        if (selectedLinks[idx] && l.value) {
          linkList.push(l.value);
        }
      });
      if (linkList.length > 0) {
        changes.links = linkList;
      }

      const applyRes = await apiRequest<{
        applied?: {
          about: boolean;
          skills: number;
          experience: number;
          education: number;
          links: number;
        };
      }>("/profile/autofill/apply", {
        method: "POST",
        body: JSON.stringify({
          resume_id: resumeId,
          changes,
        }),
      });

      // Invalidate and refresh profile
      await onApplied();

      // Check if partial failure occurred
      const app = applyRes?.applied;
      const expectedAbout = Boolean(changes.about);
      const aboutFailed = expectedAbout && !app?.about;
      const expectedSkills = (changes.skills || []).length;
      const skillsFailed = expectedSkills > 0 && (app?.skills || 0) < expectedSkills;
      const expectedExp = (changes.experience || []).length;
      const expFailed = expectedExp > 0 && (app?.experience || 0) < expectedExp;

      if (aboutFailed || skillsFailed || expFailed) {
        setStage("review");
        setPartialSaveError("Some sections could not be saved");
        return;
      }

      onClose();

      // Move focus to identity strip heading
      const heading = document.getElementById("identity-strip-heading");
      if (heading) {
        heading.focus();
      }
    } catch {
      setStage("review");
      setPartialSaveError("Some sections could not be saved");
    }
  }

  // Count total selected items
  const totalSelected =
    Object.values(selectedAbout).filter(Boolean).length +
    Object.values(selectedSkills).filter(Boolean).length +
    Object.values(selectedExperience).filter(Boolean).length +
    Object.values(selectedEducation).filter(Boolean).length +
    Object.values(selectedLinks).filter(Boolean).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div
        className="w-full max-w-2xl rounded-2xl flex flex-col max-h-[88vh] overflow-hidden"
        style={{
          backgroundColor: "var(--ps-panel, var(--surface))",
          border: "1px solid var(--ps-line, var(--border))",
          borderRadius: "var(--ps-radius-lg, 20px)",
          color: "var(--ps-text, var(--text))",
          boxShadow: "0 20px 50px rgb(0 0 0 / 30%)",
        }}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between p-5 shrink-0"
          style={{ borderBottom: "1px solid var(--ps-line, var(--border))" }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                backgroundColor: "var(--ps-accent-soft, var(--accent-soft))",
                border: "1px solid var(--ps-accent, var(--accent))",
                color: "var(--ps-accent, var(--accent))",
              }}
            >
              <CopilotIcon name="sparkles" className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold" style={{ color: "var(--ps-text, var(--text))", margin: 0 }}>
                {stage === "review" ? "Review what we found" : "AI Resume Autofill"}
              </h3>
              <p className="text-xs font-sans" style={{ color: "var(--ps-muted, var(--muted))", margin: 0 }}>
                {stage === "review"
                  ? "Nothing is saved until you apply."
                  : "Scanning and extracting structured candidate profile data."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-base transition-colors"
            style={{ color: "var(--ps-muted, var(--muted))", background: "none", border: "none", cursor: "pointer" }}
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Stage: Parsing */}
          {stage === "parsing" && (
            <div className="py-12 text-center space-y-4">
              <div
                className="w-12 h-12 mx-auto rounded-full animate-spin"
                style={{
                  border: "2px solid var(--hairline-strong)",
                  borderTopColor: "var(--accent)",
                }}
              />
              <div className="space-y-1">
                <p
                  className="text-sm font-semibold text-white"
                  aria-live="polite"
                >
                  Reading your resume…
                </p>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  Extracting your work history, education, skills, and links without hallucination.
                </p>
              </div>
              {coldStartNotice && (
                <p
                  className="text-xs font-medium animate-in fade-in max-w-xs mx-auto"
                  style={{ color: "var(--accent)" }}
                >
                  AI models warming up, please wait...
                </p>
              )}
            </div>
          )}

          {/* Stage: Empty */}
          {stage === "empty" && (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center text-neutral-400">
                <CopilotIcon name="alert" className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-white">
                  We couldn't find profile details in this file.
                </h4>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  You can enter your information manually in each section.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
              >
                Close
              </button>
            </div>
          )}

          {/* Stage: Error */}
          {stage === "error" && errorInfo && (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <CopilotIcon name="alert" className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-white">
                  Autofill Notice
                </h4>
                <p className="text-xs text-neutral-300 max-w-md mx-auto leading-relaxed">
                  {errorInfo.copy}
                </p>
              </div>
              <div className="flex justify-center gap-3 pt-2">
                {errorInfo.canRetry && (
                  <button
                    type="button"
                    onClick={() => void runParse()}
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-white text-black hover:bg-neutral-200 transition-colors"
                  >
                    Try again
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Stage: Applying */}
          {stage === "applying" && (
            <div className="py-12 text-center space-y-4">
              <div className="w-10 h-10 mx-auto border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <p className="text-sm font-semibold text-white">
                Applying updates to your profile...
              </p>
            </div>
          )}

          {/* Stage: Review Proposals */}
          {stage === "review" && parseResult && (
            <div className="space-y-6">
              {/* Partial Save Notice */}
              {partialSaveError && (
                <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <CopilotIcon name="alert" className="w-4 h-4 shrink-0" />
                  <span>{partialSaveError}</span>
                </div>
              )}

              {/* Quality Banner if partial */}
              {parseResult.quality === "partial" && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                  <CopilotIcon name="alert" className="w-4 h-4 shrink-0" />
                  <span>
                    We found only part of your resume. Please check the details before applying.
                  </span>
                </div>
              )}

              {/* 1. About You Proposals */}
              {parseResult.proposals?.about && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-neutral-850">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Object.values(selectedAbout).some(Boolean)}
                        onChange={(e) => {
                          const val = e.target.checked;
                          const next: Record<string, boolean> = {};
                          for (const [k, f] of Object.entries(parseResult.proposals.about)) {
                            if (f && f.status !== "duplicate") {
                              next[k] = val;
                            }
                          }
                          setSelectedAbout(next);
                        }}
                        className="rounded border-neutral-700 bg-neutral-900 accent-[var(--accent)] focus:ring-0"
                      />
                      <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                        About you
                      </h4>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {Object.entries(parseResult.proposals.about).map(([k, field]) => {
                      if (!field || field.value === undefined || field.value === null) return null;
                      const labelMap: Record<string, string> = {
                        full_name: "Full name",
                        headline: "Headline",
                        bio: "About / Bio",
                        location: "Location",
                        current_role: "Current role",
                        years_of_experience: "Years of experience",
                      };
                      const displayVal =
                        k === "years_of_experience"
                          ? `${field.value} years`
                          : String(field.value);

                      return (
                        <ProposalRow
                          key={k}
                          label={labelMap[k] || k}
                          value={displayVal}
                          status={field.status}
                          currentValue={field.current || field.current_value}
                          evidence={field.evidence}
                          checked={Boolean(selectedAbout[k])}
                          onToggle={(c) => setSelectedAbout({ ...selectedAbout, [k]: c })}
                          isEvidenceExpanded={Boolean(expandedEvidence[`about_${k}`])}
                          onToggleEvidence={() => toggleEvidence(`about_${k}`)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 2. Skills Proposals */}
              {parseResult.proposals?.skills && parseResult.proposals.skills.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-neutral-850">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Object.values(selectedSkills).some(Boolean)}
                        onChange={(e) => {
                          const val = e.target.checked;
                          const next: Record<number, boolean> = {};
                          parseResult.proposals.skills.forEach((s, idx) => {
                            if (s.status !== "duplicate") {
                              next[idx] = val;
                            }
                          });
                          setSelectedSkills(next);
                        }}
                        className="rounded border-neutral-700 bg-neutral-900 accent-[var(--accent)] focus:ring-0"
                      />
                      <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                        Skills ({parseResult.proposals.skills.length})
                      </h4>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {parseResult.proposals.skills.map((s, idx) => {
                      const isDup = s.status === "duplicate";
                      return (
                        <label
                          key={idx}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border transition-all ${
                            isDup
                              ? "bg-neutral-950/40 border-neutral-850 text-neutral-500 opacity-60 cursor-not-allowed"
                              : selectedSkills[idx]
                              ? "bg-neutral-900 border-neutral-700 text-white cursor-pointer"
                              : "bg-neutral-950/60 border-neutral-850 text-neutral-400 cursor-pointer"
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={isDup}
                            checked={Boolean(selectedSkills[idx])}
                            onChange={(e) =>
                              setSelectedSkills({ ...selectedSkills, [idx]: e.target.checked })
                            }
                            className="rounded border-neutral-700 bg-neutral-900 accent-[var(--accent)] focus:ring-0 disabled:opacity-40"
                          />
                          <span>{s.value}</span>
                          <StatusBadge status={s.status} />
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 3. Experience Proposals */}
              {parseResult.proposals?.experience && parseResult.proposals.experience.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-neutral-850">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Object.values(selectedExperience).some(Boolean)}
                        onChange={(e) => {
                          const val = e.target.checked;
                          const next: Record<number, boolean> = {};
                          parseResult.proposals.experience.forEach((exp, idx) => {
                            if (exp.status !== "duplicate") {
                              next[idx] = val;
                            }
                          });
                          setSelectedExperience(next);
                        }}
                        className="rounded border-neutral-700 bg-neutral-900 accent-[var(--accent)] focus:ring-0"
                      />
                      <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                        Experience ({parseResult.proposals.experience.length})
                      </h4>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {parseResult.proposals.experience.map((expProp, idx) => {
                      const exp = expProp.value;
                      const titleLine = `${exp.role_title || "Role"} · ${exp.company_name || "Company"}`;
                      const subLine = [
                        exp.employment_type,
                        [exp.start_date, exp.is_current ? "Present" : exp.end_date].filter(Boolean).join(" – "),
                      ]
                        .filter(Boolean)
                        .join(" • ");

                      return (
                        <ProposalRow
                          key={idx}
                          label={titleLine}
                          value={subLine}
                          summary={exp.summary}
                          status={expProp.status}
                          currentValue={expProp.current || expProp.current_value}
                          evidence={expProp.evidence}
                          checked={Boolean(selectedExperience[idx])}
                          onToggle={(c) =>
                            setSelectedExperience({ ...selectedExperience, [idx]: c })
                          }
                          isEvidenceExpanded={Boolean(expandedEvidence[`exp_${idx}`])}
                          onToggleEvidence={() => toggleEvidence(`exp_${idx}`)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. Education Proposals */}
              {parseResult.proposals?.education && parseResult.proposals.education.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-neutral-850">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Object.values(selectedEducation).some(Boolean)}
                        onChange={(e) => {
                          const val = e.target.checked;
                          const next: Record<number, boolean> = {};
                          parseResult.proposals.education.forEach((edu, idx) => {
                            if (edu.status !== "duplicate") {
                              next[idx] = val;
                            }
                          });
                          setSelectedEducation(next);
                        }}
                        className="rounded border-neutral-700 bg-neutral-900 accent-[var(--accent)] focus:ring-0"
                      />
                      <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                        Education ({parseResult.proposals.education.length})
                      </h4>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {parseResult.proposals.education.map((eduProp, idx) => {
                      const edu = eduProp.value;
                      const titleLine = `${edu.degree || "Degree"} · ${edu.field_of_study || "Field"}`;
                      const subLine = [
                        edu.institution,
                        [edu.start_year, edu.end_year].filter(Boolean).join(" – "),
                        edu.grade_text,
                      ]
                        .filter(Boolean)
                        .join(" • ");

                      return (
                        <ProposalRow
                          key={idx}
                          label={titleLine}
                          value={subLine}
                          status={eduProp.status}
                          currentValue={eduProp.current || eduProp.current_value}
                          evidence={eduProp.evidence}
                          checked={Boolean(selectedEducation[idx])}
                          onToggle={(c) =>
                            setSelectedEducation({ ...selectedEducation, [idx]: c })
                          }
                          isEvidenceExpanded={Boolean(expandedEvidence[`edu_${idx}`])}
                          onToggleEvidence={() => toggleEvidence(`edu_${idx}`)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 5. Links Proposals */}
              {parseResult.proposals?.links && parseResult.proposals.links.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-neutral-850">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Object.values(selectedLinks).some(Boolean)}
                        onChange={(e) => {
                          const val = e.target.checked;
                          const next: Record<number, boolean> = {};
                          parseResult.proposals.links.forEach((l, idx) => {
                            if (l.status !== "duplicate") {
                              next[idx] = val;
                            }
                          });
                          setSelectedLinks(next);
                        }}
                        className="rounded border-neutral-700 bg-neutral-900 accent-[var(--accent)] focus:ring-0"
                      />
                      <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                        Links ({parseResult.proposals.links.length})
                      </h4>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {parseResult.proposals.links.map((linkProp, idx) => {
                      const l = linkProp.value;
                      return (
                        <ProposalRow
                          key={idx}
                          label={l.link_type}
                          value={l.url}
                          status={linkProp.status}
                          currentValue={linkProp.current || linkProp.current_value}
                          evidence={linkProp.evidence}
                          checked={Boolean(selectedLinks[idx])}
                          onToggle={(c) => setSelectedLinks({ ...selectedLinks, [idx]: c })}
                          isEvidenceExpanded={Boolean(expandedEvidence[`link_${idx}`])}
                          onToggleEvidence={() => toggleEvidence(`link_${idx}`)}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        {stage === "review" && (
          <div
            className="p-4 flex items-center justify-between shrink-0"
            style={{
              borderTop: "1px solid var(--ps-line, var(--border))",
              backgroundColor: "color-mix(in srgb, var(--ps-soft, var(--surface-muted)) 50%, var(--ps-panel, var(--surface)))",
            }}
          >
            <span className="text-xs" style={{ color: "var(--ps-muted, var(--muted))" }}>
              {totalSelected} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="button button-secondary"
                style={{ minHeight: 36, padding: "6px 14px", fontSize: 13 }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={totalSelected === 0}
                onClick={handleApply}
                className="button button-primary"
                style={{ minHeight: 36, padding: "6px 16px", fontSize: 13 }}
              >
                Apply selected ({totalSelected})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface ProposalRowProps {
  label: string;
  value: string;
  summary?: string;
  status: "new" | "differs" | "duplicate" | "unmapped";
  currentValue?: any;
  evidence?: string | null;
  checked: boolean;
  onToggle: (checked: boolean) => void;
  isEvidenceExpanded: boolean;
  onToggleEvidence: () => void;
}

function ProposalRow({
  label,
  value,
  summary,
  status,
  currentValue,
  evidence,
  checked,
  onToggle,
  isEvidenceExpanded,
  onToggleEvidence,
}: ProposalRowProps) {
  const isDup = status === "duplicate";

  return (
    <div
      className={`p-3 rounded-xl border transition-all space-y-1.5 ${
        isDup
          ? "bg-neutral-950/40 border-neutral-850 opacity-60"
          : checked
          ? "bg-neutral-900/70 border-neutral-750"
          : "bg-neutral-950/60 border-neutral-850"
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          disabled={isDup}
          checked={checked}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-0.5 rounded border-neutral-700 bg-neutral-900 accent-[var(--accent)] focus:ring-0 shrink-0 disabled:opacity-40"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold text-white">
              {label}
            </span>
            <StatusBadge status={status} />
          </div>

          <p className="text-xs text-neutral-300 mt-0.5 leading-relaxed font-sans">
            {value}
          </p>

          {summary && (
            <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2 leading-relaxed">
              {summary}
            </p>
          )}

          {/* Differs from your profile: show current value below in --ink-3 */}
          {status === "differs" && currentValue && (
            <p className="text-[11px] text-neutral-500 mt-1">
              Current: {String(currentValue)}
            </p>
          )}

          {/* Expandable 'From your resume' line */}
          {evidence && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onToggleEvidence}
                className="text-[10px] font-medium inline-flex items-center gap-1 hover:underline"
                style={{ color: "var(--accent)" }}
              >
                <span>From your resume</span>
                <CopilotIcon
                  name="chevron-down"
                  className={`w-2.5 h-2.5 transition-transform ${isEvidenceExpanded ? "rotate-180" : ""}`}
                />
              </button>
              {isEvidenceExpanded && (
                <p className="text-[11px] text-neutral-400 mt-1 pl-2 border-l border-neutral-800 italic bg-neutral-950/60 p-1.5 rounded">
                  "{evidence}"
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "new" | "differs" | "duplicate" | "unmapped" }) {
  if (status === "new") {
    return (
      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 shrink-0">
        New
      </span>
    );
  }
  if (status === "differs") {
    return (
      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-amber-500/10 text-amber-400 border border-amber-500/30 shrink-0">
        Differs from your profile
      </span>
    );
  }
  if (status === "unmapped") {
    return (
      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-purple-500/10 text-purple-400 border border-purple-500/30 shrink-0">
        Not in our list
      </span>
    );
  }
  return (
    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-neutral-800 text-neutral-400 shrink-0">
      Already in your profile
    </span>
  );
}
