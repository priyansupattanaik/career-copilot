import { apiRequest } from "@/shared/api/client";
import type {
  ResumeContent,
  PresentationSettings,
  StudioSession,
  StudioSuggestion,
  SuggestAction,
} from "../model/resume-schema";

export function openStudioSession(payload: {
  source_version_id?: string;
  ats_analysis_id?: string;
  resume_id?: string;
}) {
  return apiRequest<StudioSession>("/resume-studio/sessions", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function readStudioSession(versionId: string, atsAnalysisId?: string) {
  const query = atsAnalysisId ? `?ats_analysis_id=${encodeURIComponent(atsAnalysisId)}` : "";
  return apiRequest<StudioSession>(`/resume-studio/sessions/${versionId}${query}`);
}

export function saveStudioSession(
  versionId: string,
  content: ResumeContent,
  presentation: PresentationSettings,
) {
  return apiRequest<StudioSession>(`/resume-studio/sessions/${versionId}`, {
    method: "PUT",
    body: JSON.stringify({ content, presentation }),
  });
}

export function resetStudioSession(versionId: string) {
  return apiRequest<StudioSession>(`/resume-studio/sessions/${versionId}/reset`, {
    method: "POST",
  });
}

export function suggestStudioRevision(
  versionId: string,
  payload: {
    action: SuggestAction;
    section_key: string;
    entry_id?: string;
    bullet_id?: string;
    selected_text: string;
    ats_issue?: string;
  },
) {
  return apiRequest<StudioSuggestion>(`/resume-studio/sessions/${versionId}/suggest`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function exportStudioPdf(versionId: string) {
  const record = await apiRequest<{ id: string }>(`/resume-versions/${versionId}/exports`, {
    method: "POST",
    body: JSON.stringify({ format: "pdf" }),
  });
  const download = await apiRequest<{ download_url: string; filename?: string }>(
    `/resume-exports/${record.id}/download`,
  );
  return download;
}

export function recalculateAts(resumeVersionId: string, jobDescriptionId: string) {
  return apiRequest<{
    id: string;
    overall_score: number | null;
    summary?: Record<string, unknown>;
    score_breakdown?: Record<string, unknown>;
  }>("/ats-analyses", {
    method: "POST",
    body: JSON.stringify({
      resume_version_id: resumeVersionId,
      job_description_id: jobDescriptionId,
    }),
  });
}

export function readAtsEvidence(analysisId: string) {
  return apiRequest<
    Array<{
      id: string;
      requirement_text: string;
      match_status: string;
      resume_evidence_text?: string | null;
      resume_section?: string | null;
    }>
  >(`/ats-analyses/${analysisId}/evidence`);
}
