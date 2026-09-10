import { useEffect, useRef } from "react";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import { Button, Input, Textarea } from "@/shared/ui/primitives";
import {
  CORE_SECTIONS,
  newId,
  sectionLabel,
  type Bullet,
  type ResumeContent,
  type SuggestAction,
} from "../model/resume-schema";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="rs-field">
      <span>{label}</span>
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
        <button type="button" className="button button-quiet" onClick={onUp} aria-label={`Move ${label} up`}>
          <CopilotIcon name="collapse" size={14} />
        </button>
      ) : null}
      {onDown ? (
        <button type="button" className="button button-quiet" onClick={onDown} aria-label={`Move ${label} down`}>
          <CopilotIcon name="expand" size={14} />
        </button>
      ) : null}
      {onRemove ? (
        <button type="button" className="button button-quiet" onClick={onRemove} aria-label={`Remove ${label}`}>
          <CopilotIcon name="trash" size={14} />
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
          <span aria-hidden="true">•</span>
          <textarea
            ref={(node) => {
              refs.current[bullet.id] = node;
            }}
            aria-label={`Bullet ${index + 1}`}
            value={bullet.text}
            rows={1}
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
              } else if (event.key === "ArrowDown" && event.currentTarget.selectionStart === event.currentTarget.value.length) {
                const following = bullets[index + 1];
                if (following) {
                  event.preventDefault();
                  focus(following.id);
                }
              }
            }}
          />
          <MoveRow
            label={`bullet ${index + 1}`}
            onUp={() => onChange(reorder(bullets, index, -1))}
            onDown={() => onChange(reorder(bullets, index, 1))}
            onRemove={() => onChange(bullets.filter((row) => row.id !== bullet.id))}
          />
          {onAi ? (
            <button type="button" className="button button-quiet" onClick={() => onAi(bullet)} aria-label="Improve this bullet">
              <CopilotIcon name="assist" size={14} />
            </button>
          ) : null}
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() => onChange([...bullets, { id: newId("b"), text: "" }])}
      >
        <CopilotIcon name="add" size={14} />
        Add bullet
      </Button>
    </div>
  );
}

