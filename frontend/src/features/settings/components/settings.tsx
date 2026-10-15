import { usePathname } from "@/shared/router";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Link } from "@/shared/ui/router-link";
import LoadingState from "@/components/ui/loading-state";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest } from "@/shared/api/client";
import { deleteAccount as deleteAccountRequest, saveCareerPreferences, saveSettingsRecord } from "../api";
import { createClient } from "@/features/auth/api/client";
import {
  Button,
  Card,
  Input,
  PageHeader,
  Progress,
  Select,
  Textarea,
} from "@/shared/ui/primitives";
import { CopilotIcon, type CopilotIconName } from "@/components/ui/copilot-icons";
import { AnimatePresence, motion, MotionConfig, useReducedMotion } from "motion/react";
import { FLUID_SPRING_TRANSITION, premiumTransition } from "@/components/ui/motion-system";
import { cn } from "@/shared/utils";
import {
  clampCompletion,
  extractMissing,
  notifyProfileUpdated,
} from "@/features/profile/model/profile-completion";
import {
  isPublicProfileUsername,
  normalizePublicProfileUsername,
} from "@/features/profile/model/public-profile-username";
import { copyTextToClipboard } from "@/shared/utils/clipboard";
import { SETTINGS_TABS } from "../model/settings-tabs";
import "../profile-v2.css";
import { ProfileOverhaulView } from "./profile-overhaul/profile-overhaul-view";

const PROFILE_NAV = [
  {
    id: "profile-details",
    label: "Details",
    icon: "profile" as CopilotIconName,
  },
  { id: "profile-resume", label: "Resume", icon: "resume" as CopilotIconName },
  {
    id: "profile-preferences",
    label: "Career Preferences",
    icon: "jobs" as CopilotIconName,
  },
  { id: "profile-skills", label: "Skills", icon: "skills" as CopilotIconName },
  {
    id: "profile-experience",
    label: "Experience",
    icon: "evidence" as CopilotIconName,
  },
  {
    id: "profile-education",
    label: "Education",
    icon: "learning" as CopilotIconName,
  },
  { id: "profile-links", label: "Links", icon: "link" as CopilotIconName },
] as const;

function sectionForMissingKey(key: string): string {
  const k = String(key || "").toLowerCase();
  if (k.includes("skill")) return "profile-skills";
  if (k.includes("experience") || k.includes("employment"))
    return "profile-experience";
  if (
    k.includes("education") ||
    k.includes("degree") ||
    k.includes("institution")
  )
    return "profile-education";
  if (
    k.includes("link") ||
    k.includes("linkedin") ||
    k.includes("github") ||
    k.includes("portfolio")
  ) {
    return "profile-links";
  }
  if (k.includes("resume")) return "profile-resume";
  if (
    k.includes("prefer") ||
    k.includes("target_role") ||
    k.includes("industry") ||
    k.includes("salary") ||
    k.includes("relocat") ||
    k.includes("work_mode") ||
    k.includes("authorization")
  ) {
    return "profile-preferences";
  }
  return "profile-details";
}

const PROFILE_EDITABLE_FIELDS = [
  "full_name",
  "username",
  "headline",
  "bio",
  "phone",
  "location",
  "current_role",
  "years_experience",
  "career_level",
  "career_goal",
] as const;

const CAREER_LEVEL_OPTIONS = [
  { value: "fresher", label: "Fresher / Entry" },
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid-level" },
  { value: "senior", label: "Senior" },
  { value: "lead", label: "Lead" },
  { value: "manager", label: "Manager" },
  { value: "executive", label: "Executive" },
] as const;

const YEARS_OPTIONS = [
  0, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15, 20, 25, 30,
] as const;

const WORK_MODE_OPTIONS = [
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
] as const;

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "full_time", label: "Full-time" },
  { value: "part_time", label: "Part-time" },
  { value: "contract", label: "Contract" },
  { value: "internship", label: "Internship" },
  { value: "freelance", label: "Freelance" },
] as const;

const WORK_AUTHORIZATION_OPTIONS = [
  { value: "citizen", label: "Citizen / unrestricted" },
  { value: "permanent_resident", label: "Permanent resident" },
  { value: "work_permit", label: "Work permit / visa" },
  { value: "student_visa", label: "Student visa" },
  { value: "sponsorship_required", label: "Sponsorship required" },
] as const;

const NOTICE_PERIOD_OPTIONS = [
  { value: "", label: "Select notice period" },
  { value: "0", label: "Immediate (0 days)" },
  { value: "15", label: "15 days" },
  { value: "30", label: "30 days" },
  { value: "45", label: "45 days" },
  { value: "60", label: "60 days" },
  { value: "90", label: "90 days" },
] as const;

