import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/shared/api/client";
import LoadingState from "@/components/ui/loading-state";
import {
  computeProfileCompleteness8,
  notifyProfileUpdated,
} from "@/features/profile/model/profile-completion";
import type { ProfileSectionId } from "@/features/profile/model/profile-hash-navigation";
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
  current_role: string;
  location: string;
  years_experience: string | number;
  bio: string;
  avatar_url?: string | null;
  username?: string | null;
}

export function ProfileOverhaulView() {
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<ProfileSectionId>("resume");

  // Form states
  const [form, setForm] = useState<ProfileFormData>({
    full_name: "",
    current_role: "",
    location: "",
    years_experience: "",
    bio: "",
    avatar_url: null,
    username: null,
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

  // Autofill Modal state
  const [autofillResumeId, setAutofillResumeId] = useState<string | null>(null);
  const [isAutofillOpen, setIsAutofillOpen] = useState(false);

  // Dirty state calculation
  const isDirty = useMemo(() => {
    const formDirty =
      form.full_name !== savedForm.full_name ||
      form.current_role !== savedForm.current_role ||
      form.location !== savedForm.location ||
      String(form.years_experience) !== String(savedForm.years_experience) ||
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
        current_role: prof.current_role || "",
        location: prof.location || "",
        years_experience: prof.years_experience != null ? prof.years_experience : "",
        bio: prof.bio || "",
        avatar_url: prof.avatar_url || null,
        username: prof.username || null,
      };

      const nextPrefs: CandidatePreferences = {
        target_roles: Array.isArray(prefs.target_roles) ? prefs.target_roles : [],
        preferred_locations: Array.isArray(prefs.preferred_locations) ? prefs.preferred_locations : [],
        work_modes: Array.isArray(prefs.work_modes) ? prefs.work_modes : [],
        salary_min: prefs.salary_min != null ? prefs.salary_min : null,
        salary_currency: prefs.salary_currency || "USD",
      };

      setForm(nextForm);
      setSavedForm(nextForm);
      setPreferences(nextPrefs);
      setSavedPreferences(nextPrefs);
      setSkills(skillRows || []);
      setExperiences(expRows || []);
      setEducation(eduRows || []);
      setLinks(linkRows || []);
      setResumes(resumeRows || []);

      const calculated = computeProfileCompleteness8({
        fullName: nextForm.full_name,
        location: nextForm.location,
        currentRole: nextForm.current_role,
        yearsExperience: nextForm.years_experience,
        skillsCount: (skillRows || []).length,
        experienceCount: (expRows || []).length,
        educationCount: (eduRows || []).length,
        linksCount: (linkRows || []).length,
      });

      notifyProfileUpdated({
        profile_completion: calculated.percentage,
        profile_completion_details: {
          missing: calculated.missing,
          total: calculated.percentage,
        },
      });
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
      const formPayload = {
        full_name: form.full_name.trim() || null,
        current_role: form.current_role.trim() || null,
        location: form.location.trim() || null,
        years_experience: form.years_experience === "" ? null : Number(form.years_experience),
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

  // Resume upload
  async function handleUploadResume(file: File) {
    setUploadBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await apiRequest<ResumeItem>("/resumes/upload", {
        method: "POST",
        body: formData,
      });
      if (res) {
        setResumes((prev) => [res, ...prev]);
      }
    } finally {
      setUploadBusy(false);
    }
  }

  // Avatar upload
  async function handleUploadAvatar(file: File) {
    setAvatarBusy(true);
    try {
      const formData = new FormData();
      formData.append("avatar", file);
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

  // Trigger autofill
  function handleTriggerAutofill(resumeId: string) {
    setAutofillResumeId(resumeId);
    setIsAutofillOpen(true);
  }

  if (loading) {
    return <LoadingState label="Loading candidate profile..." />;
  }

  return (
    <div className="profile-overhaul-canvas w-full min-h-screen bg-black text-white font-sans antialiased selection:bg-cyan-500/30 selection:text-white pb-32">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* 1. Identity Strip */}
        <IdentityStrip
          fullName={form.full_name}
          avatarUrl={form.avatar_url}
          currentRole={form.current_role}
          location={form.location}
          yearsExperience={form.years_experience}
          username={form.username}
          completionScore={completeness.percentage}
          missingItems={completeness.missing}
          onUploadAvatar={handleUploadAvatar}
          avatarBusy={avatarBusy}
        />

        {/* 2. Sticky Section Tabs */}
        <StickySectionTabs
          activeSection={activeSection}
          onSelectSection={setActiveSection}
        />

        {/* 3. Section 3.1: Resume */}
        <ResumeSection
          resumes={resumes}
          activeResumeId={resumes[0]?.id}
          onUploadResume={handleUploadResume}
          onTriggerAutofill={handleTriggerAutofill}
          uploadBusy={uploadBusy}
        />

        {/* 4. Section 3.2: About you */}
        <AboutSection
          fullName={form.full_name}
          onFullNameChange={(val) => setForm((prev) => ({ ...prev, full_name: val }))}
          location={form.location}
          onLocationChange={(val) => setForm((prev) => ({ ...prev, location: val }))}
          currentRole={form.current_role}
          onCurrentRoleChange={(val) => setForm((prev) => ({ ...prev, current_role: val }))}
          yearsExperience={form.years_experience}
          onYearsExperienceChange={(val) => setForm((prev) => ({ ...prev, years_experience: val }))}
          bio={form.bio}
          onBioChange={(val) => setForm((prev) => ({ ...prev, bio: val }))}
          links={links}
          onAddLink={handleAddLink}
          onDeleteLink={handleDeleteLink}
        />

        {/* 5. Section 3.3: Background (Experience & Education) */}
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

        {/* 6. Section 3.4: Skills */}
        <SkillsSection
          skills={skills}
          onAddSkill={handleAddSkill}
          onDeleteSkill={handleDeleteSkill}
        />

        {/* 7. Section 3.5: Job preferences */}
        <PreferencesSection
          preferences={preferences}
          onChange={setPreferences}
        />

        {/* 8. Sticky Dirty Action Bar */}
        <DirtyActionBar
          isDirty={isDirty}
          onSave={handleSave}
          onDiscard={handleDiscard}
          saving={saving}
        />

        {/* 9. Autofill Review & Progress Dialog */}
        <AutofillDialog
          resumeId={autofillResumeId}
          isOpen={isAutofillOpen}
          onClose={() => setIsAutofillOpen(false)}
          onApplied={loadAll}
        />

        {/* Save success toast */}
        {saveToast && (
          <div className="fixed top-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <span>✓</span>
            <span>Profile changes saved successfully!</span>
          </div>
        )}
      </div>
    </div>
  );
}
