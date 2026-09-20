import { useEffect, useRef, useState } from "react";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import { Button, Input, Textarea } from "@/shared/ui/primitives";
import { Select } from "@/shared/ui/select-field";
import {
  CORE_SECTIONS,
  newId,
  sectionLabel,
  type Bullet,
  type ResumeContent,
  type SkillGroup,
  type SkillItem,
  type SuggestAction,
} from "../model/resume-schema";

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`rs-field ${className || ""}`}>
      <span className="rs-field-label">{label}</span>
      {children}
    </label>
  );
}

function MoveRow({
  onUp,
  onDown,
  onRemove,
  label,
}: {
  onUp?: () => void;
  onDown?: () => void;
  onRemove?: () => void;
  label: string;
}) {
  return (
    <div className="rs-row-actions">
      {onUp ? (
        <button
          type="button"
          className="button button-quiet rs-action-btn"
          onClick={onUp}
          title={`Move ${label} up`}
          aria-label={`Move ${label} up`}
        >
          <CopilotIcon name="collapse" size={13} />
        </button>
      ) : null}
      {onDown ? (
        <button
          type="button"
          className="button button-quiet rs-action-btn"
          onClick={onDown}
          title={`Move ${label} down`}
          aria-label={`Move ${label} down`}
        >
          <CopilotIcon name="expand" size={13} />
        </button>
      ) : null}
      {onRemove ? (
        <button
          type="button"
          className="button button-quiet rs-action-btn rs-action-danger"
          onClick={onRemove}
          title={`Remove ${label}`}
          aria-label={`Remove ${label}`}
        >
          <CopilotIcon name="trash" size={13} />
        </button>
      ) : null}
    </div>
  );
}

function reorder<T>(list: T[], index: number, direction: -1 | 1) {
  const next = [...list];
  const target = index + direction;
  if (target < 0 || target >= next.length) return next;
  const [item] = next.splice(index, 1);
  next.splice(target, 0, item);
  return next;
}