export function ResumeSectionNav({
  content,
  selected,
  onSelect,
  onMove,
  onToggle,
  onAdd,
}: {
  content: ResumeContent;
  selected: string;
  onSelect: (key: string) => void;
  onMove: (key: string, direction: -1 | 1) => void;
  onToggle: (key: string) => void;
  onAdd: (key: string) => void;
}) {
  const hidden = new Set(content.hidden_sections || []);
  const present = new Set(content.section_order);
  const addable = CORE_SECTIONS.filter((key) => key !== "personal" && !present.has(key));
  return (
    <div className="rs-nav">
      <p className="rs-kicker">Sections</p>
      <ul>
        {content.section_order.map((key, index) => (
          <li key={key}>
            <button
              type="button"
              className={`rs-nav-item ${selected === key ? "is-active" : ""} ${hidden.has(key) ? "is-hidden" : ""}`}
              onClick={() => onSelect(key)}
            >
              {sectionLabel(key, content)}
            </button>
            <div className="rs-nav-tools">
              <button type="button" className="button button-quiet" disabled={index === 0} onClick={() => onMove(key, -1)} aria-label={`Move ${sectionLabel(key, content)} up`}>
                <CopilotIcon name="collapse" size={13} />
              </button>
              <button type="button" className="button button-quiet" disabled={index === content.section_order.length - 1} onClick={() => onMove(key, 1)} aria-label={`Move ${sectionLabel(key, content)} down`}>
                <CopilotIcon name="expand" size={13} />
              </button>
              {key !== "personal" ? (
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={() => onToggle(key)}
                  aria-label={hidden.has(key) ? `Show ${sectionLabel(key, content)}` : `Hide ${sectionLabel(key, content)}`}
                >
                  <CopilotIcon name={hidden.has(key) ? "hide" : "show"} size={13} />
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {addable.length ? (
        <label className="rs-field">
          <span>Add section</span>
          <select
            className="field"
            value=""
            aria-label="Add section"
            onChange={(event) => {
              if (event.target.value) onAdd(event.target.value);
              event.target.value = "";
            }}
          >
            <option value="">Choose a section</option>
            {addable.map((key) => (
              <option key={key} value={key}>
                {sectionLabel(key, content)}
              </option>
            ))}
            <option value="additional">Custom section</option>
          </select>
        </label>
      ) : (
        <Button type="button" variant="secondary" onClick={() => onAdd("additional")}>
          <CopilotIcon name="add" size={14} />
          Custom section
        </Button>
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
  onSelectText: (payload: { section: string; entryId?: string; bulletId?: string; text: string }) => void;
  onRequestAi: (action: SuggestAction) => void;
}) {
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
        <h2>Personal information</h2>
        <div className="rs-grid">
          <Field label="Full name">
            <Input value={p.name} onChange={(event) => patch("personal", { ...p, name: event.target.value })} />
          </Field>
          <Field label="Email">
            <Input type="email" value={p.email} onChange={(event) => patch("personal", { ...p, email: event.target.value })} />
          </Field>
          <Field label="Phone">
            <Input value={p.phone} onChange={(event) => patch("personal", { ...p, phone: event.target.value })} />
          </Field>
          <Field label="Location">
            <Input value={p.location} onChange={(event) => patch("personal", { ...p, location: event.target.value })} />
          </Field>
          <Field label="LinkedIn">
            <Input value={p.linkedin} onChange={(event) => patch("personal", { ...p, linkedin: event.target.value })} />
          </Field>
          <Field label="GitHub">
            <Input value={p.github} onChange={(event) => patch("personal", { ...p, github: event.target.value })} />
          </Field>
          <Field label="Portfolio">
            <Input value={p.portfolio} onChange={(event) => patch("personal", { ...p, portfolio: event.target.value })} />
          </Field>
          <Field label="Website">
            <Input value={p.website} onChange={(event) => patch("personal", { ...p, website: event.target.value })} />
          </Field>
        </div>
      </div>
    );
  }

  if (selected === "summary") {
    return (
      <div className="rs-editor-pane">
        <div className="rs-pane-head">
          <h2>Professional summary</h2>
          <Button type="button" variant="secondary" onClick={() => onRequestAi("improve_summary")} disabled={!content.summary.trim()}>
            <CopilotIcon name="assist" size={14} />
            Improve summary
          </Button>
        </div>
        <Field label="Summary">
          <Textarea
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
          <h2>Skills</h2>
          <Button type="button" variant="secondary" onClick={() => onRequestAi("suggest_supported_skills")}>
            <CopilotIcon name="assist" size={14} />
            Suggest supported skills
          </Button>
        </div>
        {content.skill_groups.map((group, groupIndex) => (
          <article className="rs-card" key={group.id}>
            <div className="rs-card-head">
              <Field label="Group name">
                <Input
                  value={group.name}
                  placeholder="Optional group"
                  onChange={(event) => {
                    const groups = content.skill_groups.map((row) =>
                      row.id === group.id ? { ...row, name: event.target.value } : row,
                    );
                    patch("skill_groups", groups);
                  }}
                />
              </Field>
              <MoveRow
                label={group.name || "skill group"}
                onUp={() => patch("skill_groups", reorder(content.skill_groups, groupIndex, -1))}
                onDown={() => patch("skill_groups", reorder(content.skill_groups, groupIndex, 1))}
                onRemove={() => patch("skill_groups", content.skill_groups.filter((row) => row.id !== group.id))}
              />
            </div>
            <div className="rs-chip-list">
              {group.items.map((item, itemIndex) => (
                <div className="rs-chip" key={item.id}>
                  <Input
                    aria-label={`Skill ${itemIndex + 1}`}
                    value={item.name}
                    onChange={(event) => {
                      const groups = content.skill_groups.map((row) =>
                        row.id === group.id
                          ? {
                              ...row,
                              items: row.items.map((skill) =>
                                skill.id === item.id ? { ...skill, name: event.target.value } : skill,
                              ),
                            }
                          : row,
                      );
                      patch("skill_groups", groups);
                    }}
                  />
                  <button
                    type="button"
                    className="button button-quiet"
                    aria-label={`Remove ${item.name || "skill"}`}
                    onClick={() => {
                      const groups = content.skill_groups.map((row) =>
                        row.id === group.id
                          ? { ...row, items: row.items.filter((skill) => skill.id !== item.id) }
                          : row,
                      );
                      patch("skill_groups", groups);
                    }}
                  >
                    <CopilotIcon name="close" size={13} />
                  </button>
                </div>
              ))}
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                const groups = content.skill_groups.map((row) =>
                  row.id === group.id ? { ...row, items: [...row.items, { id: newId("skill"), name: "" }] } : row,
                );
                patch("skill_groups", groups);
              }}
            >
              Add skill
            </Button>
          </article>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            patch("skill_groups", [...content.skill_groups, { id: newId("sg"), name: "", items: [{ id: newId("skill"), name: "" }] }])
          }
        >
          Add skill group
        </Button>
      </div>
    );
  }

  if (selected === "experience") {
    return (
      <div className="rs-editor-pane">
        <h2>Experience</h2>
        {content.experience.map((entry, index) => (
          <article className="rs-card" key={entry.id}>
            <div className="rs-card-head">
              <strong>{entry.title || entry.employer || `Role ${index + 1}`}</strong>
              <MoveRow
                label={entry.title || "role"}
                onUp={() => patch("experience", reorder(content.experience, index, -1))}
                onDown={() => patch("experience", reorder(content.experience, index, 1))}
                onRemove={() => patch("experience", content.experience.filter((row) => row.id !== entry.id))}
              />
            </div>
            <div className="rs-grid">
              <Field label="Job title">
                <Input value={entry.title} onChange={(event) => patch("experience", content.experience.map((row) => row.id === entry.id ? { ...row, title: event.target.value } : row))} />
              </Field>
              <Field label="Employer">
                <Input value={entry.employer} onChange={(event) => patch("experience", content.experience.map((row) => row.id === entry.id ? { ...row, employer: event.target.value } : row))} />
              </Field>
              <Field label="Location">
                <Input value={entry.location} onChange={(event) => patch("experience", content.experience.map((row) => row.id === entry.id ? { ...row, location: event.target.value } : row))} />
              </Field>
              <Field label="Employment type">
                <Input value={entry.employment_type} onChange={(event) => patch("experience", content.experience.map((row) => row.id === entry.id ? { ...row, employment_type: event.target.value } : row))} />
              </Field>
              <Field label="Start date">
                <Input value={entry.start_date} onChange={(event) => patch("experience", content.experience.map((row) => row.id === entry.id ? { ...row, start_date: event.target.value } : row))} />
              </Field>
              <Field label="End date">
                <Input value={entry.end_date} disabled={entry.is_current} onChange={(event) => patch("experience", content.experience.map((row) => row.id === entry.id ? { ...row, end_date: event.target.value } : row))} />
              </Field>
            </div>
            <label className="rs-check">
              <input
                type="checkbox"
                checked={entry.is_current}
                onChange={(event) =>
                  patch(
                    "experience",
                    content.experience.map((row) =>
                      row.id === entry.id ? { ...row, is_current: event.target.checked, end_date: event.target.checked ? "" : row.end_date } : row,
                    ),
                  )
                }
              />
              Current role
            </label>
            <p className="rs-kicker">Bullets</p>
            <BulletEditor
              bullets={entry.bullets}
              onSelect={(bullet) => onSelectText({ section: "experience", entryId: entry.id, bulletId: bullet.id, text: bullet.text })}
              onChange={(bullets) =>
                patch(
                  "experience",
                  content.experience.map((row) => (row.id === entry.id ? { ...row, bullets } : row)),
                )
              }
              onAi={(bullet) => {
                onSelectText({ section: "experience", entryId: entry.id, bulletId: bullet.id, text: bullet.text });
                onRequestAi("improve_bullet");
              }}
            />
          </article>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            patch("experience", [
              ...content.experience,
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
            ])
          }
        >
          Add role
        </Button>
      </div>
    );
  }

  if (selected === "projects") {
    return (
      <div className="rs-editor-pane">
        <h2>Projects</h2>
        {content.projects.map((entry, index) => (
          <article className="rs-card" key={entry.id}>
            <div className="rs-card-head">
              <strong>{entry.name || `Project ${index + 1}`}</strong>
              <MoveRow
                label={entry.name || "project"}
                onUp={() => patch("projects", reorder(content.projects, index, -1))}
                onDown={() => patch("projects", reorder(content.projects, index, 1))}
                onRemove={() => patch("projects", content.projects.filter((row) => row.id !== entry.id))}
              />
            </div>
            <div className="rs-grid">
              <Field label="Project name">
                <Input value={entry.name} onChange={(event) => patch("projects", content.projects.map((row) => row.id === entry.id ? { ...row, name: event.target.value } : row))} />
              </Field>
              <Field label="Link">
                <Input value={entry.url} onChange={(event) => patch("projects", content.projects.map((row) => row.id === entry.id ? { ...row, url: event.target.value } : row))} />
              </Field>
            </div>
            <Field label="Description">
              <Textarea value={entry.description} onChange={(event) => patch("projects", content.projects.map((row) => row.id === entry.id ? { ...row, description: event.target.value } : row))} />
            </Field>
            <Field label="Technologies">
              <Input
                value={entry.technologies.join(", ")}
                onChange={(event) =>
                  patch(
                    "projects",
                    content.projects.map((row) =>
                      row.id === entry.id
                        ? { ...row, technologies: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) }
                        : row,
                    ),
                  )
                }
              />
            </Field>
            <BulletEditor
              bullets={entry.bullets}
              onSelect={(bullet) => onSelectText({ section: "projects", entryId: entry.id, bulletId: bullet.id, text: bullet.text })}
              onChange={(bullets) =>
                patch(
                  "projects",
                  content.projects.map((row) => (row.id === entry.id ? { ...row, bullets } : row)),
                )
              }
              onAi={(bullet) => {
                onSelectText({ section: "projects", entryId: entry.id, bulletId: bullet.id, text: bullet.text });
                onRequestAi("improve_bullet");
              }}
            />
          </article>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            patch("projects", [
              ...content.projects,
              { id: newId("proj"), name: "", description: "", technologies: [], url: "", bullets: [{ id: newId("b"), text: "" }] },
            ])
          }
        >
          Add project
        </Button>
      </div>
    );
  }

  if (selected === "education") {
    return (
      <div className="rs-editor-pane">
        <h2>Education</h2>
        {content.education.map((entry, index) => (
          <article className="rs-card" key={entry.id}>
            <div className="rs-card-head">
              <strong>{entry.institution || `Education ${index + 1}`}</strong>
              <MoveRow
                label={entry.institution || "education"}
                onUp={() => patch("education", reorder(content.education, index, -1))}
                onDown={() => patch("education", reorder(content.education, index, 1))}
                onRemove={() => patch("education", content.education.filter((row) => row.id !== entry.id))}
              />
            </div>
            <div className="rs-grid">
              <Field label="Institution">
                <Input value={entry.institution} onChange={(event) => patch("education", content.education.map((row) => row.id === entry.id ? { ...row, institution: event.target.value } : row))} />
              </Field>
              <Field label="Degree">
                <Input value={entry.degree} onChange={(event) => patch("education", content.education.map((row) => row.id === entry.id ? { ...row, degree: event.target.value } : row))} />
              </Field>
              <Field label="Specialization">
                <Input value={entry.specialization} onChange={(event) => patch("education", content.education.map((row) => row.id === entry.id ? { ...row, specialization: event.target.value } : row))} />
              </Field>
              <Field label="Location">
                <Input value={entry.location} onChange={(event) => patch("education", content.education.map((row) => row.id === entry.id ? { ...row, location: event.target.value } : row))} />
              </Field>
              <Field label="Start date">
                <Input value={entry.start_date} onChange={(event) => patch("education", content.education.map((row) => row.id === entry.id ? { ...row, start_date: event.target.value } : row))} />
              </Field>
              <Field label="End date">
                <Input value={entry.end_date} onChange={(event) => patch("education", content.education.map((row) => row.id === entry.id ? { ...row, end_date: event.target.value } : row))} />
              </Field>
              <Field label="GPA">
                <Input value={entry.gpa} onChange={(event) => patch("education", content.education.map((row) => row.id === entry.id ? { ...row, gpa: event.target.value } : row))} />
              </Field>
            </div>
            <Field label="Details">
              <Textarea value={entry.details} onChange={(event) => patch("education", content.education.map((row) => row.id === entry.id ? { ...row, details: event.target.value } : row))} />
            </Field>
          </article>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            patch("education", [
              ...content.education,
              { id: newId("edu"), institution: "", degree: "", specialization: "", location: "", start_date: "", end_date: "", gpa: "", details: "" },
            ])
          }
        >
          Add education
        </Button>
      </div>
    );
  }

  if (selected === "certifications") {
    return (
      <div className="rs-editor-pane">
        <h2>Certifications</h2>
        {content.certifications.map((entry, index) => (
          <article className="rs-card" key={entry.id}>
            <div className="rs-card-head">
              <strong>{entry.name || `Certification ${index + 1}`}</strong>
              <MoveRow
                label={entry.name || "certification"}
                onUp={() => patch("certifications", reorder(content.certifications, index, -1))}
                onDown={() => patch("certifications", reorder(content.certifications, index, 1))}
                onRemove={() => patch("certifications", content.certifications.filter((row) => row.id !== entry.id))}
              />
            </div>
            <div className="rs-grid">
              <Field label="Certification">
                <Input value={entry.name} onChange={(event) => patch("certifications", content.certifications.map((row) => row.id === entry.id ? { ...row, name: event.target.value } : row))} />
              </Field>
              <Field label="Issuing organization">
                <Input value={entry.issuer} onChange={(event) => patch("certifications", content.certifications.map((row) => row.id === entry.id ? { ...row, issuer: event.target.value } : row))} />
              </Field>
              <Field label="Date">
                <Input value={entry.date} onChange={(event) => patch("certifications", content.certifications.map((row) => row.id === entry.id ? { ...row, date: event.target.value } : row))} />
              </Field>
              <Field label="Credential ID">
                <Input value={entry.credential_id} onChange={(event) => patch("certifications", content.certifications.map((row) => row.id === entry.id ? { ...row, credential_id: event.target.value } : row))} />
              </Field>
              <Field label="Credential URL">
                <Input value={entry.credential_url} onChange={(event) => patch("certifications", content.certifications.map((row) => row.id === entry.id ? { ...row, credential_url: event.target.value } : row))} />
              </Field>
            </div>
          </article>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() =>
            patch("certifications", [
              ...content.certifications,
              { id: newId("cert"), name: "", issuer: "", date: "", credential_id: "", credential_url: "" },
            ])
          }
        >
          Add certification
        </Button>
      </div>
    );
  }

  if (selected === "achievements") {
    return (
      <div className="rs-editor-pane">
        <h2>Achievements</h2>
        <BulletEditor
          bullets={content.achievements.map((row) => ({ id: row.id, text: row.text }))}
          onSelect={(bullet) => onSelectText({ section: "achievements", entryId: bullet.id, text: bullet.text })}
          onChange={(bullets) => patch("achievements", bullets.map((row) => ({ id: row.id, text: row.text })))}
        />
      </div>
    );
  }

  if (selected === "languages") {
    return (
      <div className="rs-editor-pane">
        <h2>Languages</h2>
        {content.languages.map((entry, index) => (
          <div className="rs-grid" key={entry.id}>
            <Field label="Language">
              <Input value={entry.language} onChange={(event) => patch("languages", content.languages.map((row) => row.id === entry.id ? { ...row, language: event.target.value } : row))} />
            </Field>
            <Field label="Proficiency">
              <Input value={entry.proficiency} onChange={(event) => patch("languages", content.languages.map((row) => row.id === entry.id ? { ...row, proficiency: event.target.value } : row))} />
            </Field>
            <MoveRow
              label={entry.language || "language"}
              onRemove={() => patch("languages", content.languages.filter((row) => row.id !== entry.id))}
              onUp={() => patch("languages", reorder(content.languages, index, -1))}
              onDown={() => patch("languages", reorder(content.languages, index, 1))}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => patch("languages", [...content.languages, { id: newId("lang"), language: "", proficiency: "" }])}
        >
          Add language
        </Button>
      </div>
    );
  }

  if (selected === "links") {
    return (
      <div className="rs-editor-pane">
        <h2>Links</h2>
        {content.links.map((entry, index) => (
          <div className="rs-grid" key={entry.id}>
            <Field label="Label">
              <Input value={entry.label} onChange={(event) => patch("links", content.links.map((row) => row.id === entry.id ? { ...row, label: event.target.value } : row))} />
            </Field>
            <Field label="URL">
              <Input value={entry.url} onChange={(event) => patch("links", content.links.map((row) => row.id === entry.id ? { ...row, url: event.target.value } : row))} />
            </Field>
            <MoveRow
              label={entry.label || "link"}
              onRemove={() => patch("links", content.links.filter((row) => row.id !== entry.id))}
              onUp={() => patch("links", reorder(content.links, index, -1))}
              onDown={() => patch("links", reorder(content.links, index, 1))}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="secondary"
          onClick={() => patch("links", [...content.links, { id: newId("link"), label: "", url: "" }])}
        >
          Add link
        </Button>
      </div>
    );
  }

  if (extra) {
    return (
      <div className="rs-editor-pane">
        <div className="rs-pane-head">
          <Field label="Section title">
            <Input
              value={extra.title}
              onChange={(event) =>
                patch(
                  "additional",
                  content.additional.map((row) => (row.id === extra.id ? { ...row, title: event.target.value } : row)),
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
                section_order: content.section_order.filter((key) => key !== `additional:${extra.id}`),
              });
            }}
          >
            Remove section
          </Button>
        </div>
        <BulletEditor
          bullets={extra.entries.map((row) => ({ id: row.id, text: row.text }))}
          onSelect={(bullet) => onSelectText({ section: selected, entryId: bullet.id, text: bullet.text })}
          onChange={(bullets) =>
            patch(
              "additional",
              content.additional.map((row) =>
                row.id === extra.id ? { ...row, entries: bullets.map((item) => ({ id: item.id, text: item.text })) } : row,
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
      <p>Choose a resume section on the left to edit it.</p>
    </div>
  );
}
