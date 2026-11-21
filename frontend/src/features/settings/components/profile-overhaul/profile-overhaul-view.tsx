import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/shared/api/client";
import LoadingState from "@/components/ui/loading-state";
import {
  computeProfileCompleteness8,
  notifyProfileUpdated,
} from "@/features/profile/model/profile-completion";
import {
  resolveProfileHash,
  type ProfileSectionId,
} from "@/features/profile/model/profile-hash-navigation";
import { IdentityStrip } from "./identity-strip";
import { StickySectionTabs } from "./sticky-section-tabs";
import { ResumeSection } from "./resume-section";
import { AboutSection } from "./about-section";
import { BackgroundSection } from "./background-section";
import { SkillsSection } from "./skills-section";
import { PreferencesSection } from "./preferences-section";
import { DirtyActionBar } from "./dirty-action-bar";
import { AutofillDialog } from "./autofill-dialog";
import type {
  CandidateExperience,
  CandidateEducation,
  CandidateLink,
  CandidatePreferences,
  CandidateSkill,
  ResumeItem,
} from "./types";

interface ProfileFormData {
  full_name: string;
  username: string;
  headline: string;
  location: string;
  current_role: string;
  years_experience: string | number;
  career_level: string;
  career_goal: string;
  bio: string;
  avatar_url?: string | null;
}

