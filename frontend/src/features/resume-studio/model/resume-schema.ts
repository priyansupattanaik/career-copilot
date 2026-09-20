export type TemplateId = "classic" | "modern" | "minimal" | "swiss";
export type PageSize = "a4" | "letter";
export type FontId = "calibri" | "arial" | "georgia" | "garamond" | "palatino";
export type Alignment = "left" | "center" | "right";
export type DividerStyle = "none" | "line" | "space";
export type SuggestAction =
  | "improve_summary"
  | "improve_bullet"
  | "make_concise"
  | "make_achievement_oriented"
  | "improve_ats_relevance"
  | "suggest_stronger_wording"
  | "explain_recommendation"
  | "suggest_supported_skills";

export type StudioLink = { id: string; label: string; url: string };
export type PersonalInfo = {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  portfolio: string;
  website: string;
  other_links: StudioLink[];
};
export type SkillItem = { id: string; name: string };
export type SkillGroup = { id: string; name: string; items: SkillItem[] };
export type Bullet = { id: string; text: string };
export type ExperienceEntry = {
  id: string;
  employer: string;
  title: string;
  location: string;
  start_date: string;
  end_date: string;
  is_current: boolean;
  employment_type: string;
  bullets: Bullet[];
};
export type ProjectEntry = {
  id: string;
  name: string;
  description: string;
  technologies: string[];
  url: string;
  bullets: Bullet[];
};
export type EducationEntry = {
  id: string;
  institution: string;
  degree: string;
  specialization: string;
  location: string;
  start_date: string;
  end_date: string;
  gpa: string;
  details: string;
};
export type CertificationEntry = {
  id: string;
  name: string;
  issuer: string;
  date: string;
  credential_id: string;
  credential_url: string;
};
export type AchievementEntry = { id: string; text: string };
export type LanguageEntry = { id: string; language: string; proficiency: string };
export type AdditionalEntry = { id: string; text: string };
export type AdditionalSection = { id: string; title: string; entries: AdditionalEntry[] };

export type PresentationSettings = {
  template: TemplateId;
  page_size: PageSize;
  font_family: FontId;
  font_size: number;
  heading_size: number;
  heading_weight: 600 | 700;
  line_height: number;
  paragraph_spacing: number;
  section_spacing: number;
  heading_spacing: number;
  bullet_spacing: number;
  bullet_indent: number;
  margin_top: number;
  margin_right: number;
  margin_bottom: number;
  margin_left: number;
  header_alignment: Alignment;
  heading_alignment: "left" | "center";
  accent_color: string;
  divider: DividerStyle;
  section_overrides: Record<string, { font_size?: number; heading_size?: number }>;
};

export type ResumeContent = {
  personal: PersonalInfo;
  summary: string;
  skill_groups: SkillGroup[];
  experience: ExperienceEntry[];
  projects: ProjectEntry[];
  education: EducationEntry[];
  certifications: CertificationEntry[];
  achievements: AchievementEntry[];
  links: StudioLink[];
  languages: LanguageEntry[];
  additional: AdditionalSection[];
  section_order: string[];
  hidden_sections: string[];
};

export type StudioDocument = {
  schema_version: string;
  source_version_id: string;
  ats_analysis_id: string | null;
  content: ResumeContent;
  presentation: PresentationSettings;
};

export type AtsEvidenceRow = {
  id?: string;
  requirement_text?: string | null;
  requirement_type?: string | null;
  match_status?: string | null;
  resume_evidence_text?: string | null;
  resume_section?: string | null;
  explanation?: string | null;
};

export type StudioAtsContext = {
  analysis: {
    id: string;
    overall_score: number | null;
    status?: string;
    resume_version_id?: string;
    job_description_id?: string;
    created_at?: string;
    summary?: Record<string, unknown>;
    score_breakdown?: Record<string, unknown>;
  };
  evidence: AtsEvidenceRow[];
  job_description?: {
    id?: string;
    title?: string | null;
    company?: string | null;
    role_title?: string | null;
    raw_text?: string;
  } | null;
};

export type StudioSession = {
  working_version: {
    id: string;
    resume_id: string;
    version_number?: number;
    source_type?: string;
    extraction_status?: string;
    original_filename?: string;
    created_at?: string;
  };
  source_version: {
    id: string;
    resume_id: string;
    version_number?: number;
    source_type?: string;
    original_filename?: string;
  };
  resume: { id: string; title?: string | null; is_active?: boolean };
  document: StudioDocument;
  ats: StudioAtsContext | null;
};

export type StudioSuggestion = {
  original_text: string;
  proposed_text: string;
  reason: string;
  addresses: string;
  needs_candidate_input: boolean;
  missing_facts: string[];
  requires_confirmation: boolean;
  unsupported_claims: string[];
};

