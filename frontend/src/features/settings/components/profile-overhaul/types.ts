/* eslint-disable @typescript-eslint/no-explicit-any */

export interface CandidateLink {
  id?: string;
  link_type: string;
  url: string;
  label?: string;
}

export interface CandidateExperience {
  id?: string;
  company_name: string;
  role_title: string;
  employment_type?: string;
  start_date?: string;
  end_date?: string | null;
  is_current?: boolean;
  summary?: string;
}

export interface CandidateEducation {
  id?: string;
  institution: string;
  degree?: string;
  field_of_study?: string;
  start_year?: string;
  end_year?: string;
  grade_text?: string;
}

export interface CandidateSkill {
  id?: string;
  name: string;
  category?: string;
}

export interface CandidatePreferences {
  target_roles: string[];
  preferred_locations: string[];
  work_modes: string[];
  salary_min: number | string | null;
  salary_currency: string;
}

export interface ResumeItem {
  id: string;
  filename?: string;
  original_filename?: string;
  created_at?: string;
  version_number?: number;
  extraction_status?: string;
  is_active?: boolean;
}

export interface AutofillProposalField<T = any> {
  id?: string;
  value: T;
  evidence?: string | null;
  status: "new" | "differs" | "duplicate" | "unmapped";
  selected_by_default: boolean;
  basis?: any;
  current?: any;
  current_value?: any;
}

export interface AutofillParseResponse {
  resume_id?: string;
  schema_version?: string;
  prompt_version?: string;
  quality: "ok" | "partial" | "empty";
  dropped_count?: number;
  proposals: {
    about: {
      full_name?: AutofillProposalField<string>;
      headline?: AutofillProposalField<string>;
      bio?: AutofillProposalField<string>;
      current_role?: AutofillProposalField<string>;
      location?: AutofillProposalField<string>;
      years_of_experience?: AutofillProposalField<number>;
    };
    skills: Array<AutofillProposalField<string>>;
    experience: Array<AutofillProposalField<CandidateExperience>>;
    education: Array<AutofillProposalField<CandidateEducation>>;
    links: Array<AutofillProposalField<CandidateLink>>;
  };
}

export interface AutofillApplyPayload {
  about?: {
    full_name?: string;
    headline?: string;
    bio?: string;
    current_role?: string;
    location?: string;
    years_of_experience?: number;
  };
  skills?: string[];
  experience?: Array<Partial<CandidateExperience>>;
  education?: Array<Partial<CandidateEducation>>;
  links?: Array<Partial<CandidateLink>>;
}