export function ProfileOverhaulView() {
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<ProfileSectionId>(() => {
    if (typeof window !== "undefined" && window.location.hash) {
      return resolveProfileHash(window.location.hash);
    }
    return "about";
  });

  // Keep activeSection in sync with hash changes
  useEffect(() => {
    function handleHashChange() {
      if (typeof window !== "undefined" && window.location.hash) {
        setActiveSection(resolveProfileHash(window.location.hash));
      }
    }
    window.addEventListener("hashchange", handleHashChange);
    window.addEventListener("popstate", handleHashChange);
    return () => {
      window.removeEventListener("hashchange", handleHashChange);
      window.removeEventListener("popstate", handleHashChange);
    };
  }, []);

  const handleSelectSection = useCallback((id: ProfileSectionId) => {
    setActiveSection(id);
    if (typeof window !== "undefined") {
      window.history.pushState(null, "", `#${id}`);
    }
  }, []);

  // Form states
  const [form, setForm] = useState<ProfileFormData>({
    full_name: "",
    username: "",
    headline: "",
    location: "",
    current_role: "",
    years_experience: "",
    career_level: "",
    career_goal: "",
    bio: "",
    avatar_url: null,
  });
  const [savedForm, setSavedForm] = useState<ProfileFormData>({ ...form });

  // Preferences states
  const [preferences, setPreferences] = useState<CandidatePreferences>({
    target_roles: [],
    preferred_locations: [],
    work_modes: [],
    salary_min: null,
    salary_currency: "USD",
  });
  const [savedPreferences, setSavedPreferences] = useState<CandidatePreferences>({ ...preferences });

  // Collections
  const [skills, setSkills] = useState<CandidateSkill[]>([]);
  const [experiences, setExperiences] = useState<CandidateExperience[]>([]);
  const [education, setEducation] = useState<CandidateEducation[]>([]);
  const [links, setLinks] = useState<CandidateLink[]>([]);
  const [resumes, setResumes] = useState<ResumeItem[]>([]);

  // Action / UI states
  const [saving, setSaving] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [saveToast, setSaveToast] = useState(false);
  const [autofillToast, setAutofillToast] = useState(false);

  // Autofill option checkbox in Resume section (default ON per Step 3.1)
  const [onlyFillEmpty, setOnlyFillEmpty] = useState(true);

  // Autofill Modal state
  const [autofillResumeId, setAutofillResumeId] = useState<string | null>(null);
  const [isAutofillOpen, setIsAutofillOpen] = useState(false);

  // Post-upload prompt dialog state (Step 4.1)
  const [showPostUploadModal, setShowPostUploadModal] = useState(false);
  const [postUploadResumeId, setPostUploadResumeId] = useState<string | null>(null);

  // Dirty state calculation
  const isDirty = useMemo(() => {
    const formDirty =
      form.full_name !== savedForm.full_name ||
      form.username !== savedForm.username ||
      form.headline !== savedForm.headline ||
      form.current_role !== savedForm.current_role ||
      form.location !== savedForm.location ||
      String(form.years_experience) !== String(savedForm.years_experience) ||
      form.career_level !== savedForm.career_level ||
      form.career_goal !== savedForm.career_goal ||
      form.bio !== savedForm.bio;

    const prefDirty =
      JSON.stringify(preferences.target_roles) !== JSON.stringify(savedPreferences.target_roles) ||
      JSON.stringify(preferences.preferred_locations) !== JSON.stringify(savedPreferences.preferred_locations) ||
      JSON.stringify(preferences.work_modes) !== JSON.stringify(savedPreferences.work_modes) ||
      preferences.salary_min !== savedPreferences.salary_min ||
      preferences.salary_currency !== savedPreferences.salary_currency;

    return formDirty || prefDirty;
  }, [form, savedForm, preferences, savedPreferences]);

  // Completeness score calculation (8-item formula)
  const completeness = useMemo(() => {
    return computeProfileCompleteness8({
      fullName: form.full_name,
      location: form.location,
      currentRole: form.current_role,
      yearsExperience: form.years_experience,
      skillsCount: skills.length,
      experienceCount: experiences.length,
      educationCount: education.length,
      linksCount: links.length,
    });
  }, [form, skills.length, experiences.length, education.length, links.length]);

  // Load all profile data
  const loadAll = useCallback(async () => {
    try {
      const [profilePayload, skillRows, expRows, eduRows, linkRows, resumeRows] =
        await Promise.all([
          apiRequest<{ profile: any; preferences: any }>("/profile"),
          apiRequest<CandidateSkill[]>("/profile/skills").catch(() => []),
          apiRequest<CandidateExperience[]>("/profile/experiences").catch(() => []),
          apiRequest<CandidateEducation[]>("/profile/education").catch(() => []),
          apiRequest<CandidateLink[]>("/profile/links").catch(() => []),
          apiRequest<ResumeItem[]>("/resumes").catch(() => []),
        ]);

      const prof = profilePayload?.profile || {};
      const prefs = profilePayload?.preferences || {};

      const nextForm: ProfileFormData = {
        full_name: prof.full_name || "",
        username: prof.username || "",
        headline: prof.headline || "",
        current_role: prof.current_role || "",
        location: prof.location || "",
        years_experience: prof.years_experience != null ? prof.years_experience : "",
        career_level: prof.career_level || "",
        career_goal: prof.career_goal || "",
        bio: prof.bio || "",
        avatar_url: prof.avatar_url || null,
      };

      const nextPrefs: CandidatePreferences = {
        target_roles: Array.isArray(prefs.target_roles) ? prefs.target_roles : [],
        preferred_locations: Array.isArray(prefs.locations || prefs.preferred_locations)
          ? prefs.locations || prefs.preferred_locations
          : [],
        work_modes: Array.isArray(prefs.work_modes) ? prefs.work_modes : [],
        salary_min: prefs.salary_min != null ? prefs.salary_min : null,
        salary_currency: prefs.salary_currency || "USD",
      };

      setForm(nextForm);
      setSavedForm(nextForm);
      setPreferences(nextPrefs);
      setSavedPreferences(nextPrefs);

      setSkills(Array.isArray(skillRows) ? skillRows : []);
      setExperiences(Array.isArray(expRows) ? expRows : []);
      setEducation(Array.isArray(eduRows) ? eduRows : []);
      setLinks(Array.isArray(linkRows) ? linkRows : []);
      const rList = Array.isArray(resumeRows) ? resumeRows : [];
      setResumes(rList);

      // Section 3.1 default: resume when user has no resume, otherwise about
      if (!window.location.hash) {
        setActiveSection(rList.length === 0 ? "resume" : "about");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Save changes handler
  async function handleSave() {
    setSaving(true);
    try {
      const formPayload: Record<string, any> = {
        full_name: form.full_name.trim() || null,
        username: form.username.trim() || null,
        headline: form.headline.trim() || null,
        current_role: form.current_role.trim() || null,
        location: form.location.trim() || null,
        years_experience: form.years_experience === "" ? null : Number(form.years_experience),
        career_level: form.career_level.trim() || null,
        career_goal: form.career_goal.trim() || null,
        bio: form.bio.trim() || null,
      };

      const prefPayload = {
        target_roles: preferences.target_roles,
        preferred_locations: preferences.preferred_locations,
        work_modes: preferences.work_modes,
        salary_min: preferences.salary_min === "" ? null : preferences.salary_min,
        salary_currency: preferences.salary_currency,
      };

      await Promise.all([
        apiRequest("/profile", {
          method: "PATCH",
          body: JSON.stringify(formPayload),
        }),
        apiRequest("/profile/preferences", {
          method: "PUT",
          body: JSON.stringify(prefPayload),
        }),
      ]);

      setSavedForm({ ...form });
      setSavedPreferences({ ...preferences });
      setSaveToast(true);
      setTimeout(() => setSaveToast(false), 2500);

      notifyProfileUpdated({
        profile_completion: completeness.percentage,
        profile_completion_details: {
          missing: completeness.missing,
          total: completeness.percentage,
        },
      });
    } finally {
      setSaving(false);
    }
  }

  // Discard handler
  function handleDiscard() {
    setForm({ ...savedForm });
    setPreferences({ ...savedPreferences });
  }

  // Links operations
  async function handleAddLink(link: CandidateLink) {
    const created = await apiRequest<CandidateLink>("/profile/links", {
      method: "POST",
      body: JSON.stringify({
        link_type: link.link_type,
        url: link.url,
      }),
    });
    setLinks((prev) => [...prev, created || link]);
  }

  async function handleUpdateLink(idOrIdx: string | number, link: CandidateLink) {
    if (typeof idOrIdx === "string") {
      const updated = await apiRequest<CandidateLink>(`/profile/links/${idOrIdx}`, {
        method: "PATCH",
        body: JSON.stringify({
          link_type: link.link_type,
          url: link.url,
        }),
      });
      setLinks((prev) => prev.map((l) => (l.id === idOrIdx ? { ...l, ...(updated || link) } : l)));
    } else {
      setLinks((prev) => prev.map((l, i) => (i === idOrIdx ? { ...l, ...link } : l)));
    }
  }

  async function handleDeleteLink(idOrIdx: string | number) {
    if (typeof idOrIdx === "string") {
      await apiRequest(`/profile/links/${idOrIdx}`, { method: "DELETE" }).catch(() => undefined);
      setLinks((prev) => prev.filter((l) => l.id !== idOrIdx));
    } else {
      const target = links[idOrIdx];
      if (target?.id) {
        await apiRequest(`/profile/links/${target.id}`, { method: "DELETE" }).catch(() => undefined);
      }
      setLinks((prev) => prev.filter((_, i) => i !== idOrIdx));
    }
  }

  // Skills operations
  async function handleAddSkill(name: string) {
    const created = await apiRequest<CandidateSkill>("/profile/skills", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    setSkills((prev) => [...prev, created || { name }]);
  }

  async function handleDeleteSkill(idOrIdx: string | number) {
    if (typeof idOrIdx === "string") {
      await apiRequest(`/profile/skills/${idOrIdx}`, { method: "DELETE" }).catch(() => undefined);
      setSkills((prev) => prev.filter((s) => s.id !== idOrIdx));
    } else {
      const target = skills[idOrIdx];
      if (target?.id) {
        await apiRequest(`/profile/skills/${target.id}`, { method: "DELETE" }).catch(() => undefined);
      }
      setSkills((prev) => prev.filter((_, i) => i !== idOrIdx));
    }
  }

  // Experience operations
  async function handleAddExperience(exp: CandidateExperience) {
    const created = await apiRequest<CandidateExperience>("/profile/experiences", {
      method: "POST",
      body: JSON.stringify(exp),
    });
    setExperiences((prev) => [created || exp, ...prev]);
  }

  async function handleUpdateExperience(id: string, exp: Partial<CandidateExperience>) {
    const updated = await apiRequest<CandidateExperience>(`/profile/experiences/${id}`, {
      method: "PATCH",
      body: JSON.stringify(exp),
    });
    setExperiences((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...(updated || exp) } : item))
    );
  }

  async function handleDeleteExperience(id: string) {
    await apiRequest(`/profile/experiences/${id}`, { method: "DELETE" }).catch(() => undefined);
    setExperiences((prev) => prev.filter((e) => e.id !== id));
  }

  // Education operations
  async function handleAddEducation(edu: CandidateEducation) {
    const created = await apiRequest<CandidateEducation>("/profile/education", {
      method: "POST",
      body: JSON.stringify(edu),
    });
    setEducation((prev) => [created || edu, ...prev]);
  }

  async function handleUpdateEducation(id: string, edu: Partial<CandidateEducation>) {
    const updated = await apiRequest<CandidateEducation>(`/profile/education/${id}`, {
      method: "PATCH",
      body: JSON.stringify(edu),
    });
    setEducation((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...(updated || edu) } : item))
    );
  }

  async function handleDeleteEducation(id: string) {
    await apiRequest(`/profile/education/${id}`, { method: "DELETE" }).catch(() => undefined);
    setEducation((prev) => prev.filter((e) => e.id !== id));
  }

  // Resume upload: call POST /resumes with file and title
  async function handleUploadResume(file: File, title?: string) {
    setUploadBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      if (title) {
        formData.append("title", title);
      }
      const res = await apiRequest<{ resume: ResumeItem; version: any }>("/resumes", {
        method: "POST",
        body: formData,
      });
      if (res?.resume) {
        setResumes((prev) => [res.resume, ...prev]);
        setPostUploadResumeId(res.resume.id);
        setShowPostUploadModal(true);
      }
    } finally {
      setUploadBusy(false);
    }
  }

  // Resume rename
  async function handleRenameResume(resumeId: string, newTitle: string) {
    const updated = await apiRequest<ResumeItem>(`/resumes/${resumeId}`, {
      method: "PATCH",
      body: JSON.stringify({ title: newTitle }),
    });
    setResumes((prev) =>
      prev.map((r) => (r.id === resumeId ? { ...r, filename: newTitle, ...updated } : r))
    );
  }

  // Resume activate
  async function handleSelectActiveResume(resumeId: string) {
    await apiRequest(`/resumes/${resumeId}/activate`, { method: "POST" });
    setResumes((prev) =>
      prev.map((r) => ({ ...r, is_active: r.id === resumeId }))
    );
  }

  // Avatar upload: call POST /profile/avatar with "file"
  async function handleUploadAvatar(file: File) {
    setAvatarBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiRequest<{ avatar_url?: string }>("/profile/avatar", {
        method: "POST",
        body: formData,
      });
      if (res?.avatar_url) {
        setForm((prev) => ({ ...prev, avatar_url: res.avatar_url }));
        setSavedForm((prev) => ({ ...prev, avatar_url: res.avatar_url }));
      }
    } finally {
      setAvatarBusy(false);
    }
  }

  // Avatar remove: call DELETE /profile/avatar
  async function handleRemoveAvatar() {
    setAvatarBusy(true);
    try {
      await apiRequest("/profile/avatar", { method: "DELETE" });
      setForm((prev) => ({ ...prev, avatar_url: null }));
      setSavedForm((prev) => ({ ...prev, avatar_url: null }));
    } finally {
      setAvatarBusy(false);
    }
  }

  // Trigger autofill
  function handleTriggerAutofill(resumeId: string, fillEmpty: boolean) {
    setOnlyFillEmpty(fillEmpty);
    setAutofillResumeId(resumeId);
    setIsAutofillOpen(true);
  }

  if (loading) {
    return <LoadingState label="Loading candidate profile..." />;
  }

  return (
    <div className="profile-overhaul-view">
      {/* Identity Strip */}
      <IdentityStrip
        fullName={form.full_name}
        avatarUrl={form.avatar_url}
        headline={form.headline}
        username={form.username}
        currentRole={form.current_role}
        location={form.location}
        yearsExperience={form.years_experience}
        completionScore={completeness.percentage}
        completedCount={completeness.done}
        totalCount={completeness.total}
        missingItems={completeness.missing}
        onUploadAvatar={handleUploadAvatar}
        onRemoveAvatar={handleRemoveAvatar}
        avatarBusy={avatarBusy}
      />

      {/* Section Tabs */}
      <StickySectionTabs
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
      />

      {/* Tab Panels: Only the active panel is rendered (D9) */}
      <div
        role="tabpanel"
        id={`tabpanel-${activeSection}`}
        aria-labelledby={`tab-${activeSection}`}
        className="profile-tabpanel"
      >
        {activeSection === "resume" && (
          <ResumeSection
            resumes={resumes}
            activeResumeId={resumes.find((r) => r.is_active)?.id || resumes[0]?.id}
            onSelectActiveResume={handleSelectActiveResume}
            onRenameResume={handleRenameResume}
            onUploadResume={handleUploadResume}
            onTriggerAutofill={handleTriggerAutofill}
            onlyFillEmpty={onlyFillEmpty}
            onToggleOnlyFillEmpty={setOnlyFillEmpty}
            uploadBusy={uploadBusy}
          />
        )}

        {activeSection === "about" && (
          <AboutSection
            fullName={form.full_name}
            onFullNameChange={(val) => setForm((prev) => ({ ...prev, full_name: val }))}
            username={form.username}
            onUsernameChange={(val) => setForm((prev) => ({ ...prev, username: val }))}
            savedUsername={savedForm.username}
            headline={form.headline}
            onHeadlineChange={(val) => setForm((prev) => ({ ...prev, headline: val }))}
            location={form.location}
            onLocationChange={(val) => setForm((prev) => ({ ...prev, location: val }))}
            currentRole={form.current_role}
            onCurrentRoleChange={(val) => setForm((prev) => ({ ...prev, current_role: val }))}
            yearsExperience={form.years_experience}
            onYearsExperienceChange={(val) => setForm((prev) => ({ ...prev, years_experience: val }))}
            careerLevel={form.career_level}
            onCareerLevelChange={(val) => setForm((prev) => ({ ...prev, career_level: val }))}
            careerGoal={form.career_goal}
            onCareerGoalChange={(val) => setForm((prev) => ({ ...prev, career_goal: val }))}
            bio={form.bio}
            onBioChange={(val) => setForm((prev) => ({ ...prev, bio: val }))}
            links={links}
            onAddLink={handleAddLink}
            onUpdateLink={handleUpdateLink}
            onDeleteLink={handleDeleteLink}
          />
        )}

        {activeSection === "background" && (
          <BackgroundSection
            experiences={experiences}
            onAddExperience={handleAddExperience}
            onUpdateExperience={handleUpdateExperience}
            onDeleteExperience={handleDeleteExperience}
            education={education}
            onAddEducation={handleAddEducation}
            onUpdateEducation={handleUpdateEducation}
            onDeleteEducation={handleDeleteEducation}
          />
        )}

        {activeSection === "skills" && (
          <SkillsSection
            skills={skills}
            onAddSkill={handleAddSkill}
            onDeleteSkill={handleDeleteSkill}
          />
        )}

        {activeSection === "preferences" && (
          <PreferencesSection
            preferences={preferences}
            onChange={setPreferences}
          />
        )}
      </div>

      {/* Sticky Dirty Action Bar */}
      <DirtyActionBar
        isDirty={isDirty}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={saving}
      />

      {/* Post-Upload Prompt Dialog */}
      {showPostUploadModal && postUploadResumeId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4"
            style={{
              backgroundColor: "var(--ps-panel, var(--surface))",
              border: "1px solid var(--ps-line, var(--border))",
              borderRadius: "var(--ps-radius-lg, 20px)",
              color: "var(--ps-text, var(--text))",
            }}
          >
            <h4
              className="text-base font-semibold"
              style={{ color: "var(--ps-text, var(--text))", margin: 0 }}
            >
              Fill your profile from this resume?
            </h4>
            <p
              className="text-xs leading-relaxed"
              style={{ color: "var(--ps-muted, var(--muted))", margin: 0 }}
            >
              We'll extract your work history, education, skills, and links so you can
              review and apply them to your profile.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowPostUploadModal(false)}
                className="button button-secondary"
                style={{ minHeight: 36, padding: "6px 14px", fontSize: 13 }}
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPostUploadModal(false);
                  handleTriggerAutofill(postUploadResumeId, onlyFillEmpty);
                }}
                className="button button-primary"
                style={{ minHeight: 36, padding: "6px 16px", fontSize: 13 }}
              >
                Autofill
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Autofill Review & Progress Dialog */}
      <AutofillDialog
        resumeId={autofillResumeId}
        isOpen={isAutofillOpen}
        onlyFillEmpty={onlyFillEmpty}
        onClose={() => setIsAutofillOpen(false)}
        onApplied={async () => {
          await loadAll();
          setAutofillToast(true);
          setTimeout(() => setAutofillToast(false), 3000);
        }}
      />

      {/* Save success toast */}
      {saveToast && (
        <div className="fixed top-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <span>✓</span>
          <span>Profile changes saved successfully!</span>
        </div>
      )}

      {/* Autofill success toast */}
      {autofillToast && (
        <div className="fixed top-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <span>✓</span>
          <span>Profile updated from your resume.</span>
        </div>
      )}
    </div>
  );
}