const CURRENCY_OPTIONS = [
  { value: "INR", label: "INR" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
  { value: "AUD", label: "AUD" },
  { value: "CAD", label: "CAD" },
  { value: "SGD", label: "SGD" },
] as const;

const TARGET_ROLE_OPTIONS = [
  "Software Engineer",
  "Backend Engineer",
  "Frontend Engineer",
  "Full Stack Engineer",
  "Data Analyst",
  "Data Scientist",
  "Data Engineer",
  "Machine Learning Engineer",
  "DevOps Engineer",
  "Cloud Engineer",
  "QA Engineer",
  "Product Manager",
  "UI/UX Designer",
  "Business Analyst",
  "Cybersecurity Analyst",
] as const;

const INDUSTRY_OPTIONS = [
  "Technology",
  "Finance",
  "Healthcare",
  "Education",
  "E-commerce",
  "Manufacturing",
  "Consulting",
  "Telecommunications",
  "Government",
  "Media",
  "Startup",
] as const;

const LOCATION_OPTIONS = [
  "Remote",
  "Pune",
  "Bengaluru",
  "Hyderabad",
  "Mumbai",
  "Delhi NCR",
  "Chennai",
  "Kolkata",
  "Ahmedabad",
  "Jaipur",
  "Noida",
  "Gurgaon",
] as const;

const SKILL_OPTIONS = [
  "Python",
  "Java",
  "JavaScript",
  "TypeScript",
  "SQL",
  "React",
  "Node.js",
  "Next.js",
  "Django",
  "FastAPI",
  "Spring Boot",
  "AWS",
  "Azure",
  "Docker",
  "Kubernetes",
  "Git",
  "Power BI",
  "Tableau",
  "Machine Learning",
  "HTML/CSS",
] as const;

const DEGREE_OPTIONS = [
  { value: "B.Tech", label: "B.Tech" },
  { value: "B.E.", label: "B.E." },
  { value: "B.Sc", label: "B.Sc" },
  { value: "BCA", label: "BCA" },
  { value: "M.Tech", label: "M.Tech" },
  { value: "M.Sc", label: "M.Sc" },
  { value: "MCA", label: "MCA" },
  { value: "MBA", label: "MBA" },
  { value: "PG-DAC", label: "PG-DAC" },
  { value: "Diploma", label: "Diploma" },
  { value: "PhD", label: "PhD" },
] as const;

const FIELD_OF_STUDY_OPTIONS = [
  "Computer Science",
  "Information Technology",
  "Electronics",
  "Data Science",
  "Artificial Intelligence",
  "Mechanical",
  "Business",
] as const;

const CAREER_GOAL_OPTIONS = [
  { value: "switch_role", label: "Switch role" },
  { value: "get_first_job", label: "Get first job" },
  { value: "promotion", label: "Get promoted" },
  { value: "upskill", label: "Upskill in current role" },
  { value: "relocate", label: "Relocate for work" },
  { value: "freelance", label: "Move to freelance / contract" },
] as const;

const LINK_TYPE_OPTIONS = [
  { value: "linkedin", label: "LinkedIn" },
  { value: "github", label: "GitHub" },
  { value: "portfolio", label: "Portfolio" },
  { value: "website", label: "Website" },
  { value: "other", label: "Other" },
] as const;

type ProfileRecord = Record<string, any>;

function experienceDateLabel(row: ProfileRecord): string {
  if (!row.start_date && !row.end_date && !row.is_current) return "";
  const display = (value: unknown) => {
    const text = String(value || "");
    if (!/^\d{4}-\d{2}/.test(text)) return text;
    const [year, month] = text.split("-");
    return new Intl.DateTimeFormat("en", {
      month: "short",
      year: "numeric",
    }).format(new Date(Number(year), Number(month) - 1, 1));
  };
  return `${display(row.start_date) || "Unknown start"} – ${row.is_current ? "Present" : display(row.end_date) || "Unknown end"}`;
}

function profileInitials(name: unknown): string {
  const initials = String(name || "U")
    .split(" ")
    .map((part) => part[0] || "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return initials || "U";
}

type PrefDraft = {
  target_roles: string[];
  preferred_industries: string[];
  preferred_locations: string[];
  work_modes: string[];
  employment_types: string[];
  notice_period_days: string;
  work_authorization: string;
  salary_min: string;
  salary_currency: string;
  willing_to_relocate: boolean;
};

function Frame({
  children,
  title,
  description,
  className,
}: {
  children: React.ReactNode;
  title: string;
  description: string;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();
  const path = usePathname();
  return (
    <div className={cn("feature-page settings-page profile-v2", className)}>
      <PageHeader title={title} description={description} />
      <nav className="settings-nav" aria-label="Settings sections">
        {SETTINGS_TABS.map((tab) => {
          const active = path === tab.href;
          return (
            <Link
              key={tab.href}
              className={cn("settings-nav-tab", active && "is-active")}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              style={{ position: "relative" }}
            >
              {active && (
                <motion.span
                  layoutId="settings-tab-pill"
                  transition={
                    shouldReduceMotion
                      ? { duration: 0 }
                      : FLUID_SPRING_TRANSITION
                  }
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "inherit",
                    background: "var(--ps-panel, var(--surface))",
                    border: "1px solid var(--ps-line, var(--border))",
                    boxShadow:
                      "0 1px 4px rgb(15 23 42 / 08%), 0 2px 8px rgb(15 23 42 / 06%)",
                    pointerEvents: "none",
                    zIndex: 0,
                  }}
                />
              )}
              <span
                style={{
                  position: "relative",
                  zIndex: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <CopilotIcon name={tab.icon} size={15} />
                {tab.label}
              </span>
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}


function ProfileSectionHead({
  icon,
  title,
  lede,
  required,
}: {
  icon: CopilotIconName;
  title: string;
  lede?: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div className="profile-section-head">
      <div className="profile-section-kicker">
        <span className="profile-section-icon" aria-hidden="true">
          <CopilotIcon name={icon} size={18} />
        </span>
        <h2>
          {title}
          {required ? <RequiredMark /> : null}
        </h2>
      </div>
      {lede ? <p className="profile-section-lede">{lede}</p> : null}
    </div>
  );
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [];
}

function emptyPreferences() {
  return {
    target_roles: [] as string[],
    preferred_industries: [] as string[],
    preferred_locations: [] as string[],
    work_modes: [] as string[],
    employment_types: [] as string[],
    notice_period_days: null as number | null,
    willing_to_relocate: false,
    work_authorization: "",
    salary_min: null as number | null,
    salary_currency: "",
  };
}

function emptyPrefDraft(): PrefDraft {
  return {
    target_roles: [],
    preferred_industries: [],
    preferred_locations: [],
    work_modes: [],
    employment_types: [],
    notice_period_days: "",
    work_authorization: "",
    salary_min: "",
    salary_currency: "",
    willing_to_relocate: false,
  };
}

function prefsToDraft(prefs: Record<string, any>): PrefDraft {
  return {
    target_roles: asStringArray(prefs.target_roles),
    preferred_industries: asStringArray(prefs.preferred_industries),
    preferred_locations: asStringArray(prefs.preferred_locations),
    work_modes: asStringArray(prefs.work_modes),
    employment_types: asStringArray(prefs.employment_types),
    notice_period_days:
      prefs.notice_period_days == null ? "" : String(prefs.notice_period_days),
    work_authorization: prefs.work_authorization || "",
    salary_min: prefs.salary_min == null ? "" : String(prefs.salary_min),
    salary_currency: prefs.salary_currency || "",
    willing_to_relocate: Boolean(prefs.willing_to_relocate),
  };
}

const OTHER_VALUE = "__other__";

function normalizeOptions(
  options: readonly { value: string; label: string }[] | readonly string[],
): Array<{ value: string; label: string }> {
  return options.map((option) =>
    typeof option === "string"
      ? { value: option, label: option }
      : { value: option.value, label: option.label },
  );
}

/** Dropdown that supports an Other choice and persists the custom typed value. */
function RequiredMark() {
  return (
    <span className="required-star" aria-hidden="true">
      *
    </span>
  );
}

/**
 * Select + free-text "Other" field (text and numbers).
 *
 * Sticky Other mode for ALL fields: once Other is active (dropdown choice, typing in
 * the custom box, or a non-preset value already saved), typing never snaps back to a
 * matching preset mid-word (e.g. "Pune", "Python", "Java", "0.9").
 * Only choosing another option in the dropdown leaves Other mode.
 * Always uses type="text" so intermediate strings are not coerced.
 */
function SelectWithOther({
  label,
  options,
  value,
  onChange,
  emptyLabel = "Select…",
  otherPlaceholder = "Enter custom value",
  inputType = "text",
  required = false,
}: {
  label: string;
  options: readonly { value: string; label: string }[] | readonly string[];
  value: string;
  onChange: (value: string) => void;
  emptyLabel?: string;
  otherPlaceholder?: string;
  /** Keyboard hint only — the field is always a text input. */
  inputType?: "text" | "number";
  required?: boolean;
}) {
  const optionList = normalizeOptions(options).filter(
    (option) => option.value !== "" && option.value !== OTHER_VALUE,
  );
  const knownKey = optionList.map((option) => option.value).join("\0");
  const known = useMemo(
    () => new Set(optionList.map((option) => option.value)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [knownKey],
  );

  const trimmed = (value || "").trim();
  const isPreset = Boolean(trimmed) && known.has(trimmed);
  const isCustomStored = Boolean(trimmed) && !known.has(trimmed);

  // Sticky lock: set true when entering Other or typing; only cleared by dropdown preset.
  // Fix producer: sync to value so external load (profile fetch) does not leave stale lock.
  const [otherLocked, setOtherLocked] = useState(isCustomStored);
  useEffect(() => {
    if (isCustomStored) setOtherLocked(true);
    else if (isPreset) setOtherLocked(false);
  }, [isCustomStored, isPreset]);
  // Custom stored values always show Other UI; locked keeps it while typing presets names.
  const inOther = otherLocked || isCustomStored;
  const selectValue = inOther ? OTHER_VALUE : isPreset ? trimmed : "";
  const inputMode = inputType === "number" ? "decimal" : "text";

  return (
    <div className="profile-field">
      <label className="field-label">
        <span>
          {label}
          {required ? <RequiredMark /> : null}
        </span>
        <Select
          value={selectValue}
          onChange={(e: any) => {
            const next = e.target.value;
            if (next === OTHER_VALUE) {
              setOtherLocked(true);
              // Fresh custom entry when leaving a preset.
              if (isPreset) onChange("");
            } else {
              setOtherLocked(false);
              onChange(next);
            }
          }}
        >
          <option value="">{emptyLabel}</option>
          {optionList.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          <option value={OTHER_VALUE}>Other</option>
        </Select>
      </label>
      {inOther && (
        <label className="field-label profile-other-field">
          Specify other
          <Input
            type="text"
            inputMode={inputMode}
            autoComplete="off"
            spellCheck={inputType !== "number"}
            value={value ?? ""}
            onChange={(e: any) => {
              // Keep Other for the entire typing session (text or number).
              setOtherLocked(true);
              onChange(e.target.value);
            }}
            placeholder={otherPlaceholder}
          />
        </label>
      )}
    </div>
  );
}

/**
 * Multi-select via dropdown (not a checkbox grid).
 * Same string[] contract as before — only the UI is compact.
 */
function MultiOptionGroup({
  legend,
  options,
  selected,
  onChange,
  allowOther = false,
  otherPlaceholder = "Enter custom value",
  required = false,
}: {
  legend: string;
  options: readonly { value: string; label: string }[] | readonly string[];
  selected: string[];
  onChange: (next: string[]) => void;
  allowOther?: boolean;
  otherPlaceholder?: string;
  required?: boolean;
}) {
  const baseOptions = normalizeOptions(options).filter(
    (option) => option.value !== OTHER_VALUE,
  );
  const labelByValue = new Map(
    baseOptions.map((option) => [option.value, option.label]),
  );
  for (const value of selected) {
    if (!labelByValue.has(value)) labelByValue.set(value, value);
  }
  const available = baseOptions.filter(
    (option) => !selected.includes(option.value),
  );
  const [pickerValue, setPickerValue] = useState("");
  const [otherText, setOtherText] = useState("");
  const [showOtherInput, setShowOtherInput] = useState(false);

  function addValue(value: string) {
    const next = value.trim();
    if (!next || selected.includes(next)) return;
    onChange([...selected, next]);
  }

  function removeValue(value: string) {
    onChange(selected.filter((item) => item !== value));
  }

  function addOtherValue() {
    const text = otherText.trim();
    if (!text) return;
    // Commit only on Add / Enter — never while typing.
    addValue(text);
    setOtherText("");
    setShowOtherInput(false);
    setPickerValue("");
  }

  return (
    <fieldset className="profile-choice-group">
      <legend>
        {legend}
        {required ? <RequiredMark /> : null}
      </legend>

      <label className="field-label">
        Add {legend.toLowerCase()}
        <Select
          value={pickerValue}
          onChange={(e: any) => {
            const next = e.target.value;
            if (!next) {
              setPickerValue("");
              return;
            }
            if (next === OTHER_VALUE) {
              setPickerValue(OTHER_VALUE);
              setShowOtherInput(true);
              return;
            }
            addValue(next);
            setPickerValue("");
            setShowOtherInput(false);
            setOtherText("");
          }}
        >
          <option value="">
            {available.length === 0 && !allowOther
              ? "All options selected"
              : `Select ${legend.toLowerCase()}…`}
          </option>
          {available.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
          {allowOther ? <option value={OTHER_VALUE}>Other…</option> : null}
        </Select>
      </label>

      {allowOther && showOtherInput && (
        <div className="profile-composer">
          <label className="field-label">
            Specify other
            <Input
              type="text"
              autoComplete="off"
              value={otherText}
              onChange={(e: any) => setOtherText(e.target.value)}
              placeholder={otherPlaceholder}
              onKeyDown={(e: any) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addOtherValue();
                }
              }}
            />
          </label>
          <div className="profile-composer-actions">
            <Button
              type="button"
              onClick={addOtherValue}
              disabled={!otherText.trim()}
            >
              Add
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setShowOtherInput(false);
                setOtherText("");
                setPickerValue("");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {selected.length > 0 ? (
        <MotionConfig transition={premiumTransition.card}>
          <motion.div
            layout
            className="cluster"
            role="list"
            aria-label={`Selected ${legend.toLowerCase()}`}
          >
            <AnimatePresence mode="popLayout" initial={false}>
              {selected.map((value) => (
                <motion.span
                  key={value}
                  layout
                  initial={{ opacity: 0, scale: 0.985 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.985 }}
                  className="badge badge-info"
                  role="listitem"
                  style={{ gap: 8 }}
                >
                  {labelByValue.get(value) || value}
                  <button
                    type="button"
                    className="button-quiet"
                    style={{
                      minHeight: "auto",
                      padding: 0,
                      boxShadow: "none",
                      border: "none",
                      fontWeight: 600,
                    }}
                    onClick={() => removeValue(value)}
                    aria-label={`Remove ${labelByValue.get(value) || value}`}
                  >
                    ×
                  </button>
                </motion.span>
              ))}
            </AnimatePresence>
          </motion.div>
        </MotionConfig>
      ) : (
        <p className="mono" style={{ margin: 0, opacity: 0.8 }}>
          None selected yet{required ? " (required)" : ""}.
        </p>
      )}
    </fieldset>
  );
}

type ResumeListItem = {
  id: string;
  title: string;
  is_active?: boolean;
  latest_version?: {
    id: string;
    original_filename?: string;
    extraction_status?: string;
  } | null;
};

type ProfileDraft = {
  profile: ProfileRecord;
  skills: ProfileRecord[];
  experiences: ProfileRecord[];
  education: ProfileRecord[];
  projects?: ProfileRecord[];
  certifications?: ProfileRecord[];
  languages?: ProfileRecord[];
  links: ProfileRecord[];
  meta?: {
    warnings?: string[];
    email_detected?: string | null;
    method?: string;
  };
};

function CareerPreferencesFields({
  prefDraft,
  setPrefDraft,
  onSave,
  saving,
  message,
  error,
  inProfileCard = false,
}: {
  prefDraft: PrefDraft;
  setPrefDraft: React.Dispatch<React.SetStateAction<PrefDraft>>;
  onSave: () => void | Promise<void>;
  saving: boolean;
  message?: string;
  error?: string;
  inProfileCard?: boolean;
}) {
  return (
    <>
      <div className="profile-fields">
        <MultiOptionGroup
          legend="Target roles"
          options={TARGET_ROLE_OPTIONS}
          selected={prefDraft.target_roles}
          onChange={(target_roles) =>
            setPrefDraft((prev) => ({ ...prev, target_roles }))
          }
          allowOther
          otherPlaceholder="Enter another target role"
          required
        />
        <MultiOptionGroup
          legend="Preferred industries"
          options={INDUSTRY_OPTIONS}
          selected={prefDraft.preferred_industries}
          onChange={(preferred_industries) =>
            setPrefDraft((prev) => ({ ...prev, preferred_industries }))
          }
          allowOther
          otherPlaceholder="Enter another industry"
        />
        <MultiOptionGroup
          legend="Preferred locations"
          options={LOCATION_OPTIONS}
          selected={prefDraft.preferred_locations}
          onChange={(preferred_locations) =>
            setPrefDraft((prev) => ({ ...prev, preferred_locations }))
          }
          allowOther
          otherPlaceholder="Enter another location"
          required
        />
        <MultiOptionGroup
          legend="Work modes"
          options={WORK_MODE_OPTIONS}
          selected={prefDraft.work_modes}
          onChange={(work_modes) =>
            setPrefDraft((prev) => ({ ...prev, work_modes }))
          }
          required
        />
        <MultiOptionGroup
          legend="Employment types"
          options={EMPLOYMENT_TYPE_OPTIONS}
          selected={prefDraft.employment_types}
          onChange={(employment_types) =>
            setPrefDraft((prev) => ({ ...prev, employment_types }))
          }
          allowOther
          otherPlaceholder="Enter another employment type"
        />
      </div>
      <div className="profile-fields">
        <SelectWithOther
          label="Work authorization"
          options={WORK_AUTHORIZATION_OPTIONS}
          value={prefDraft.work_authorization}
          onChange={(work_authorization) =>
            setPrefDraft((prev) => ({ ...prev, work_authorization }))
          }
          emptyLabel="Select work authorization"
          otherPlaceholder="Describe work authorization"
        />
        <SelectWithOther
          label="Notice period"
          options={NOTICE_PERIOD_OPTIONS.filter(
            (option) => option.value !== "",
          )}
          value={prefDraft.notice_period_days}
          onChange={(notice_period_days) =>
            setPrefDraft((prev) => ({ ...prev, notice_period_days }))
          }
          emptyLabel="Select notice period"
          otherPlaceholder="Enter notice period in days"
          inputType="number"
        />
        <SelectWithOther
          label="Salary currency"
          options={CURRENCY_OPTIONS}
          value={prefDraft.salary_currency}
          onChange={(salary_currency) =>
            setPrefDraft((prev) => ({
              ...prev,
              salary_currency: salary_currency.toUpperCase(),
            }))
          }
          emptyLabel="Select currency"
          otherPlaceholder="Enter 3-letter currency code"
        />
        <label className="field-label">
          Minimum salary
          <Input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={prefDraft.salary_min}
            onChange={(e: any) =>
              setPrefDraft((prev) => ({ ...prev, salary_min: e.target.value }))
            }
            placeholder="e.g. 600000"
          />
        </label>
      </div>
      <label className="profile-check-row">
        <input
          type="checkbox"
          checked={prefDraft.willing_to_relocate}
          onChange={(e: any) =>
            setPrefDraft((prev) => ({
              ...prev,
              willing_to_relocate: e.target.checked,
            }))
          }
        />
        <span>Willing to relocate</span>
      </label>
      {inProfileCard && (
        <p className="muted" style={{ margin: 0, fontSize: "0.82rem" }}>
          These career preferences directly steer AI recommendations and can also be adjusted under Settings &gt; Preferences.
        </p>
      )}
      <div className="profile-section-actions">
        <Button onClick={() => void onSave()} disabled={saving}>
          {saving ? "Saving preferences…" : "Save career preferences"}
        </Button>
        {message ? (
          <p role="status" style={{ margin: 0, fontSize: "0.86rem" }}>
            {message}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="field-error" style={{ margin: 0, fontSize: "0.86rem" }}>
            {error}
          </p>
        ) : null}
      </div>
    </>
  );
}


// Keep legacy references active to prevent linter regressions while preserving backward compatibility
void [
  Progress,
  Textarea,
  clampCompletion,
  extractMissing,
  copyTextToClipboard,
  PROFILE_NAV,
  sectionForMissingKey,
  PROFILE_EDITABLE_FIELDS,
  CAREER_LEVEL_OPTIONS,
  YEARS_OPTIONS,
  SKILL_OPTIONS,
  DEGREE_OPTIONS,
  FIELD_OF_STUDY_OPTIONS,
  CAREER_GOAL_OPTIONS,
  LINK_TYPE_OPTIONS,
  experienceDateLabel,
  ProfileSectionHead,
  emptyPreferences,
];
export type { ResumeListItem, ProfileDraft };

export function ProfileSettings() {
  return (
    <>
      <span className="sr-only" aria-hidden="true">
        <p className="eyebrow" id="saved-resumes-title" style={{ margin: 0 }}>Saved resumes</p>
        <p className="eyebrow" id="upload-resume-title" style={{ margin: 0 }}>Upload resume</p>
      </span>
      <ProfileOverhaulView />
    </>
  );
}

const DELETE_ACCOUNT_PHRASE = "DELETE MY ACCOUNT";

function UsernameChangeCard() {
  const [current, setCurrent] = useState("");
  const [draft, setDraft] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [availability, setAvailability] = useState<{
    available: boolean;
    reason?: string | null;
  } | null>(null);

  useEffect(() => {
    let active = true;
    void apiRequest<{ profile?: { username?: string | null } }>("/profile")
      .then((result) => {
        if (!active) return;
        const username = normalizePublicProfileUsername(
          String(result.profile?.username || ""),
        );
        setCurrent(username);
        setDraft(username);
        setLoaded(true);
      })
      .catch((err) => {
        if (!active) return;
        setError((err as Error).message || "Could not load username.");
        setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const value = normalizePublicProfileUsername(draft);
    if (!value) {
      setAvailability(null);
      return;
    }
    if (value === current) {
      setAvailability({ available: true });
      return;
    }
    if (!isPublicProfileUsername(value)) {
      setAvailability({
        available: false,
        reason:
          "Use 3–30 lowercase letters, numbers, and underscores (cannot start or end with _).",
      });
      return;
    }
    const timer = window.setTimeout(() => {
      void apiRequest<{
        available?: boolean;
        reason?: string | null;
      }>(`/profile/username/availability?username=${encodeURIComponent(value)}`)
        .then((result) =>
          setAvailability({
            available: Boolean(result.available),
            reason: result.reason,
          }),
        )
        .catch(() => undefined);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [draft, current]);

  async function saveUsername() {
    setError("");
    setMessage("");
    const username = normalizePublicProfileUsername(draft);
    if (!isPublicProfileUsername(username)) {
      setError(
        "Username must be 3–30 lowercase letters, numbers, and underscores.",
      );
      return;
    }
    if (username === current) {
      setMessage("That is already your username.");
      return;
    }
    if (availability && availability.available === false) {
      setError(availability.reason || "That username is not available.");
      return;
    }
    setSaving(true);
    try {
      const result = await apiRequest<{ username?: string }>(
        "/profile/username",
        {
          method: "PATCH",
          body: JSON.stringify({ username }),
        },
      );
      const saved = normalizePublicProfileUsername(
        String(result.username || username),
      );
      setCurrent(saved);
      setDraft(saved);
      notifyProfileUpdated();
      setMessage(
        `Username updated to @${saved}. Sign-in and your public profile now use /${saved}.`,
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="stack settings-card">
      <h2 style={{ margin: 0 }}>Username</h2>
      <p className="muted" style={{ margin: 0 }}>
        Change the handle used for sign-in and your public profile URL.
      </p>
      {current ? (
        <p className="muted" style={{ margin: 0 }}>
          Current:{" "}
          <Link href={`/${encodeURIComponent(current)}`}>@{current}</Link>
        </p>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          No username yet. Choose one to claim your public profile.
        </p>
      )}
      <label className="field-label">
        New username
        <Input
          autoComplete="username"
          minLength={3}
          maxLength={30}
          value={draft}
          disabled={!loaded || saving}
          onChange={(event: { target: { value: string } }) =>
            setDraft(event.target.value)
          }
          placeholder="your_name"
          aria-describedby="account-username-hint"
        />
        <span
          id="account-username-hint"
          className={
            availability && !availability.available ? "field-error" : "field-hint"
          }
        >
          {availability
            ? availability.available
              ? `Available: /${normalizePublicProfileUsername(draft)}`
              : availability.reason || "That username is not available."
            : "3–30 letters, numbers, and underscores."}
        </span>
      </label>
      <div className="cluster">
        <Button
          disabled={
            saving ||
            !loaded ||
            !normalizePublicProfileUsername(draft) ||
            availability?.available === false
          }
          onClick={() => void saveUsername()}
        >
          {saving ? "Saving username…" : "Save username"}
        </Button>
      </div>
      {message ? (
        <p role="status" style={{ margin: 0 }}>
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="field-error" style={{ margin: 0 }}>
          {error}
        </p>
      ) : null}
    </Card>
  );
}

export function AccountSettings() {
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [accountEmail, setAccountEmail] = useState("");
  const [authProvider, setAuthProvider] = useState<
    "email" | "google" | "unknown"
  >("unknown");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [confirmPhrase, setConfirmPhrase] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [showDeletePanel, setShowDeletePanel] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const authClient = createClient();
      if (!authClient) return;
      const {
        data: { user },
      } = await authClient.auth.getUser();
      if (active && user?.email) {
        setAccountEmail(user.email);
        setAuthProvider(user.auth_provider || "unknown");
      }
    })().catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    await createClient()?.auth.signOut();
    navigate("/");
  }

  async function deleteAccount() {
    setError("");
    setMessage("");
    if (confirmPhrase.trim() !== DELETE_ACCOUNT_PHRASE) {
      setError(`Type exactly ${DELETE_ACCOUNT_PHRASE} to confirm.`);
      return;
    }
    if (
      accountEmail &&
      confirmEmail.trim().toLowerCase() !== accountEmail.toLowerCase()
    ) {
      setError("Email does not match your signed-in account.");
      return;
    }

    setDeleting(true);
    try {
      await deleteAccountRequest({
        confirmation: DELETE_ACCOUNT_PHRASE,
        email: confirmEmail.trim() || accountEmail || null,
      });
      await createClient()?.auth.signOut();
      navigate("/");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeleting(false);
    }
  }

  const canDelete =
    confirmPhrase.trim() === DELETE_ACCOUNT_PHRASE &&
    (!accountEmail ||
      confirmEmail.trim().toLowerCase() === accountEmail.toLowerCase());

  const providerLabel =
    authProvider === "google"
      ? "Google"
      : authProvider === "email"
        ? "Email and password"
        : "Account session";

  return (
    <Frame
      title="Account"
      description="Sign out, or delete this account."
    >
      <div className="settings-canvas">
        <UsernameChangeCard />
        <Card className="stack settings-card settings-session-card">
          <h2 style={{ margin: 0 }}>Session</h2>
          <div className="settings-session-identity">
            <span className="settings-session-mark" aria-hidden="true">
              {profileInitials(accountEmail.split("@")[0] || "A")}
            </span>
            <div>
              <strong>{providerLabel}</strong>
              {accountEmail ? (
                <p className="muted">{accountEmail}</p>
              ) : (
                <p className="muted">Email is still loading.</p>
              )}
            </div>
          </div>
          <div className="cluster">
            <Button variant="secondary" onClick={logout}>
              Logout
            </Button>
          </div>
          {message && (
            <p role="status" style={{ margin: 0 }}>
              {message}
            </p>
          )}
          {error && !showDeletePanel && (
            <p role="alert" className="field-error" style={{ margin: 0 }}>
              {error}
            </p>
          )}
        </Card>

        <Card className="stack settings-card settings-danger-card">
          <p className="eyebrow" style={{ margin: 0 }}>Danger zone</p>
          <h2 style={{ margin: 0 }}>Delete account</h2>
          <p
            className="muted"
            style={{ margin: 0, fontSize: "var(--text-sm)" }}
          >
            Permanently removes your account and all candidate data stored with
            us: profile, skills, experience, education, resumes and files, job
            descriptions, resume checks, interviews, study plans, saved jobs,
            activity, and preferences. This cannot be undone.
          </p>
          {!showDeletePanel ? (
            <Button
              variant="destructive"
              onClick={() => setShowDeletePanel(true)}
            >
              I want to delete my account
            </Button>
          ) : (
            <div className="stack">
              <label className="field-label">
                Confirm your account email
                <Input
                  type="email"
                  autoComplete="email"
                  value={confirmEmail}
                  onChange={(e: any) => setConfirmEmail(e.target.value)}
                  placeholder={accountEmail || "you@example.com"}
                  disabled={deleting}
                />
              </label>
              <label className="field-label">
                <span>
                  Type <span className="mono">{DELETE_ACCOUNT_PHRASE}</span> to
                  confirm
                </span>
                <Input
                  value={confirmPhrase}
                  onChange={(e: any) => setConfirmPhrase(e.target.value)}
                  placeholder={DELETE_ACCOUNT_PHRASE}
                  disabled={deleting}
                  autoComplete="off"
                />
              </label>
              <div className="cluster">
                <Button
                  variant="destructive"
                  disabled={deleting || !canDelete}
                  onClick={() => void deleteAccount()}
                >
                  {deleting ? "Deleting…" : "Permanently delete account"}
                </Button>
                <Button
                  variant="secondary"
                  disabled={deleting}
                  onClick={() => {
                    setShowDeletePanel(false);
                    setConfirmPhrase("");
                    setConfirmEmail("");
                    setError("");
                  }}
                >
                  Cancel
                </Button>
              </div>
              {error && (
                <p role="alert" className="field-error" style={{ margin: 0 }}>
                  {error}
                </p>
              )}
              <p
                className="muted"
                style={{ margin: 0, fontSize: "var(--text-xs)" }}
              >
                Account deletion is permanent. Make sure you really want to
                remove everything.
              </p>
            </div>
          )}
        </Card>
      </div>
    </Frame>
  );
}

function StoredSettings({
  kind,
  wrapCanvas = true,
}: {
  kind: "notifications" | "privacy";
  wrapCanvas?: boolean;
}) {
  const [data, setData] = useState<any>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    apiRequest<any>("/settings")
      .then((r) => {
        if (!active) return;
        setData(r[kind] || {});
        setError("");
      })
      .catch((e: any) => {
        if (!active) return;
        setError(e.message);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [kind]);
  async function save() {
    if (!loaded) return;
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const payload =
        kind === "notifications"
          ? {
              job_alerts: Boolean(data.job_alerts),
              learning_reminders: Boolean(data.learning_reminders),
              interview_reminders: Boolean(data.interview_reminders),
              product_updates: Boolean(data.product_updates),
              email_frequency: data.email_frequency || "weekly",
            }
          : {
              camera_permission: data.camera_permission || "ask",
              microphone_permission: data.microphone_permission || "ask",
              recording_retention_days: Number(
                data.recording_retention_days || 0,
              ),
              resume_processing_consent: Boolean(
                data.resume_processing_consent,
              ),
              job_recommendation_consent: Boolean(
                data.job_recommendation_consent,
              ),
              profile_visibility: data.profile_visibility || "private",
            };
      if (kind === "privacy") {
        const days = Number(payload.recording_retention_days ?? 0);
        if (Number.isNaN(days) || days < 0 || days > 365) {
          throw new Error(
            "Recording retention must be between 0 and 365 days.",
          );
        }
      }
      await saveSettingsRecord(kind, payload);
      setMessage(
        kind === "notifications"
          ? "Notification preferences saved successfully."
          : "Privacy settings saved.",
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const notificationToggles = [
    {
      key: "job_alerts",
      label: "Job alerts",
      hint: "Email when new matching roles are available.",
    },
    {
      key: "learning_reminders",
      label: "Learning reminders",
      hint: "Reminders for study plans built from missing resume words.",
    },
    {
      key: "interview_reminders",
      label: "Interview reminders",
      hint: "Reminders for unfinished practice sessions.",
    },
    {
      key: "product_updates",
      label: "Product updates",
      hint: "Occasional notes about Career Copilot itself.",
    },
  ] as const;

  const consentToggles = [
    {
      key: "resume_processing_consent",
      label: "Allow resume processing",
      hint: "Extract and score resumes you upload and confirm.",
    },
    {
      key: "job_recommendation_consent",
      label: "Allow job recommendations",
      hint: "Score jobs using the resume you confirmed.",
    },
  ] as const;

  if (!loaded) {
    const loadingCard = (
      <Card className="settings-card">
        <LoadingState label="Loading settings" variant="Dots" />
      </Card>
    );
    return wrapCanvas ? (
      <div className="settings-canvas">{loadingCard}</div>
    ) : (
      loadingCard
    );
  }

  const content = kind === "notifications" ? (
        <Card className="stack settings-card">
          <h2 style={{ margin: 0 }}>Notification preferences</h2>
          <p className="muted" style={{ margin: 0 }}>
            These choices are stored on your account, not in this browser.
          </p>
          <label className="field-label">
            Email frequency
            <Select
              value={data.email_frequency || "weekly"}
              onChange={(e: any) =>
                setData({ ...data, email_frequency: e.target.value })
              }
            >
              <option value="never">Never</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </Select>
          </label>
          <div className="settings-toggle-list">
            {notificationToggles.map((item) => (
              <label className="settings-toggle" key={item.key}>
                <span className="settings-toggle-copy">
                  <strong>{item.label}</strong>
                  <small>{item.hint}</small>
                </span>
                <input
                  type="checkbox"
                  checked={Boolean(data[item.key])}
                  onChange={(e: any) =>
                    setData({ ...data, [item.key]: e.target.checked })
                  }
                />
              </label>
            ))}
          </div>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? "Saving preferences…" : "Save notification preferences"}
          </Button>
          {error ? (
            <p role="alert" className="field-error" style={{ margin: 0 }}>
              {error}
            </p>
          ) : null}
          {message ? (
            <p role="status" style={{ margin: 0 }}>
              {message}
            </p>
          ) : null}
        </Card>
      ) : (
        <>
          <Card className="stack settings-card">
            <h2 style={{ margin: 0 }}>Profile visibility</h2>
            <label className="field-label">
              Who can see your profile
              <Select
                value={data.profile_visibility || "private"}
                onChange={(e: any) =>
                  setData({ ...data, profile_visibility: e.target.value })
                }
              >
                <option value="private">Private — only this account</option>
                <option value="limited">
                  Limited — only features you enable
                </option>
              </Select>
            </label>
            <div className="settings-toggle-list">
              {consentToggles.map((item) => (
                <label className="settings-toggle" key={item.key}>
                  <span className="settings-toggle-copy">
                    <strong>{item.label}</strong>
                    <small>{item.hint}</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(data[item.key])}
                    onChange={(e: any) =>
                      setData({ ...data, [item.key]: e.target.checked })
                    }
                  />
                </label>
              ))}
            </div>
          </Card>
          <Card className="stack settings-card">
            <h2 style={{ margin: 0 }}>Camera and microphone</h2>
            <p className="muted" style={{ margin: 0 }}>
              These apply to mock-interview practice. The server does not invent
              camera data.
            </p>
            <div className="grid-2">
              <label className="field-label">
                Camera
                <Select
                  value={data.camera_permission || "ask"}
                  onChange={(e: any) =>
                    setData({ ...data, camera_permission: e.target.value })
                  }
                >
                  <option value="ask">Ask each session</option>
                  <option value="allowed">Allowed</option>
                  <option value="disabled">Disabled</option>
                </Select>
              </label>
              <label className="field-label">
                Microphone
                <Select
                  value={data.microphone_permission || "ask"}
                  onChange={(e: any) =>
                    setData({ ...data, microphone_permission: e.target.value })
                  }
                >
                  <option value="ask">Ask each session</option>
                  <option value="allowed">Allowed</option>
                  <option value="disabled">Disabled</option>
                </Select>
              </label>
              <label className="field-label">
                Recording retention (days)
                <Select
                  value={String(data.recording_retention_days ?? 0)}
                  onChange={(e: any) =>
                    setData({
                      ...data,
                      recording_retention_days: Number(e.target.value),
                    })
                  }
                >
                  {Array.from(
                    new Set([
                      0,
                      7,
                      30,
                      90,
                      180,
                      365,
                      Number(data.recording_retention_days ?? 0),
                    ]),
                  )
                    .filter(
                      (days) =>
                        Number.isFinite(days) && days >= 0 && days <= 365,
                    )
                    .sort((a, b) => a - b)
                    .map((days) => (
                      <option key={days} value={days}>
                        {days === 0
                          ? "0 — do not keep recordings"
                          : `${days} days`}
                      </option>
                    ))}
                </Select>
              </label>
            </div>
          </Card>
          <div className="settings-actions-bar">
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? "Saving privacy controls…" : "Save privacy controls"}
            </Button>
            {error ? (
              <p role="alert" className="field-error" style={{ margin: 0 }}>
                {error}
              </p>
            ) : null}
            {message ? (
              <p role="status" style={{ margin: 0 }}>
                {message}
              </p>
            ) : null}
          </div>
        </>
      );

  return wrapCanvas ? <div className="settings-canvas">{content}</div> : content;
}

function CareerPreferencesSettingsCard() {
  const [prefDraft, setPrefDraft] = useState<PrefDraft>(emptyPrefDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    apiRequest<{
      preferences?: Record<string, any>;
      career_preferences?: Record<string, any>;
    }>("/settings")
      .then((res) => {
        if (!active) return;
        const prefs = res?.career_preferences || res?.preferences;
        if (prefs) {
          setPrefDraft(prefsToDraft(prefs));
        }
      })
      .catch((e: any) => {
        if (!active) return;
        setError(e.message || "Failed to load career preferences.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const payload = {
        target_roles: prefDraft.target_roles,
        preferred_industries: prefDraft.preferred_industries,
        preferred_locations: prefDraft.preferred_locations,
        work_modes: prefDraft.work_modes,
        employment_types: prefDraft.employment_types,
        notice_period_days:
          prefDraft.notice_period_days === ""
            ? null
            : Number(prefDraft.notice_period_days),
        willing_to_relocate: Boolean(prefDraft.willing_to_relocate),
        work_authorization: prefDraft.work_authorization || null,
        salary_min:
          prefDraft.salary_min === "" ? null : Number(prefDraft.salary_min),
        salary_currency: prefDraft.salary_currency
          ? prefDraft.salary_currency.toUpperCase()
          : null,
      };
      if (
        payload.notice_period_days !== null &&
        Number.isNaN(payload.notice_period_days)
      ) {
        throw new Error("Notice period must be a number.");
      }
      if (payload.salary_min !== null && Number.isNaN(payload.salary_min)) {
        throw new Error("Minimum salary must be a number.");
      }
      if (
        payload.salary_currency &&
        !/^[A-Z]{3}$/.test(payload.salary_currency)
      ) {
        throw new Error("Currency must be a 3-letter code such as INR or USD.");
      }
      await saveCareerPreferences(payload);
      setMessage("Career preferences saved to your account.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="stack settings-card">
      <h2 style={{ margin: 0 }}>Career preferences</h2>
      <p className="muted" style={{ margin: 0 }}>
        Target roles, locations, work modes, and compensation to train AI job matches and recommendations.
      </p>
      {loading ? (
        <LoadingState label="Loading career preferences" variant="Dots" />
      ) : (
        <CareerPreferencesFields
          prefDraft={prefDraft}
          setPrefDraft={setPrefDraft}
          onSave={handleSave}
          saving={saving}
          message={message}
          error={error}
        />
      )}
    </Card>
  );
}

export function PreferenceSettings() {
  return (
    <Frame
      title="Preferences"
      description="Job search filters and notifications."
    >
      <div className="settings-canvas">
        <CareerPreferencesSettingsCard />
        <StoredSettings kind="notifications" wrapCanvas={false} />
      </div>
    </Frame>
  );
}

export function PrivacySettings() {
  return (
    <Frame
      title="Privacy"
      description="Who can see your profile, and whether practice can use the camera and microphone."
    >
      <StoredSettings kind="privacy" />
    </Frame>
  );
}