function BulletEditor({
  bullets,
  onChange,
  onSelect,
  onAi,
}: {
  bullets: Bullet[];
  onChange: (next: Bullet[]) => void;
  onSelect: (bullet: Bullet) => void;
  onAi?: (bullet: Bullet) => void;
}) {
  const refs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    Object.values(refs.current).forEach((node) => {
      if (!node) return;
      node.style.height = "auto";
      node.style.height = `${Math.max(36, node.scrollHeight)}px`;
    });
  }, [bullets]);

  function focus(id: string) {
    requestAnimationFrame(() => refs.current[id]?.focus());
  }

  return (
    <div className="rs-bullets-edit">
      {bullets.map((bullet, index) => (
        <div className="rs-bullet-row" key={bullet.id}>
          <span className="rs-bullet-dot" aria-hidden="true">
            •
          </span>
          <textarea
            ref={(node) => {
              refs.current[bullet.id] = node;
            }}
            aria-label={`Bullet ${index + 1}`}
            value={bullet.text}
            rows={1}
            placeholder="Describe an impactful achievement or responsibility (use metrics and action verbs)..."
            onFocus={() => onSelect(bullet)}
            onChange={(event) => {
              const next = bullets.map((row) =>
                row.id === bullet.id ? { ...row, text: event.target.value } : row,
              );
              onChange(next);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                const created: Bullet = { id: newId("b"), text: "" };
                const next = [...bullets];
                next.splice(index + 1, 0, created);
                onChange(next);
                focus(created.id);
              } else if (event.key === "Backspace" && !bullet.text && bullets.length > 1) {
                event.preventDefault();
                const previous = bullets[index - 1] || bullets[index + 1];
                onChange(bullets.filter((row) => row.id !== bullet.id));
                if (previous) focus(previous.id);
              } else if (event.key === "ArrowUp" && event.altKey) {
                event.preventDefault();
                onChange(reorder(bullets, index, -1));
              } else if (event.key === "ArrowDown" && event.altKey) {
                event.preventDefault();
                onChange(reorder(bullets, index, 1));
              } else if (event.key === "ArrowUp" && !bullet.text) {
                const previous = bullets[index - 1];
                if (previous) {
                  event.preventDefault();
                  focus(previous.id);
                }
              } else if (
                event.key === "ArrowDown" &&
                event.currentTarget.selectionStart === event.currentTarget.value.length
              ) {
                const following = bullets[index + 1];
                if (following) {
                  event.preventDefault();
                  focus(following.id);
                }
              }
            }}
          />
          <div className="rs-bullet-actions">
            {onAi ? (
              <button
                type="button"
                className="button button-quiet rs-action-btn rs-action-ai"
                onClick={() => onAi(bullet)}
                title="AI enhance bullet"
                aria-label="Improve this bullet"
              >
                <CopilotIcon name="assist" size={13} />
              </button>
            ) : null}
            <button
              type="button"
              className="button button-quiet rs-action-btn"
              disabled={index === 0}
              onClick={() => onChange(reorder(bullets, index, -1))}
              title="Move bullet up"
              aria-label="Move bullet up"
            >
              <CopilotIcon name="collapse" size={12} />
            </button>
            <button
              type="button"
              className="button button-quiet rs-action-btn"
              disabled={index === bullets.length - 1}
              onClick={() => onChange(reorder(bullets, index, 1))}
              title="Move bullet down"
              aria-label="Move bullet down"
            >
              <CopilotIcon name="expand" size={12} />
            </button>
            {bullets.length > 1 ? (
              <button
                type="button"
                className="button button-quiet rs-action-btn rs-action-danger"
                onClick={() => onChange(bullets.filter((row) => row.id !== bullet.id))}
                title="Remove bullet"
                aria-label="Remove bullet"
              >
                <CopilotIcon name="trash" size={12} />
              </button>
            ) : null}
          </div>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        className="rs-add-bullet-btn"
        onClick={() => {
          const created: Bullet = { id: newId("b"), text: "" };
          onChange([...bullets, created]);
          focus(created.id);
        }}
      >
        <CopilotIcon name="add" size={12} />
        Add bullet point
      </Button>
    </div>
  );
}

function AccordionEntryCard({
  title,
  subtitle,
  dateBadge,
  isOpen,
  onToggle,
  onUp,
  onDown,
  onRemove,
  itemLabel,
  children,
}: {
  title: string;
  subtitle?: string;
  dateBadge?: string;
  isOpen: boolean;
  onToggle: () => void;
  onUp?: () => void;
  onDown?: () => void;
  onRemove?: () => void;
  itemLabel: string;
  children: React.ReactNode;
}) {
  return (
    <article className={`rs-card rs-accordion-card ${isOpen ? "is-open" : "is-collapsed"}`}>
      <div className="rs-accordion-header" onClick={onToggle}>
        <div className="rs-accordion-info">
          <button
            type="button"
            className="button button-quiet rs-accordion-toggle-btn"
            aria-label={isOpen ? `Collapse ${itemLabel}` : `Expand ${itemLabel}`}
            aria-expanded={isOpen}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
          >
            <CopilotIcon name={isOpen ? "collapse" : "expand"} size={13} />
          </button>
          <div className="rs-accordion-titles">
            <strong className="rs-accordion-title">{title?.trim() || `Untitled ${itemLabel}`}</strong>
            {subtitle?.trim() ? <span className="rs-accordion-subtitle">{subtitle.trim()}</span> : null}
          </div>
        </div>

        <div className="rs-accordion-meta">
          {dateBadge ? <span className="rs-date-badge">{dateBadge}</span> : null}
          <div className="rs-row-actions" onClick={(e) => e.stopPropagation()}>
            {onUp ? (
              <button
                type="button"
                className="button button-quiet rs-action-btn"
                onClick={onUp}
                title={`Move ${itemLabel} up`}
                aria-label={`Move ${itemLabel} up`}
              >
                <CopilotIcon name="collapse" size={13} />
              </button>
            ) : null}
            {onDown ? (
              <button
                type="button"
                className="button button-quiet rs-action-btn"
                onClick={onDown}
                title={`Move ${itemLabel} down`}
                aria-label={`Move ${itemLabel} down`}
              >
                <CopilotIcon name="expand" size={13} />
              </button>
            ) : null}
            {onRemove ? (
              <button
                type="button"
                className="button button-quiet rs-action-btn rs-action-danger"
                onClick={onRemove}
                title={`Remove ${itemLabel}`}
                aria-label={`Remove ${itemLabel}`}
              >
                <CopilotIcon name="trash" size={13} />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {isOpen ? <div className="rs-accordion-body">{children}</div> : null}
    </article>
  );
}

function SkillGroupCard({
  group,
  groupIndex,
  groupsCount,
  onPatchGroup,
  onMoveGroup,
  onRemoveGroup,
}: {
  group: SkillGroup;
  groupIndex: number;
  groupsCount: number;
  onPatchGroup: (next: SkillGroup) => void;
  onMoveGroup: (dir: -1 | 1) => void;
  onRemoveGroup: () => void;
}) {
  const [newSkillText, setNewSkillText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  function handleAddSkills(text: string) {
    const raw = text.trim();
    if (!raw) return;
    const parts = raw
      .split(/[,]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!parts.length) return;
    const added: SkillItem[] = parts.map((name) => ({ id: newId("skill"), name }));
    onPatchGroup({
      ...group,
      items: [...group.items, ...added],
    });
    setNewSkillText("");
  }

  function handleRemoveSkill(id: string) {
    onPatchGroup({
      ...group,
      items: group.items.filter((item) => item.id !== id),
    });
  }

  function handleUpdateSkill(id: string, name: string) {
    onPatchGroup({
      ...group,
      items: group.items.map((item) => (item.id === id ? { ...item, name } : item)),
    });
  }

  return (
    <article className="rs-card rs-skill-card" key={group.id}>
      <div className="rs-card-head">
        <div className="rs-skill-header-group">
          <input
            className="rs-skill-group-name-input"
            value={group.name}
            placeholder="Category name (e.g., Languages, Frameworks, Cloud, Databases)..."
            onChange={(e) => onPatchGroup({ ...group, name: e.target.value })}
            aria-label="Skill category name"
          />
          <span className="rs-badge">{group.items.length} skills</span>
        </div>
        <MoveRow
          label={group.name || "skill group"}
          onUp={groupIndex > 0 ? () => onMoveGroup(-1) : undefined}
          onDown={groupIndex < groupsCount - 1 ? () => onMoveGroup(1) : undefined}
          onRemove={onRemoveGroup}
        />
      </div>

      <div className="rs-skill-pill-list">
        {group.items.map((item) => (
          <div className="rs-skill-pill" key={item.id}>
            {editingId === item.id ? (
              <input
                autoFocus
                className="rs-skill-pill-input"
                value={item.name}
                onChange={(e) => handleUpdateSkill(item.id, e.target.value)}
                onBlur={() => setEditingId(null)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "Escape") {
                    setEditingId(null);
                  }
                }}
              />
            ) : (
              <span
                className="rs-skill-pill-text"
                onClick={() => setEditingId(item.id)}
                title="Click to edit skill"
              >
                {item.name || "Untitled"}
              </span>
            )}
            <button
              type="button"
              className="rs-skill-pill-del"
              onClick={() => handleRemoveSkill(item.id)}
              title={`Remove ${item.name || "skill"}`}
              aria-label={`Remove ${item.name || "skill"}`}
            >
              ×
            </button>
          </div>
        ))}
        {group.items.length === 0 ? (
          <p className="rs-hint rs-hint-sm">No skills added yet in this group.</p>
        ) : null}
      </div>

      <div className="rs-skill-add-row">
        <Input
          placeholder="Add skill (press Enter or comma for multiple)..."
          value={newSkillText}
          onChange={(e) => setNewSkillText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              handleAddSkills(newSkillText);
            }
          }}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => handleAddSkills(newSkillText)}
          disabled={!newSkillText.trim()}
        >
          <CopilotIcon name="add" size={13} />
          Add Skill
        </Button>
      </div>
    </article>
  );
}

