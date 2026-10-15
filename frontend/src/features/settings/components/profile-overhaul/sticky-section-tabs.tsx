import { useEffect, useState } from "react";
import {
  PROFILE_SECTIONS,
  resolveProfileHash,
  type ProfileSectionId,
} from "@/features/profile/model/profile-hash-navigation";
import { cn } from "@/shared/utils";

interface StickySectionTabsProps {
  activeSection: ProfileSectionId;
  onSelectSection: (id: ProfileSectionId) => void;
}

export function StickySectionTabs({
  activeSection,
  onSelectSection,
}: StickySectionTabsProps) {
  const [internalActive, setInternalActive] = useState<ProfileSectionId>(activeSection);

  useEffect(() => {
    setInternalActive(activeSection);
  }, [activeSection]);

  // Handle initial legacy hash redirect and scroll
  useEffect(() => {
    if (typeof window === "undefined") return;
    const currentHash = window.location.hash;
    if (currentHash) {
      const canonical = resolveProfileHash(currentHash);
      if (canonical !== currentHash.replace(/^#/, "")) {
        // Replace legacy hash in browser URL
        window.history.replaceState(null, "", `#${canonical}`);
      }
      onSelectSection(canonical);
      // Give DOM time to settle before smooth scrolling
      const timer = setTimeout(() => {
        const el = document.getElementById(`section-${canonical}`);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [onSelectSection]);

  // Scroll spy with IntersectionObserver
  useEffect(() => {
    if (typeof window === "undefined" || !("IntersectionObserver" in window)) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // Find visible section with highest intersection ratio
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length > 0) {
          // Sort by top position relative to viewport
          visible.sort((a, b) => Math.abs(a.boundingClientRect.top) - Math.abs(b.boundingClientRect.top));
          const targetId = visible[0].target.id.replace(/^section-/, "") as ProfileSectionId;
          if (PROFILE_SECTIONS.some((s) => s.id === targetId)) {
            setInternalActive(targetId);
          }
        }
      },
      {
        rootMargin: "-100px 0px -60% 0px",
        threshold: [0, 0.2, 0.5],
      }
    );

    PROFILE_SECTIONS.forEach((sec) => {
      const el = document.getElementById(`section-${sec.id}`);
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  function handleTabClick(id: ProfileSectionId) {
    onSelectSection(id);
    setInternalActive(id);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${id}`);
      const el = document.getElementById(`section-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  }

  return (
    <nav
      className="sticky top-0 z-20 w-full bg-black/90 backdrop-blur-md border-b border-neutral-850 py-2.5 px-1 sm:px-4 mb-6"
      aria-label="Profile navigation sections"
    >
      <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar max-w-full">
        {PROFILE_SECTIONS.map((section) => {
          const isActive = internalActive === section.id;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => handleTabClick(section.id)}
              className={cn(
                "px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-medium whitespace-nowrap transition-all select-none",
                isActive
                  ? "bg-neutral-800 text-white shadow-sm border border-neutral-700/80 font-semibold"
                  : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900 border border-transparent"
              )}
              aria-current={isActive ? "true" : undefined}
            >
              {section.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
