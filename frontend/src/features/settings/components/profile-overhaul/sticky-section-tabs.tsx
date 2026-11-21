import { useRef } from "react";
import {
  PROFILE_SECTIONS,
  type ProfileSectionId,
} from "@/features/profile/model/profile-hash-navigation";

interface StickySectionTabsProps {
  activeSection: ProfileSectionId;
  onSelectSection: (id: ProfileSectionId) => void;
}

export function StickySectionTabs({
  activeSection,
  onSelectSection,
}: StickySectionTabsProps) {
  const tabListRef = useRef<HTMLDivElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex = -1;
    if (e.key === "ArrowRight") {
      nextIndex = (index + 1) % PROFILE_SECTIONS.length;
    } else if (e.key === "ArrowLeft") {
      nextIndex = (index - 1 + PROFILE_SECTIONS.length) % PROFILE_SECTIONS.length;
    } else if (e.key === "Home") {
      nextIndex = 0;
    } else if (e.key === "End") {
      nextIndex = PROFILE_SECTIONS.length - 1;
    }

    if (nextIndex !== -1) {
      e.preventDefault();
      const nextTab = PROFILE_SECTIONS[nextIndex];
      onSelectSection(nextTab.id);
      const targetBtn = tabListRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex];
      targetBtn?.focus();
      targetBtn?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }

  return (
    <div
      ref={tabListRef}
      className="profile-section-tabs"
      role="tablist"
      aria-label="Profile sections"
    >
      {PROFILE_SECTIONS.map((section, index) => {
        const isActive = activeSection === section.id;
        return (
          <button
            key={section.id}
            id={`tab-${section.id}`}
            role="tab"
            type="button"
            aria-selected={isActive}
            aria-controls={`tabpanel-${section.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelectSection(section.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={`profile-section-tab-item ${isActive ? "is-active" : ""}`}
          >
            {section.label}
          </button>
        );
      })}
    </div>
  );
}

export const SectionTabs = StickySectionTabs;