function getSectionCountBadge(key: string, content: ResumeContent): string {
  if (key === "skills") {
    const total = content.skill_groups.reduce((acc, g) => acc + g.items.length, 0);
    return total ? `${total} skills` : "";
  }
  if (key === "experience") {
    return content.experience.length ? `${content.experience.length} roles` : "";
  }
  if (key === "projects") {
    return content.projects.length ? `${content.projects.length} projects` : "";
  }
  if (key === "education") {
    return content.education.length ? `${content.education.length} degrees` : "";
  }
  if (key === "certifications") {
    return content.certifications.length ? `${content.certifications.length} certs` : "";
  }
  if (key === "achievements") {
    return content.achievements.length ? `${content.achievements.length} items` : "";
  }
  if (key === "languages") {
    return content.languages.length ? `${content.languages.length} langs` : "";
  }
  if (key.startsWith("additional:")) {
    const extra = content.additional.find((item) => `additional:${item.id}` === key);
    return extra?.entries.length ? `${extra.entries.length} items` : "";
  }
  return "";
}

export function ResumeSectionNav({
  content,
  selected,
  onSelect,
  onMove,
  onReorder,
  onToggle,
  onAdd,
}: {
  content: ResumeContent;
  selected: string;
  onSelect: (key: string) => void;
  onMove: (key: string, direction: -1 | 1) => void;
  onReorder?: (sourceKey: string, targetKey: string) => void;
  onToggle: (key: string) => void;
  onAdd: (key: string) => void;
}) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);
  const hidden = new Set(content.hidden_sections);
  const present = new Set(content.section_order);
  const addable = CORE_SECTIONS.filter((key) => !present.has(key));

  return (
    <div className="rs-nav">
      <div className="rs-nav-header">
        <span className="rs-nav-title">Resume Outline</span>
        <span className="rs-hint rs-hint-sm">{content.section_order.length} sections</span>
      </div>

      <ul className="rs-nav-list" role="tablist" aria-orientation="vertical">
        {content.section_order.map((key, index) => {
          const isHidden = hidden.has(key);
          const isSelected = selected === key;
          const isDragging = dragKey === key;
          const isDragOver = overKey === key;
          const badge = getSectionCountBadge(key, content);

          return (
            <li
              key={key}
              draggable={true}
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", key);
                e.dataTransfer.effectAllowed = "move";
                setDragKey(key);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDragEnter={() => {
                if (dragKey && dragKey !== key) {
                  setOverKey(key);
                }
              }}
              onDragLeave={(e) => {
                if (overKey === key && !e.currentTarget.contains(e.relatedTarget as Node)) {
                  setOverKey(null);
                }
              }}
              onDragEnd={() => {
                setDragKey(null);
                setOverKey(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragKey && dragKey !== key && onReorder) {
                  onReorder(dragKey, key);
                }
                setDragKey(null);
                setOverKey(null);
              }}
              className={`rs-nav-item ${isSelected ? "is-selected" : ""} ${isHidden ? "is-hidden" : ""} ${isDragging ? "is-dragging" : ""} ${isDragOver ? "is-drag-over" : ""}`}
            >
              <span className="rs-nav-drag-handle" title="Drag to reorder section" aria-label="Drag to reorder section">
                <CopilotIcon name="menu" size={12} />
              </span>

              <button
                type="button"
                role="tab"
                aria-selected={isSelected}
                className="rs-nav-select-btn"
                onClick={() => onSelect(key)}
              >
                <div className="rs-nav-btn-content">
                  <span className="rs-nav-name">{sectionLabel(key, content)}</span>
                  {badge ? <span className="rs-nav-badge">{badge}</span> : null}
                </div>
              </button>

              <div className="rs-nav-item-actions">
                <button
                  type="button"
                  className="button button-quiet rs-nav-btn"
                  disabled={index === 0}
                  onClick={() => onMove(key, -1)}
                  title={`Move ${sectionLabel(key, content)} up`}
                  aria-label={`Move ${sectionLabel(key, content)} up`}
                >
                  <CopilotIcon name="collapse" size={12} />
                </button>
                <button
                  type="button"
                  className="button button-quiet rs-nav-btn"
                  disabled={index === content.section_order.length - 1}
                  onClick={() => onMove(key, 1)}
                  title={`Move ${sectionLabel(key, content)} down`}
                  aria-label={`Move ${sectionLabel(key, content)} down`}
                >
                  <CopilotIcon name="expand" size={12} />
                </button>
                {key !== "personal" ? (
                  <button
                    type="button"
                    className={`button button-quiet rs-nav-btn ${isHidden ? "is-muted" : ""}`}
                    onClick={() => onToggle(key)}
                    title={
                      isHidden
                        ? `Show ${sectionLabel(key, content)} on resume`
                        : `Hide ${sectionLabel(key, content)} from resume`
                    }
                    aria-label={
                      isHidden
                        ? `Show ${sectionLabel(key, content)}`
                        : `Hide ${sectionLabel(key, content)}`
                    }
                  >
                    <CopilotIcon name={isHidden ? "hide" : "show"} size={12} />
                  </button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {addable.length ? (
        <div className="rs-nav-add-wrap">
          <Field label="Add More Sections">
            <Select
              aria-label="Add a resume section"
              value=""
              onChange={(event) => {
                if (event.target.value) {
                  onAdd(event.target.value);
                }
              }}
            >
              <option value="" disabled>
                + Add Section to Resume
              </option>
              {addable.map((key) => (
                <option key={key} value={key}>
                  {sectionLabel(key, content)}
                </option>
              ))}
              <option value="additional">Custom / Additional Section</option>
            </Select>
          </Field>
        </div>
      ) : (
        <div className="rs-nav-add-wrap">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => onAdd("additional")}
          >
            <CopilotIcon name="add" size={14} />
            Add Custom Section
          </Button>
        </div>
      )}
    </div>
  );
}

export function ResumeSectionEditor({
  content,
  selected,
  onChange,
  onSelectText,
  onRequestAi,
}: {
  content: ResumeContent;
  selected: string;
  onChange: (next: ResumeContent) => void;
  onSelectText: (payload: {
    section: string;
    entryId?: string;
    bulletId?: string;
    text: string;
  }) => void;
  onRequestAi: (action: SuggestAction) => void;
}) {
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

  function isEntryOpen(id: string, defaultOpen = false): boolean {
    return expandedMap[id] !== undefined ? expandedMap[id] : defaultOpen;
  }

  function toggleEntry(id: string, defaultOpen = false) {
    setExpandedMap((prev) => ({
      ...prev,
      [id]: !(prev[id] !== undefined ? prev[id] : defaultOpen),
    }));
  }

  function setEntryOpen(id: string, open: boolean) {
    setExpandedMap((prev) => ({ ...prev, [id]: open }));
  }

  const extra = selected.startsWith("additional:")
    ? content.additional.find((item) => `additional:${item.id}` === selected)
    : null;

  function patch<K extends keyof ResumeContent>(key: K, value: ResumeContent[K]) {
    onChange({ ...content, [key]: value });
  }

  if (selected === "personal") {
    const p = content.personal;
    return (
      <div className="rs-editor-pane">
        <div className="rs-pane-head">
          <div>
            <h2>Personal Information</h2>
            <p className="rs-hint">Include contact coordinates so hiring managers can reach you.</p>
          </div>
        </div>

        <div className="rs-grid-2col">
          <Field label="Full Name">
            <Input
              aria-label="Full name"
              placeholder="Full name, e.g. Alex Morgan"
              value={p.name}
              onChange={(event) => patch("personal", { ...p, name: event.target.value })}
            />
          </Field>
          <Field label="Email Address">
            <Input
              type="email"
              placeholder="e.g. alex.morgan@example.com"
              value={p.email}
              onChange={(event) => patch("personal", { ...p, email: event.target.value })}
            />
          </Field>
          <Field label="Phone Number">
            <Input
              placeholder="e.g. +1 (555) 234-5678"
              value={p.phone}
              onChange={(event) => patch("personal", { ...p, phone: event.target.value })}
            />
          </Field>
          <Field label="Location">
            <Input
              placeholder="e.g. San Francisco, CA (or Remote)"
              value={p.location}
              onChange={(event) => patch("personal", { ...p, location: event.target.value })}
            />
          </Field>
          <Field label="LinkedIn Profile">
            <Input
              placeholder="e.g. https://linkedin.com/in/alexmorgan"
              value={p.linkedin}
              onChange={(event) => patch("personal", { ...p, linkedin: event.target.value })}
            />
          </Field>
          <Field label="GitHub Profile">
            <Input
              placeholder="e.g. https://github.com/alexmorgan"
              value={p.github}
              onChange={(event) => patch("personal", { ...p, github: event.target.value })}
            />
          </Field>
          <Field label="Portfolio URL">
            <Input
              placeholder="e.g. https://alexmorgan.dev"
              value={p.portfolio}
              onChange={(event) => patch("personal", { ...p, portfolio: event.target.value })}
            />
          </Field>
          <Field label="Personal Website">
            <Input
              placeholder="e.g. https://alexmorgan.io"
              value={p.website}
              onChange={(event) => patch("personal", { ...p, website: event.target.value })}
            />
          </Field>
        </div>
      </div>
    );
  }

  if (selected === "summary") {
    return (
      <div className="rs-editor-pane">
        <div className="rs-pane-head">
          <div>
            <h2>Professional Summary</h2>
            <p className="rs-hint">A concise 3-4 sentence elevator pitch showcasing your strongest accomplishments and value.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onRequestAi("improve_summary")}
            disabled={!content.summary.trim()}
          >
            <CopilotIcon name="assist" size={14} />
            AI Improve
          </Button>
        </div>
        <Field label="Summary Statement">
          <Textarea
            aria-label="Summary statement"
            rows={5}
            placeholder="Summary statement, e.g. Staff Software Engineer with 8+ years architecting distributed systems and cloud platforms..."
            value={content.summary}
            onFocus={() => onSelectText({ section: "summary", text: content.summary })}
            onChange={(event) => {
              patch("summary", event.target.value);
              onSelectText({ section: "summary", text: event.target.value });
            }}
          />
        </Field>
      </div>
    );
  }

  if (selected === "skills") {
    return (
      <div className="rs-editor-pane">
        <div className="rs-pane-head">
          <div>
            <h2>Skills & Technologies</h2>
            <p className="rs-hint">Categorize skills cleanly to make your resume readable by both recruiters and ATS scanners.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onRequestAi("suggest_supported_skills")}
          >
            <CopilotIcon name="assist" size={14} />
            Suggest Skills
          </Button>
        </div>

        {content.skill_groups.map((group, groupIndex) => (
          <SkillGroupCard
            key={group.id}
            group={group}
            groupIndex={groupIndex}
            groupsCount={content.skill_groups.length}
            onPatchGroup={(updated) => {
              const groups = content.skill_groups.map((row) =>
                row.id === group.id ? updated : row,
              );
              patch("skill_groups", groups);
            }}
            onMoveGroup={(dir) =>
              patch("skill_groups", reorder(content.skill_groups, groupIndex, dir))
            }
            onRemoveGroup={() =>
              patch(
                "skill_groups",
                content.skill_groups.filter((row) => row.id !== group.id),
              )
            }
          />
        ))}

        <Button
          type="button"
          variant="secondary"
          className="rs-add-group-btn"
          onClick={() =>
            patch("skill_groups", [
              ...content.skill_groups,
              { id: newId("sg"), name: "", items: [] },
            ])
          }
        >
          <CopilotIcon name="add" size={14} />
          Add New Skill Group
        </Button>
      </div>
    );
  }

  if (selected === "experience") {
    return (
      <div className="rs-editor-pane">
        <div className="rs-pane-head">
          <div>
            <h2>Work Experience</h2>
            <p className="rs-hint">Highlight roles with measurable impact, technologies used, and leadership.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const newRole = {
                id: newId("exp"),
                employer: "",
                title: "",
                location: "",
                start_date: "",
                end_date: "",
                is_current: false,
                employment_type: "Full-time",
                bullets: [{ id: newId("b"), text: "" }],
              };
              setEntryOpen(newRole.id, true);
              patch("experience", [...content.experience, newRole]);
            }}
          >
            <CopilotIcon name="add" size={14} />
            Add Role
          </Button>
        </div>

        {content.experience.map((entry, index) => {
          const defaultOpen = index === 0;
          const open = isEntryOpen(entry.id, defaultOpen);
          const startDate = entry.start_date?.trim();
          const endDate = entry.end_date?.trim();
          const dateBadge = startDate || endDate
            ? `${startDate || ""} – ${entry.is_current ? "Present" : endDate || ""}`
            : "";
          const employer = entry.employer?.trim();
          const loc = entry.location?.trim();
          const expSubtitle = [employer, loc].filter(Boolean).join(" · ");

          return (
            <AccordionEntryCard
              key={entry.id}
              itemLabel="role"
              title={entry.title?.trim() || "Untitled role"}
              subtitle={expSubtitle}
              dateBadge={dateBadge}
              isOpen={open}
              onToggle={() => toggleEntry(entry.id, defaultOpen)}
              onUp={index > 0 ? () => patch("experience", reorder(content.experience, index, -1)) : undefined}
              onDown={index < content.experience.length - 1 ? () => patch("experience", reorder(content.experience, index, 1)) : undefined}
              onRemove={() => patch("experience", content.experience.filter((row) => row.id !== entry.id))}
            >
              <div className="rs-grid-2col">
                <Field label="Job Title">
                  <Input
                    aria-label="Job title"
                    placeholder="Job title, e.g. Lead Infrastructure Architect"
                    value={entry.title}
                    onChange={(event) =>
                      patch(
                        "experience",
                        content.experience.map((row) =>
                          row.id === entry.id ? { ...row, title: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Employer / Company">
                  <Input
                    aria-label="Employer"
                    placeholder="Employer, e.g. Apex Cloud Systems"
                    value={entry.employer}
                    onChange={(event) =>
                      patch(
                        "experience",
                        content.experience.map((row) =>
                          row.id === entry.id ? { ...row, employer: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Location">
                  <Input
                    aria-label="Location"
                    placeholder="Location, e.g. San Francisco, CA / Remote"
                    value={entry.location}
                    onChange={(event) =>
                      patch(
                        "experience",
                        content.experience.map((row) =>
                          row.id === entry.id ? { ...row, location: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Employment Type">
                  <Input
                    aria-label="Employment type"
                    placeholder="Employment type, e.g. Full-time, Contract, Part-time"
                    value={entry.employment_type}
                    onChange={(event) =>
                      patch(
                        "experience",
                        content.experience.map((row) =>
                          row.id === entry.id ? { ...row, employment_type: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Start Date">
                  <Input
                    aria-label="Start date"
                    placeholder="Start date, e.g. 2022-03"
                    value={entry.start_date}
                    onChange={(event) =>
                      patch(
                        "experience",
                        content.experience.map((row) =>
                          row.id === entry.id ? { ...row, start_date: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="End Date">
                  <Input
                    aria-label="End date"
                    placeholder="End date, e.g. 2024-01 or Present"
                    value={entry.end_date}
                    disabled={entry.is_current}
                    onChange={(event) =>
                      patch(
                        "experience",
                        content.experience.map((row) =>
                          row.id === entry.id ? { ...row, end_date: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </Field>
              </div>

              <label className="rs-check">
                <input
                  type="checkbox"
                  aria-label="I currently work in this role"
                  checked={entry.is_current}
                  onChange={(event) =>
                    patch(
                      "experience",
                      content.experience.map((row) =>
                        row.id === entry.id
                          ? {
                              ...row,
                              is_current: event.target.checked,
                              end_date: event.target.checked ? "" : row.end_date,
                            }
                          : row,
                      ),
                    )
                  }
                />
                <span>I currently work in this role</span>
              </label>

              <div className="rs-bullet-section-header">
                <p className="rs-kicker">Key Accomplishments & Responsibilities</p>
              </div>

              <BulletEditor
                bullets={entry.bullets}
                onSelect={(bullet) =>
                  onSelectText({
                    section: "experience",
                    entryId: entry.id,
                    bulletId: bullet.id,
                    text: bullet.text,
                  })
                }
                onChange={(bullets) =>
                  patch(
                    "experience",
                    content.experience.map((row) => (row.id === entry.id ? { ...row, bullets } : row)),
                  )
                }
                onAi={(bullet) => {
                  onSelectText({
                    section: "experience",
                    entryId: entry.id,
                    bulletId: bullet.id,
                    text: bullet.text,
                  });
                  onRequestAi("improve_bullet");
                }}
              />
            </AccordionEntryCard>
          );
        })}

        <Button
          type="button"
          variant="secondary"
          className="rs-add-entry-btn"
          onClick={() => {
            const newRole = {
              id: newId("exp"),
              employer: "",
              title: "",
              location: "",
              start_date: "",
              end_date: "",
              is_current: false,
              employment_type: "Full-time",
              bullets: [{ id: newId("b"), text: "" }],
            };
            setEntryOpen(newRole.id, true);
            patch("experience", [...content.experience, newRole]);
          }}
        >
          <CopilotIcon name="add" size={14} />
          Add Role
        </Button>
      </div>
    );
  }

  if (selected === "projects") {
    return (
      <div className="rs-editor-pane">
        <div className="rs-pane-head">
          <div>
            <h2>Projects</h2>
            <p className="rs-hint">Demonstrate hands-on problem solving, architectural design, and modern tech stacks.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const newProj = {
                id: newId("proj"),
                name: "",
                description: "",
                technologies: [],
                url: "",
                bullets: [{ id: newId("b"), text: "" }],
              };
              setEntryOpen(newProj.id, true);
              patch("projects", [...content.projects, newProj]);
            }}
          >
            <CopilotIcon name="add" size={14} />
            Add Project
          </Button>
        </div>

        {content.projects.map((entry, index) => {
          const defaultOpen = index === 0;
          const open = isEntryOpen(entry.id, defaultOpen);
          const techSubtitle = entry.technologies
            ?.map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 3)
            .join(", ");

          return (
            <AccordionEntryCard
              key={entry.id}
              itemLabel="project"
              title={entry.name?.trim() || "Untitled project"}
              subtitle={techSubtitle}
              isOpen={open}
              onToggle={() => toggleEntry(entry.id, defaultOpen)}
              onUp={index > 0 ? () => patch("projects", reorder(content.projects, index, -1)) : undefined}
              onDown={index < content.projects.length - 1 ? () => patch("projects", reorder(content.projects, index, 1)) : undefined}
              onRemove={() => patch("projects", content.projects.filter((row) => row.id !== entry.id))}
            >
              <div className="rs-grid-2col">
                <Field label="Project Name">
                  <Input
                    aria-label="Project name"
                    placeholder="Project name, e.g. Distributed Cache Engine"
                    value={entry.name}
                    onChange={(event) =>
                      patch(
                        "projects",
                        content.projects.map((row) =>
                          row.id === entry.id ? { ...row, name: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Project URL / Repository">
                  <Input
                    aria-label="Project URL"
                    placeholder="Project URL, e.g. https://github.com/alexmorgan/hypercache"
                    value={entry.url}
                    onChange={(event) =>
                      patch(
                        "projects",
                        content.projects.map((row) =>
                          row.id === entry.id ? { ...row, url: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </Field>
              </div>

              <Field label="Overview Description">
                <Textarea
                  aria-label="Project overview"
                  rows={2}
                  placeholder="High-level description of what the project does and the problem it solves..."
                  value={entry.description}
                  onChange={(event) =>
                    patch(
                      "projects",
                      content.projects.map((row) =>
                        row.id === entry.id ? { ...row, description: event.target.value } : row,
                      ),
                    )
                  }
                />
              </Field>

              <Field label="Technologies Used (comma separated)">
                <Input
                  aria-label="Technologies used"
                  placeholder="Technologies used, e.g. Rust, Tokio, gRPC, Prometheus, Docker"
                  value={entry.technologies.join(", ")}
                  onChange={(event) =>
                    patch(
                      "projects",
                      content.projects.map((row) =>
                        row.id === entry.id
                          ? {
                              ...row,
                              technologies: event.target.value
                                .split(",")
                                .map((item) => item.trim())
                                .filter(Boolean),
                            }
                          : row,
                      ),
                    )
                  }
                />
              </Field>

              <div className="rs-bullet-section-header">
                <p className="rs-kicker">Project Highlights & Impact</p>
              </div>

              <BulletEditor
                bullets={entry.bullets}
                onSelect={(bullet) =>
                  onSelectText({
                    section: "projects",
                    entryId: entry.id,
                    bulletId: bullet.id,
                    text: bullet.text,
                  })
                }
                onChange={(bullets) =>
                  patch(
                    "projects",
                    content.projects.map((row) => (row.id === entry.id ? { ...row, bullets } : row)),
                  )
                }
                onAi={(bullet) => {
                  onSelectText({
                    section: "projects",
                    entryId: entry.id,
                    bulletId: bullet.id,
                    text: bullet.text,
                  });
                  onRequestAi("improve_bullet");
                }}
              />
            </AccordionEntryCard>
          );
        })}

        <Button
          type="button"
          variant="secondary"
          className="rs-add-entry-btn"
          onClick={() => {
            const newProj = {
              id: newId("proj"),
              name: "",
              description: "",
              technologies: [],
              url: "",
              bullets: [{ id: newId("b"), text: "" }],
            };
            setEntryOpen(newProj.id, true);
            patch("projects", [...content.projects, newProj]);
          }}
        >
          <CopilotIcon name="add" size={14} />
          Add Project
        </Button>
      </div>
    );
  }

  if (selected === "education") {
    return (
      <div className="rs-editor-pane">
        <div className="rs-pane-head">
          <div>
            <h2>Education</h2>
            <p className="rs-hint">Include degrees, academic honors, specialization, and university details.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const newEdu = {
                id: newId("edu"),
                institution: "",
                degree: "",
                specialization: "",
                location: "",
                start_date: "",
                end_date: "",
                gpa: "",
                details: "",
              };
              setEntryOpen(newEdu.id, true);
              patch("education", [...content.education, newEdu]);
            }}
          >
            <CopilotIcon name="add" size={14} />
            Add Education
          </Button>
        </div>

        {content.education.map((entry, index) => {
          const defaultOpen = index === 0;
          const open = isEntryOpen(entry.id, defaultOpen);
          const startDate = entry.start_date?.trim();
          const endDate = entry.end_date?.trim();
          const dateBadge = startDate || endDate
            ? `${startDate || ""} – ${endDate || ""}`
            : "";
          const degree = entry.degree?.trim();
          const institution = entry.institution?.trim();
          const eduTitle = degree || institution || "Untitled degree";
          const eduSubtitle = degree && institution ? institution : "";

          return (
            <AccordionEntryCard
              key={entry.id}
              itemLabel="degree"
              title={eduTitle}
              subtitle={eduSubtitle}
              dateBadge={dateBadge}
              isOpen={open}
              onToggle={() => toggleEntry(entry.id, defaultOpen)}
              onUp={index > 0 ? () => patch("education", reorder(content.education, index, -1)) : undefined}
              onDown={index < content.education.length - 1 ? () => patch("education", reorder(content.education, index, 1)) : undefined}
              onRemove={() => patch("education", content.education.filter((row) => row.id !== entry.id))}
            >
              <div className="rs-grid-2col">
                <Field label="Degree / Qualification">
                  <Input
                    aria-label="Degree"
                    placeholder="Degree or certificate, e.g. B.S. Computer Science"
                    value={entry.degree}
                    onChange={(event) =>
                      patch(
                        "education",
                        content.education.map((row) =>
                          row.id === entry.id ? { ...row, degree: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Institution / University">
                  <Input
                    aria-label="School or institution"
                    placeholder="School or institution, e.g. University of Waterloo"
                    value={entry.institution}
                    onChange={(event) =>
                      patch(
                        "education",
                        content.education.map((row) =>
                          row.id === entry.id ? { ...row, institution: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Specialization / Major">
                  <Input
                    aria-label="Field of study"
                    placeholder="e.g. Distributed Systems"
                    value={entry.specialization}
                    onChange={(event) =>
                      patch(
                        "education",
                        content.education.map((row) =>
                          row.id === entry.id ? { ...row, specialization: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Location">
                  <Input
                    aria-label="Location"
                    placeholder="e.g. Berkeley, CA"
                    value={entry.location}
                    onChange={(event) =>
                      patch(
                        "education",
                        content.education.map((row) =>
                          row.id === entry.id ? { ...row, location: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Start Date">
                  <Input
                    aria-label="Start date"
                    placeholder="e.g. 2014-08"
                    value={entry.start_date}
                    onChange={(event) =>
                      patch(
                        "education",
                        content.education.map((row) =>
                          row.id === entry.id ? { ...row, start_date: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="End Date">
                  <Input
                    aria-label="End date"
                    placeholder="e.g. 2018-05"
                    value={entry.end_date}
                    onChange={(event) =>
                      patch(
                        "education",
                        content.education.map((row) =>
                          row.id === entry.id ? { ...row, end_date: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="GPA (Optional)">
                  <Input
                    aria-label="GPA"
                    placeholder="e.g. 3.88 / 4.00"
                    value={entry.gpa}
                    onChange={(event) =>
                      patch(
                        "education",
                        content.education.map((row) =>
                          row.id === entry.id ? { ...row, gpa: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </Field>
              </div>

              <Field label="Honors, Coursework, or Extracurriculars">
                <Textarea
                  aria-label="Honors, coursework, or extracurriculars"
                  rows={2}
                  placeholder="e.g. Dean's Honor List, Eta Kappa Nu Honor Society, Algorithms Teaching Assistant"
                  value={entry.details}
                  onChange={(event) =>
                    patch(
                      "education",
                      content.education.map((row) =>
                        row.id === entry.id ? { ...row, details: event.target.value } : row,
                      ),
                    )
                  }
                />
              </Field>
            </AccordionEntryCard>
          );
        })}

        <Button
          type="button"
          variant="secondary"
          className="rs-add-entry-btn"
          onClick={() => {
            const newEdu = {
              id: newId("edu"),
              institution: "",
              degree: "",
              specialization: "",
              location: "",
              start_date: "",
              end_date: "",
              gpa: "",
              details: "",
            };
            setEntryOpen(newEdu.id, true);
            patch("education", [...content.education, newEdu]);
          }}
        >
          <CopilotIcon name="add" size={14} />
          Add Education
        </Button>
      </div>
    );
  }

  if (selected === "certifications") {
    return (
      <div className="rs-editor-pane">
        <div className="rs-pane-head">
          <div>
            <h2>Certifications & Licensures</h2>
            <p className="rs-hint">Professional credentials, cloud certifications, and technical accreditations.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              const newCert = {
                id: newId("cert"),
                name: "",
                issuer: "",
                date: "",
                credential_id: "",
                credential_url: "",
              };
              setEntryOpen(newCert.id, true);
              patch("certifications", [...content.certifications, newCert]);
            }}
          >
            <CopilotIcon name="add" size={14} />
            Add Certification
          </Button>
        </div>

        {content.certifications.map((entry, index) => {
          const defaultOpen = index === 0;
          const open = isEntryOpen(entry.id, defaultOpen);
          const certTitle = entry.name?.trim() || "Untitled certification";
          const certSubtitle = entry.issuer?.trim();
          const certDate = entry.date?.trim();

          return (
            <AccordionEntryCard
              key={entry.id}
              itemLabel="certification"
              title={certTitle}
              subtitle={certSubtitle}
              dateBadge={certDate}
              isOpen={open}
              onToggle={() => toggleEntry(entry.id, defaultOpen)}
              onUp={index > 0 ? () => patch("certifications", reorder(content.certifications, index, -1)) : undefined}
              onDown={index < content.certifications.length - 1 ? () => patch("certifications", reorder(content.certifications, index, 1)) : undefined}
              onRemove={() => patch("certifications", content.certifications.filter((row) => row.id !== entry.id))}
            >
              <div className="rs-grid-2col">
                <Field label="Certification Name">
                  <Input
                    aria-label="Certification name"
                    placeholder="Certification name, e.g. AWS Solutions Architect"
                    value={entry.name}
                    onChange={(event) =>
                      patch(
                        "certifications",
                        content.certifications.map((row) =>
                          row.id === entry.id ? { ...row, name: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Issuing Body / Organization">
                  <Input
                    aria-label="Issuing organization"
                    placeholder="e.g. Amazon Web Services"
                    value={entry.issuer}
                    onChange={(event) =>
                      patch(
                        "certifications",
                        content.certifications.map((row) =>
                          row.id === entry.id ? { ...row, issuer: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Issue Date">
                  <Input
                    aria-label="Date earned"
                    placeholder="e.g. 2023-11"
                    value={entry.date}
                    onChange={(event) =>
                      patch(
                        "certifications",
                        content.certifications.map((row) =>
                          row.id === entry.id ? { ...row, date: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Credential ID">
                  <Input
                    aria-label="Credential ID"
                    placeholder="e.g. AWS-PSA-982341"
                    value={entry.credential_id}
                    onChange={(event) =>
                      patch(
                        "certifications",
                        content.certifications.map((row) =>
                          row.id === entry.id ? { ...row, credential_id: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Verification URL">
                  <Input
                    aria-label="Verification URL"
                    placeholder="e.g. https://aws.amazon.com/verify"
                    value={entry.credential_url}
                    onChange={(event) =>
                      patch(
                        "certifications",
                        content.certifications.map((row) =>
                          row.id === entry.id ? { ...row, credential_url: event.target.value } : row,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
            </AccordionEntryCard>
          );
        })}

        <Button
          type="button"
          variant="secondary"
          className="rs-add-entry-btn"
          onClick={() => {
            const newCert = {
              id: newId("cert"),
              name: "",
              issuer: "",
              date: "",
              credential_id: "",
              credential_url: "",
            };
            setEntryOpen(newCert.id, true);
            patch("certifications", [...content.certifications, newCert]);
          }}
        >
          <CopilotIcon name="add" size={14} />
          Add Certification
        </Button>
      </div>
    );
  }

  if (selected === "achievements") {
    return (
      <div className="rs-editor-pane">
        <div className="rs-pane-head">
          <div>
            <h2>Key Achievements & Honors</h2>
            <p className="rs-hint">Competitions, hackathons, open source recognitions, and major awards.</p>
          </div>
        </div>
        <BulletEditor
          bullets={content.achievements.map((row) => ({ id: row.id, text: row.text }))}
          onSelect={(bullet) =>
            onSelectText({ section: "achievements", entryId: bullet.id, text: bullet.text })
          }
          onChange={(bullets) =>
            patch(
              "achievements",
              bullets.map((row) => ({ id: row.id, text: row.text })),
            )
          }
        />
      </div>
    );
  }

  if (selected === "languages") {
    return (
      <div className="rs-editor-pane">
        <div className="rs-pane-head">
          <div>
            <h2>Languages</h2>
            <p className="rs-hint">Highlight multilingual capabilities and fluency levels.</p>
          </div>
        </div>

        {content.languages.map((entry, index) => (
          <article className="rs-card" key={entry.id}>
            <div className="rs-card-head">
              <strong>{entry.language?.trim() || `Language ${index + 1}`}</strong>
              <MoveRow
                label={entry.language?.trim() || "language"}
                onRemove={() =>
                  patch(
                    "languages",
                    content.languages.filter((row) => row.id !== entry.id),
                  )
                }
                onUp={
                  index > 0
                    ? () => patch("languages", reorder(content.languages, index, -1))
                    : undefined
                }
                onDown={
                  index < content.languages.length - 1
                    ? () => patch("languages", reorder(content.languages, index, 1))
                    : undefined
                }
              />
            </div>
            <div className="rs-grid-2col">
              <Field label="Language">
                <Input
                  aria-label="Language name"
                  placeholder="e.g. English, French, Hindi, Spanish, Mandarin"
                  value={entry.language}
                  onChange={(event) =>
                    patch(
                      "languages",
                      content.languages.map((row) =>
                        row.id === entry.id ? { ...row, language: event.target.value } : row,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Proficiency Level">
                <Select
                  aria-label="Language proficiency"
                  value={entry.proficiency}
                  onChange={(event) =>
                    patch(
                      "languages",
                      content.languages.map((row) =>
                        row.id === entry.id ? { ...row, proficiency: event.target.value } : row,
                      ),
                    )
                  }
                >
                  <option value="">Select proficiency</option>
                  <option value="Native / Bilingual">Native / Bilingual</option>
                  <option value="Full Professional">Full Professional</option>
                  <option value="Professional Working">Professional Working</option>
                  <option value="Conversational">Conversational</option>
                  <option value="Elementary">Elementary</option>
                </Select>
              </Field>
            </div>
          </article>
        ))}

        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            patch("languages", [
              ...content.languages,
              { id: newId("lang"), language: "", proficiency: "Professional Working" },
            ])
          }
        >
          <CopilotIcon name="add" size={13} />
          Add Language
        </Button>
      </div>
    );
  }

  if (selected === "links") {
    return (
      <div className="rs-editor-pane">
        <div className="rs-pane-head">
          <div>
            <h2>Web Links & Profiles</h2>
            <p className="rs-hint">Personal blogs, tech publications, portfolio showcases, or professional memberships.</p>
          </div>
        </div>

        {content.links.map((entry, index) => (
          <div className="rs-card" key={entry.id}>
            <div className="rs-card-head">
              <strong>{entry.label?.trim() || `Link ${index + 1}`}</strong>
              <MoveRow
                label={entry.label?.trim() || "link"}
                onRemove={() =>
                  patch(
                    "links",
                    content.links.filter((row) => row.id !== entry.id),
                  )
                }
                onUp={index > 0 ? () => patch("links", reorder(content.links, index, -1)) : undefined}
                onDown={
                  index < content.links.length - 1
                    ? () => patch("links", reorder(content.links, index, 1))
                    : undefined
                }
              />
            </div>
            <div className="rs-grid-2col">
              <Field label="Label">
                <Input
                  aria-label="Link label"
                  placeholder="e.g. Medium Blog, Tech Talk Slides"
                  value={entry.label}
                  onChange={(event) =>
                    patch(
                      "links",
                      content.links.map((row) =>
                        row.id === entry.id ? { ...row, label: event.target.value } : row,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="URL">
                <Input
                  aria-label="Link URL"
                  placeholder="e.g. https://medium.com/@alexmorgan"
                  value={entry.url}
                  onChange={(event) =>
                    patch(
                      "links",
                      content.links.map((row) =>
                        row.id === entry.id ? { ...row, url: event.target.value } : row,
                      ),
                    )
                  }
                />
              </Field>
            </div>
          </div>
        ))}

        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            patch("links", [...content.links, { id: newId("link"), label: "", url: "" }])
          }
        >
          <CopilotIcon name="add" size={14} />
          Add Link
        </Button>
      </div>
    );
  }

  if (extra) {
    return (
      <div className="rs-editor-pane">
        <div className="rs-pane-head">
          <Field label="Custom Section Title" className="flex-1">
            <Input
              value={extra.title}
              placeholder="e.g. Patents & Publications, Volunteering, Speaking"
              onChange={(event) =>
                patch(
                  "additional",
                  content.additional.map((row) =>
                    row.id === extra.id ? { ...row, title: event.target.value } : row,
                  ),
                )
              }
            />
          </Field>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              const additional = content.additional.filter((row) => row.id !== extra.id);
              onChange({
                ...content,
                additional,
                section_order: content.section_order.filter(
                  (key) => key !== `additional:${extra.id}`,
                ),
              });
            }}
          >
            Remove section
          </Button>
        </div>

        <BulletEditor
          bullets={extra.entries.map((row) => ({ id: row.id, text: row.text }))}
          onSelect={(bullet) =>
            onSelectText({ section: selected, entryId: bullet.id, text: bullet.text })
          }
          onChange={(bullets) =>
            patch(
              "additional",
              content.additional.map((row) =>
                row.id === extra.id
                  ? {
                      ...row,
                      entries: bullets.map((item) => ({ id: item.id, text: item.text })),
                    }
                  : row,
              ),
            )
          }
        />
      </div>
    );
  }

  return (
    <div className="rs-editor-pane">
      <h2>Select a section</h2>
      <p className="rs-hint">Choose a resume section on the left outline to edit its content.</p>
    </div>
  );
}