export const FONT_OPTIONS: { id: FontId; label: string; css: string; atsSafe: boolean }[] = [
  { id: "calibri", label: "Calibri (sans)", css: 'Calibri, "Segoe UI", Arial, sans-serif', atsSafe: true },
  { id: "arial", label: "Arial (sans)", css: "Arial, Helvetica, sans-serif", atsSafe: true },
  { id: "georgia", label: "Georgia (serif)", css: 'Georgia, "Times New Roman", serif', atsSafe: true },
  { id: "garamond", label: "Garamond (serif)", css: 'Garamond, Georgia, serif', atsSafe: true },
  { id: "palatino", label: "Palatino (serif)", css: 'Palatino, "Palatino Linotype", serif', atsSafe: true },
];

export const TEMPLATE_OPTIONS: { id: TemplateId; label: string; note: string }[] = [
  { id: "classic", label: "Classic", note: "Centered header, standard headings" },
  { id: "modern", label: "Modern", note: "Accent headings and a stronger divider" },
  { id: "minimal", label: "Minimal", note: "Quiet spacing, fewer lines" },
  { id: "swiss", label: "Swiss", note: "Editorial grid, bold typography, mono tags, and sharp high-contrast borders" },
];

export const CORE_SECTIONS = [
  "personal",
  "summary",
  "skills",
  "experience",
  "projects",
  "education",
  "certifications",
  "achievements",
  "languages",
  "links",
] as const;

export function newId(prefix: string) {
  const bytes =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : Math.random().toString(16).slice(2, 14);
  return `${prefix}-${bytes}`;
}

export function sectionLabel(key: string, content: ResumeContent) {
  if (key.startsWith("additional:")) {
    const extra = content.additional.find((item) => `additional:${item.id}` === key);
    return extra?.title?.trim() || "Additional";
  }
  const labels: Record<string, string> = {
    personal: "Personal information",
    summary: "Professional summary",
    skills: "Skills",
    experience: "Experience",
    projects: "Projects",
    education: "Education",
    certifications: "Certifications",
    achievements: "Achievements",
    languages: "Languages",
    links: "Links",
  };
  return labels[key] || key.replace(/_/g, " ");
}

export function emptyPersonal(): PersonalInfo {
  return {
    name: "",
    email: "",
    phone: "",
    location: "",
    linkedin: "",
    github: "",
    portfolio: "",
    website: "",
    other_links: [],
  };
}

export function defaultPresentation(): PresentationSettings {
  return {
    template: "classic",
    page_size: "a4",
    font_family: "calibri",
    font_size: 10.5,
    heading_size: 12.5,
    heading_weight: 700,
    line_height: 1.28,
    paragraph_spacing: 4,
    section_spacing: 12,
    heading_spacing: 4,
    bullet_spacing: 2,
    bullet_indent: 14,
    margin_top: 16,
    margin_right: 16,
    margin_bottom: 16,
    margin_left: 16,
    header_alignment: "center",
    heading_alignment: "left",
    accent_color: "#1e3a5f",
    divider: "line",
    section_overrides: {},
  };
}

export function cloneDocument(document: StudioDocument): StudioDocument {
  return JSON.parse(JSON.stringify(document)) as StudioDocument;
}

export function emptyCustomSection(): AdditionalSection {
  return { id: newId("add"), title: "Additional", entries: [{ id: newId("line"), text: "" }] };
}

export function emptySection(key: string): Partial<ResumeContent> {
  if (key === "summary") return { summary: "" };
  if (key === "skills") return { skill_groups: [{ id: newId("sg"), name: "", items: [{ id: newId("skill"), name: "" }] }] };
  if (key === "experience") {
    return {
      experience: [
        {
          id: newId("exp"),
          employer: "",
          title: "",
          location: "",
          start_date: "",
          end_date: "",
          is_current: false,
          employment_type: "",
          bullets: [{ id: newId("b"), text: "" }],
        },
      ],
    };
  }
  if (key === "projects") {
    return {
      projects: [{ id: newId("proj"), name: "", description: "", technologies: [], url: "", bullets: [{ id: newId("b"), text: "" }] }],
    };
  }
  if (key === "education") {
    return {
      education: [
        { id: newId("edu"), institution: "", degree: "", specialization: "", location: "", start_date: "", end_date: "", gpa: "", details: "" },
      ],
    };
  }
  if (key === "certifications") {
    return { certifications: [{ id: newId("cert"), name: "", issuer: "", date: "", credential_id: "", credential_url: "" }] };
  }
  if (key === "achievements") return { achievements: [{ id: newId("ach"), text: "" }] };
  if (key === "languages") return { languages: [{ id: newId("lang"), language: "", proficiency: "" }] };
  if (key === "links") return { links: [{ id: newId("link"), label: "", url: "" }] };
  return {};
}
