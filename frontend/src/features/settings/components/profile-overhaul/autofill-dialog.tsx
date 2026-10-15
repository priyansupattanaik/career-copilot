import { useEffect, useState, useRef } from "react";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import { apiRequest } from "@/shared/api/client";
import type {
  AutofillParseResponse,
  AutofillApplyPayload,
  CandidateExperience,
  CandidateEducation,
  CandidateLink,
} from "./types";

interface AutofillDialogProps {
  resumeId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onApplied: () => Promise<void>;
}

type DialogStage = "idle" | "parsing" | "review" | "applying" | "error";

export function AutofillDialog({
  resumeId,
  isOpen,
  onClose,
  onApplied,
}: AutofillDialogProps) {
  const [stage, setStage] = useState<DialogStage>("idle");
  const [warmNotice, setWarmNotice] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [parseResult, setParseResult] = useState<AutofillParseResponse | null>(null);

  // Selection state for proposals
  const [selectedAbout, setSelectedAbout] = useState<{
    full_name: boolean;
    current_role: boolean;
    location: boolean;
    years_of_experience: boolean;
  }>({
    full_name: true,
    current_role: true,
    location: true,
    years_of_experience: true,
  });

  const [selectedSkills, setSelectedSkills] = useState<Record<number, boolean>>({});
  const [selectedExperience, setSelectedExperience] = useState<Record<number, boolean>>({});
  const [selectedEducation, setSelectedEducation] = useState<Record<number, boolean>>({});
  const [selectedLinks, setSelectedLinks] = useState<Record<number, boolean>>({});

  const abortControllerRef = useRef<AbortController | null>(null);

  // Trigger parsing when dialog opens with a valid resumeId
  useEffect(() => {
    if (!isOpen || !resumeId) {
      setStage("idle");
      setWarmNotice(false);
      setErrorMessage("");
      setParseResult(null);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      return;
    }

    setStage("parsing");
    setWarmNotice(false);
    setErrorMessage("");

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // Show warming notice after 4 seconds
    const warmTimer = setTimeout(() => {
      setWarmNotice(true);
    }, 4000);

    // Timeout after 80 seconds
    const timeoutTimer = setTimeout(() => {
      controller.abort();
      setStage("error");
      setErrorMessage("The request timed out. Please try again.");
    }, 80000);

    void (async () => {
      try {
        const res = await apiRequest<AutofillParseResponse>("/profile/autofill/parse", {
          method: "POST",
          body: JSON.stringify({
            resume_id: resumeId,
            only_fill_empty: true,
          }),
          signal: controller.signal,
        });

        clearTimeout(warmTimer);
        clearTimeout(timeoutTimer);

        setParseResult(res);

        // Pre-select items per proposals' selected_by_default
        const aboutProps = res.proposals?.about || {};
        setSelectedAbout({
          full_name: Boolean(aboutProps.full_name?.selected_by_default),
          current_role: Boolean(aboutProps.current_role?.selected_by_default),
          location: Boolean(aboutProps.location?.selected_by_default),
          years_of_experience: Boolean(aboutProps.years_of_experience?.selected_by_default),
        });

        const skillsMap: Record<number, boolean> = {};
        (res.proposals?.skills || []).forEach((s, i) => {
          skillsMap[i] = Boolean(s.selected_by_default);
        });
        setSelectedSkills(skillsMap);

        const expMap: Record<number, boolean> = {};
        (res.proposals?.experience || []).forEach((e, i) => {
          expMap[i] = Boolean(e.selected_by_default);
        });
        setSelectedExperience(expMap);

        const eduMap: Record<number, boolean> = {};
        (res.proposals?.education || []).forEach((ed, i) => {
          eduMap[i] = Boolean(ed.selected_by_default);
        });
        setSelectedEducation(eduMap);

        const linkMap: Record<number, boolean> = {};
        (res.proposals?.links || []).forEach((l, i) => {
          linkMap[i] = Boolean(l.selected_by_default);
        });
        setSelectedLinks(linkMap);

        setStage("review");
      } catch (err: any) {
        clearTimeout(warmTimer);
        clearTimeout(timeoutTimer);
        if (controller.signal.aborted) return;

        setStage("error");
        const code = err?.code || "";
        const status = err?.status || err?.status_code;

        if (code === "PARSE_RATE_LIMITED" || (status === 429 && code.includes("LIMIT"))) {
          setErrorMessage("You've reached the autofill limit for this hour. Please try again later.");
        } else if (code === "PARSE_BUSY" || status === 429) {
          setErrorMessage("Autofill is busy right now. Try again in a minute.");
        } else if (code === "PARSE_INVALID" || status === 422) {
          setErrorMessage("We couldn't read this resume reliably. You can fill your profile manually.");
        } else if (code === "PARSE_UNAVAILABLE" || status === 503) {
          setErrorMessage("Autofill isn't available right now. You can fill your profile manually and try again later.");
        } else {
          setErrorMessage(err?.message || "Failed to parse resume. You can fill your profile manually.");
        }
      }
    })();

    return () => {
      clearTimeout(warmTimer);
      clearTimeout(timeoutTimer);
      controller.abort();
    };
  }, [isOpen, resumeId]);

  // Apply handler
  async function handleApply() {
    if (!parseResult || !resumeId) return;

    setStage("applying");
    try {
      const proposals = parseResult.proposals;
      const changes: AutofillApplyPayload = {};

      // 1. About fields
      const aboutObj: Record<string, any> = {};
      if (selectedAbout.full_name && proposals.about?.full_name?.value) {
        aboutObj.full_name = proposals.about.full_name.value;
      }
      if (selectedAbout.current_role && proposals.about?.current_role?.value) {
        aboutObj.current_role = proposals.about.current_role.value;
      }
      if (selectedAbout.location && proposals.about?.location?.value) {
        aboutObj.location = proposals.about.location.value;
      }
      if (selectedAbout.years_of_experience && proposals.about?.years_of_experience?.value != null) {
        aboutObj.years_of_experience = proposals.about.years_of_experience.value;
      }
      if (Object.keys(aboutObj).length > 0) {
        changes.about = aboutObj;
      }

      // 2. Skills
      const chosenSkills: string[] = [];
      (proposals.skills || []).forEach((s, idx) => {
        if (selectedSkills[idx] && s.value) {
          chosenSkills.push(s.value);
        }
      });
      if (chosenSkills.length > 0) {
        changes.skills = chosenSkills;
      }

      // 3. Experience
      const chosenExp: CandidateExperience[] = [];
      (proposals.experience || []).forEach((e, idx) => {
        if (selectedExperience[idx] && e.value) {
          chosenExp.push(e.value);
        }
      });
      if (chosenExp.length > 0) {
        changes.experience = chosenExp;
      }

      // 4. Education
      const chosenEdu: CandidateEducation[] = [];
      (proposals.education || []).forEach((ed, idx) => {
        if (selectedEducation[idx] && ed.value) {
          chosenEdu.push(ed.value);
        }
      });
      if (chosenEdu.length > 0) {
        changes.education = chosenEdu;
      }

      // 5. Links
      const chosenLinks: CandidateLink[] = [];
      (proposals.links || []).forEach((l, idx) => {
        if (selectedLinks[idx] && l.value) {
          chosenLinks.push(l.value);
        }
      });
      if (chosenLinks.length > 0) {
        changes.links = chosenLinks;
      }

      await apiRequest("/profile/autofill/apply", {
        method: "POST",
        body: JSON.stringify({
          resume_id: resumeId,
          changes,
        }),
      });

      await onApplied();
      onClose();
    } catch (err: any) {
      setStage("error");
      setErrorMessage(err?.message || "Failed to apply profile changes.");
    }
  }

  // Count total items selected
  const totalSelected =
    (selectedAbout.full_name ? 1 : 0) +
    (selectedAbout.current_role ? 1 : 0) +
    (selectedAbout.location ? 1 : 0) +
    (selectedAbout.years_of_experience ? 1 : 0) +
    Object.values(selectedSkills).filter(Boolean).length +
    Object.values(selectedExperience).filter(Boolean).length +
    Object.values(selectedEducation).filter(Boolean).length +
    Object.values(selectedLinks).filter(Boolean).length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-2xl rounded-2xl bg-[#0D0D0D] border border-neutral-800 shadow-2xl flex flex-col max-h-[88vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-neutral-850 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <CopilotIcon name="sparkles" className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                {stage === "review" ? "Review what we found" : "AI Resume Autofill"}
              </h3>
              <p className="text-xs text-neutral-400 font-sans">
                {stage === "review"
                  ? "Select the details you would like to import into your profile."
                  : "Scanning and extracting structured candidate profile data."}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-neutral-500 hover:text-white p-1.5 text-base transition-colors"
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Stage: Parsing */}
          {stage === "parsing" && (
            <div className="py-12 text-center space-y-4">
              <div className="w-12 h-12 mx-auto border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin" />
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-white">
                  Analyzing your resume with AI...
                </h4>
                <p className="text-xs text-neutral-400 max-w-sm mx-auto">
                  Extracting your work experience, education, verified skills, and links.
                </p>
              </div>
              {warmNotice && (
                <p className="text-xs text-cyan-400/90 font-medium animate-in fade-in max-w-xs mx-auto">
                  AI models warming up, please wait...
                </p>
              )}
            </div>
          )}

          {/* Stage: Error */}
          {stage === "error" && (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 mx-auto rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <CopilotIcon name="alert" className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-white">
                  Autofill Notice
                </h4>
                <p className="text-xs text-neutral-300 max-w-md mx-auto leading-relaxed">
                  {errorMessage}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="mt-2 px-4 py-2 rounded-xl text-xs font-semibold bg-neutral-800 hover:bg-neutral-700 text-white transition-colors"
              >
                Close & Enter Manually
              </button>
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
              {/* Quality Banner if partial */}
              {parseResult.quality === "partial" && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
                  <CopilotIcon name="alert" className="w-4 h-4 shrink-0" />
                  <span>
                    Some items could not be verified from the resume text and were excluded for accuracy.
                  </span>
                </div>
              )}

              {/* 1. About You Proposals */}
              {parseResult.proposals?.about && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider pb-1 border-b border-neutral-850">
                    About you
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Full Name */}
                    {parseResult.proposals.about.full_name && (
                      <ProposalCheckItem
                        label="Full name"
                        value={parseResult.proposals.about.full_name.value}
                        status={parseResult.proposals.about.full_name.status}
                        checked={selectedAbout.full_name}
                        onChange={(c) => setSelectedAbout({ ...selectedAbout, full_name: c })}
                      />
                    )}
                    {/* Current Role */}
                    {parseResult.proposals.about.current_role && (
                      <ProposalCheckItem
                        label="Current role"
                        value={parseResult.proposals.about.current_role.value}
                        status={parseResult.proposals.about.current_role.status}
                        checked={selectedAbout.current_role}
                        onChange={(c) => setSelectedAbout({ ...selectedAbout, current_role: c })}
                      />
                    )}
                    {/* Location */}
                    {parseResult.proposals.about.location && (
                      <ProposalCheckItem
                        label="Location"
                        value={parseResult.proposals.about.location.value}
                        status={parseResult.proposals.about.location.status}
                        checked={selectedAbout.location}
                        onChange={(c) => setSelectedAbout({ ...selectedAbout, location: c })}
                      />
                    )}
                    {/* Years of Experience */}
                    {parseResult.proposals.about.years_of_experience && (
                      <ProposalCheckItem
                        label="Experience"
                        value={`${parseResult.proposals.about.years_of_experience.value} years`}
                        subtext={parseResult.proposals.about.years_of_experience.basis}
                        status={parseResult.proposals.about.years_of_experience.status}
                        checked={selectedAbout.years_of_experience}
                        onChange={(c) => setSelectedAbout({ ...selectedAbout, years_of_experience: c })}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* 2. Skills Proposals */}
              {parseResult.proposals?.skills && parseResult.proposals.skills.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between pb-1 border-b border-neutral-850">
                    <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
                      Skills ({parseResult.proposals.skills.length})
                    </h4>
                    <button
                      type="button"
                      onClick={() => {
                        const allSelected = Object.values(selectedSkills).every(Boolean);
                        const next: Record<number, boolean> = {};
                        parseResult.proposals.skills.forEach((_, idx) => {
                          next[idx] = !allSelected;
                        });
                        setSelectedSkills(next);
                      }}
                      className="text-[11px] text-cyan-400 hover:text-cyan-300"
                    >
                      Toggle all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {parseResult.proposals.skills.map((s, idx) => (
                      <label
                        key={idx}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs cursor-pointer border transition-all ${
                          selectedSkills[idx]
                            ? "bg-neutral-900 border-neutral-700 text-white"
                            : "bg-neutral-950/60 border-neutral-850 text-neutral-400 opacity-60"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(selectedSkills[idx])}
                          onChange={(e) =>
                            setSelectedSkills({ ...selectedSkills, [idx]: e.target.checked })
                          }
                          className="rounded border-neutral-700 bg-neutral-900 text-cyan-500 focus:ring-0"
                        />
                        <span>{s.value}</span>
                        <StatusBadge status={s.status} />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Work Experience Proposals */}
              {parseResult.proposals?.experience && parseResult.proposals.experience.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider pb-1 border-b border-neutral-850">
                    Work Experience ({parseResult.proposals.experience.length})
                  </h4>
                  <div className="space-y-2">
                    {parseResult.proposals.experience.map((expProp, idx) => {
                      const exp = expProp.value;
                      return (
                        <label
                          key={idx}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            selectedExperience[idx]
                              ? "bg-neutral-900/70 border-neutral-750"
                              : "bg-neutral-950/40 border-neutral-850 opacity-60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(selectedExperience[idx])}
                            onChange={(e) =>
                              setSelectedExperience({ ...selectedExperience, [idx]: e.target.checked })
                            }
                            className="mt-1 rounded border-neutral-700 bg-neutral-900 text-cyan-500 focus:ring-0 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-white truncate">
                                {exp.role_title} at {exp.company_name}
                              </span>
                              <StatusBadge status={expProp.status} />
                            </div>
                            <span className="text-[11px] text-neutral-400 block mt-0.5">
                              {exp.start_date || "Start"} – {exp.is_current ? "Present" : exp.end_date || "End"}
                            </span>
                            {exp.summary && (
                              <p className="text-xs text-neutral-300 mt-1 line-clamp-2">
                                {exp.summary}
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. Education Proposals */}
              {parseResult.proposals?.education && parseResult.proposals.education.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider pb-1 border-b border-neutral-850">
                    Education ({parseResult.proposals.education.length})
                  </h4>
                  <div className="space-y-2">
                    {parseResult.proposals.education.map((eduProp, idx) => {
                      const edu = eduProp.value;
                      return (
                        <label
                          key={idx}
                          className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            selectedEducation[idx]
                              ? "bg-neutral-900/70 border-neutral-750"
                              : "bg-neutral-950/40 border-neutral-850 opacity-60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(selectedEducation[idx])}
                            onChange={(e) =>
                              setSelectedEducation({ ...selectedEducation, [idx]: e.target.checked })
                            }
                            className="mt-0.5 rounded border-neutral-700 bg-neutral-900 text-cyan-500 focus:ring-0 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold text-white">
                                {edu.institution}
                              </span>
                              <StatusBadge status={eduProp.status} />
                            </div>
                            <span className="text-[11px] text-neutral-400 block mt-0.5">
                              {[edu.degree, edu.field_of_study, [edu.start_year, edu.end_year].filter(Boolean).join("-")]
                                .filter(Boolean)
                                .join(" • ")}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 5. Links Proposals */}
              {parseResult.proposals?.links && parseResult.proposals.links.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-neutral-300 uppercase tracking-wider pb-1 border-b border-neutral-850">
                    Links ({parseResult.proposals.links.length})
                  </h4>
                  <div className="space-y-2">
                    {parseResult.proposals.links.map((linkProp, idx) => {
                      const l = linkProp.value;
                      return (
                        <label
                          key={idx}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                            selectedLinks[idx]
                              ? "bg-neutral-900/70 border-neutral-750"
                              : "bg-neutral-950/40 border-neutral-850 opacity-60"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={Boolean(selectedLinks[idx])}
                            onChange={(e) =>
                              setSelectedLinks({ ...selectedLinks, [idx]: e.target.checked })
                            }
                            className="rounded border-neutral-700 bg-neutral-900 text-cyan-500 focus:ring-0 shrink-0"
                          />
                          <span className="text-xs text-neutral-300 truncate flex-1">
                            <strong className="uppercase text-[10px] text-neutral-400 mr-2">
                              {l.link_type}:
                            </strong>
                            {l.url}
                          </span>
                          <StatusBadge status={linkProp.status} />
                        </label>
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
          <div className="p-4 border-t border-neutral-850 bg-neutral-950/50 flex items-center justify-between shrink-0">
            <span className="text-xs text-neutral-400">
              {totalSelected} changes selected
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-medium text-neutral-400 hover:text-white bg-neutral-900"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={totalSelected === 0}
                onClick={handleApply}
                className="px-5 py-2 rounded-xl text-xs font-semibold text-black bg-white hover:bg-neutral-200 transition-colors disabled:opacity-40"
              >
                Apply {totalSelected} changes
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "new" | "differs" | "duplicate" }) {
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
        Differs
      </span>
    );
  }
  return (
    <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wider bg-neutral-800 text-neutral-400 shrink-0">
      Exists
    </span>
  );
}

function ProposalCheckItem({
  label,
  value,
  subtext,
  status,
  checked,
  onChange,
}: {
  label: string;
  value: string;
  subtext?: string;
  status: "new" | "differs" | "duplicate";
  checked: boolean;
  onChange: (c: boolean) => void;
}) {
  return (
    <label
      className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all ${
        checked
          ? "bg-neutral-900/70 border-neutral-750"
          : "bg-neutral-950/40 border-neutral-850 opacity-60"
      }`}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 rounded border-neutral-700 bg-neutral-900 text-cyan-500 focus:ring-0 shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1.5">
          <span className="text-[10px] text-neutral-400 font-semibold uppercase tracking-wider">
            {label}
          </span>
          <StatusBadge status={status} />
        </div>
        <span className="text-xs text-white font-medium block truncate mt-0.5">
          {value}
        </span>
        {subtext && (
          <span className="text-[10px] text-neutral-500 block mt-0.5">
            {subtext}
          </span>
        )}
      </div>
    </label>
  );
}
