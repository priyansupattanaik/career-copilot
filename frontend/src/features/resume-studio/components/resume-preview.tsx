import { useEffect, useMemo, useRef, useState } from "react";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import {
  FONT_OPTIONS,
  sectionLabel,
  type ResumeContent,
  type PresentationSettings,
  type StudioDocument,
} from "../model/resume-schema";
import { segmentTextByKeywords } from "../model/keyword-matcher";

const A4 = { width: 210, height: 297 };
const LETTER = { width: 215.9, height: 279.4 };

type PreviewMode = "width" | "page" | "custom";

function pageSize(presentation: PresentationSettings) {
  return presentation.page_size === "letter" ? LETTER : A4;
}

function fontCss(presentation: PresentationSettings) {
  return FONT_OPTIONS.find((item) => item.id === presentation.font_family)?.css || FONT_OPTIONS[0].css;
}

function dateRange(start: string, end: string, current?: boolean) {
  if (start && current) return `${start} – Present`;
  if (start && end) return `${start} – ${end}`;
  return end || start;
}

function visibleKeys(content: ResumeContent) {
  const hidden = new Set(content.hidden_sections || []);
  return (content.section_order || []).filter((key) => !hidden.has(key));
}

function HighlightedText({
  text,
  keywords,
}: {
  text: string;
  keywords?: Set<string>;
}) {
  if (!keywords || keywords.size === 0 || !text) {
    return <>{text}</>;
  }
  const segments = segmentTextByKeywords(text, keywords);
  return (
    <>
      {segments.map((segment, idx) =>
        segment.isMatch ? (
          <mark
            key={idx}
            className="rs-keyword-highlight bg-yellow-200 text-black px-0.5 rounded-xs"
          >
            {segment.text}
          </mark>
        ) : (
          <span key={idx}>{segment.text}</span>
        ),
      )}
    </>
  );
}

function ResumeFlow({
  document,
  idPrefix,
  highlightKeywords,
}: {
  document: StudioDocument;
  idPrefix: string;
  highlightKeywords?: Set<string>;
}) {
  const { content, presentation } = document;
  const extraById = Object.fromEntries(content.additional.map((item) => [item.id, item]));
  const personal = content.personal;
  const contact = [personal.email, personal.phone, personal.location].filter((item) => item?.trim());
  const urls = [personal.linkedin, personal.github, personal.portfolio, personal.website].filter((item) => item?.trim());

  return (
    <div className={`rs-flow rs-template-${presentation.template}`} id={idPrefix}>
      {visibleKeys(content).includes("personal") ? (
        <header className="rs-header rs-block" data-keep="header">
          {personal.name.trim() ? <h1 className="rs-name">{personal.name.trim()}</h1> : null}
          {contact.length ? <p className="rs-contact">{contact.join(" · ")}</p> : null}
          {urls.length ? <p className="rs-contact rs-urls">{urls.join(" · ")}</p> : null}
        </header>
      ) : null}
      {visibleKeys(content).map((key) => {
        if (key === "personal") return null;
        if (key === "summary" && content.summary.trim()) {
          return (
            <section className="rs-section rs-block" key={key} data-keep="section">
              <h2 className="rs-heading">{sectionLabel(key, content)}</h2>
              <p className="rs-body">
                <HighlightedText text={content.summary.trim()} keywords={highlightKeywords} />
              </p>
            </section>
          );
        }
        if (key === "skills") {
          const lines = content.skill_groups
            .map((group) => {
              const names = group.items.map((item) => item.name.trim()).filter(Boolean);
              if (!names.length) return "";
              return group.name.trim() ? `${group.name.trim()}: ${names.join(", ")}` : names.join(", ");
            })
            .filter(Boolean);
          if (!lines.length) return null;
          return (
            <section className="rs-section rs-block" key={key} data-keep="section">
              <h2 className="rs-heading">{sectionLabel(key, content)}</h2>
              {presentation.template === "minimal" ? (
                <p className="rs-body">
                  <HighlightedText text={lines.join(" · ")} keywords={highlightKeywords} />
                </p>
              ) : (
                lines.map((line) => (
                  <p className="rs-body" key={line}>
                    <HighlightedText text={line} keywords={highlightKeywords} />
                  </p>
                ))
              )}
            </section>
          );
        }
        if (key === "experience") {
          if (!content.experience.length) return null;
          return (
            <section className="rs-section" key={key}>
              <h2 className="rs-heading rs-block" data-keep="heading">
                {sectionLabel(key, content)}
              </h2>
              {content.experience.map((entry) => (
                <article className="rs-entry rs-block" data-keep="entry" key={entry.id}>
                  <div className="rs-entry-head">
                    <p className="rs-entry-title">
                      <HighlightedText
                        text={[entry.title, entry.employer].filter((item) => item.trim()).join(" · ")}
                        keywords={highlightKeywords}
                      />
                    </p>
                    <p className="rs-entry-meta">
                      {[
                        entry.location,
                        dateRange(entry.start_date, entry.end_date, entry.is_current),
                        entry.employment_type,
                      ]
                        .filter((item) => item.trim())
                        .join(" · ")}
                    </p>
                  </div>
                  {entry.bullets.some((row) => row.text.trim()) ? (
                    <ul className="rs-bullets">
                      {entry.bullets
                        .filter((row) => row.text.trim())
                        .map((row) => (
                          <li key={row.id}>
                            <HighlightedText text={row.text.trim()} keywords={highlightKeywords} />
                          </li>
                        ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </section>
          );
        }
        if (key === "projects") {
          if (!content.projects.length) return null;
          return (
            <section className="rs-section" key={key}>
              <h2 className="rs-heading rs-block" data-keep="heading">
                {sectionLabel(key, content)}
              </h2>
              {content.projects.map((entry) => (
                <article className="rs-entry rs-block" data-keep="entry" key={entry.id}>
                  <p className="rs-entry-title">
                    <HighlightedText
                      text={`${entry.name.trim()}${entry.url.trim() ? ` — ${entry.url.trim()}` : ""}`}
                      keywords={highlightKeywords}
                    />
                  </p>
                  {entry.description.trim() ? (
                    <p className="rs-body">
                      <HighlightedText text={entry.description.trim()} keywords={highlightKeywords} />
                    </p>
                  ) : null}
                  {entry.technologies.some((item) => item.trim()) ? (
                    <p className="rs-body">
                      <HighlightedText
                        text={entry.technologies.filter((item) => item.trim()).join(", ")}
                        keywords={highlightKeywords}
                      />
                    </p>
                  ) : null}
                  {entry.bullets.some((row) => row.text.trim()) ? (
                    <ul className="rs-bullets">
                      {entry.bullets
                        .filter((row) => row.text.trim())
                        .map((row) => (
                          <li key={row.id}>
                            <HighlightedText text={row.text.trim()} keywords={highlightKeywords} />
                          </li>
                        ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </section>
          );
        }
        if (key === "education") {
          if (!content.education.length) return null;
          return (
            <section className="rs-section" key={key}>
              <h2 className="rs-heading rs-block" data-keep="heading">
                {sectionLabel(key, content)}
              </h2>
              {content.education.map((entry) => (
                <article className="rs-entry rs-block" data-keep="entry" key={entry.id}>
                  <p className="rs-entry-title">
                    <HighlightedText
                      text={[entry.degree, entry.institution, entry.specialization].filter((item) => item.trim()).join(" · ")}
                      keywords={highlightKeywords}
                    />
                  </p>
                  <p className="rs-entry-meta">
                    {[
                      entry.location,
                      dateRange(entry.start_date, entry.end_date),
                      entry.gpa.trim() ? `GPA ${entry.gpa.trim()}` : "",
                    ]
                      .filter((item) => item.trim())
                      .join(" · ")}
                  </p>
                  {entry.details.trim() ? (
                    <p className="rs-body">
                      <HighlightedText text={entry.details.trim()} keywords={highlightKeywords} />
                    </p>
                  ) : null}
                </article>
              ))}
            </section>
          );
        }
        if (key === "certifications") {
          const rows = content.certifications.filter((item) => item.name.trim());
          if (!rows.length) return null;
          return (
            <section className="rs-section rs-block" key={key} data-keep="section">
              <h2 className="rs-heading">{sectionLabel(key, content)}</h2>
              {rows.map((entry) => (
                <p className="rs-body" key={entry.id}>
                  <HighlightedText
                    text={[entry.name, entry.issuer, entry.date].filter((item) => item.trim()).join(" · ")}
                    keywords={highlightKeywords}
                  />
                </p>
              ))}
            </section>
          );
        }
        if (key === "achievements") {
          const rows = content.achievements.filter((item) => item.text.trim());
          if (!rows.length) return null;
          return (
            <section className="rs-section rs-block" key={key} data-keep="section">
              <h2 className="rs-heading">{sectionLabel(key, content)}</h2>
              <ul className="rs-bullets">
                {rows.map((row) => (
                  <li key={row.id}>
                    <HighlightedText text={row.text.trim()} keywords={highlightKeywords} />
                  </li>
                ))}
              </ul>
            </section>
          );
        }
        if (key === "languages") {
          const rows = content.languages.filter((item) => item.language.trim());
          if (!rows.length) return null;
          return (
            <section className="rs-section rs-block" key={key} data-keep="section">
              <h2 className="rs-heading">{sectionLabel(key, content)}</h2>
              <p className="rs-body">
                <HighlightedText
                  text={rows
                    .map((row) =>
                      row.proficiency.trim()
                        ? `${row.language.trim()} (${row.proficiency.trim()})`
                        : row.language.trim(),
                    )
                    .join(" · ")}
                  keywords={highlightKeywords}
                />
              </p>
            </section>
          );
        }
        if (key === "links") {
          const rows = content.links.filter((item) => item.url.trim());
          if (!rows.length) return null;
          return (
            <section className="rs-section rs-block" key={key} data-keep="section">
              <h2 className="rs-heading">{sectionLabel(key, content)}</h2>
              <p className="rs-body">
                {rows
                  .map((item) => (item.label.trim() ? `${item.label.trim()}: ${item.url.trim()}` : item.url.trim()))
                  .join(" · ")}
              </p>
            </section>
          );
        }
        if (key.startsWith("additional:")) {
          const extra = extraById[key.slice("additional:".length)];
          const rows = extra?.entries.filter((item) => item.text.trim()) || [];
          if (!extra || !rows.length) return null;
          return (
            <section className="rs-section rs-block" key={key} data-keep="section">
              <h2 className="rs-heading">{extra.title.trim() || "Additional"}</h2>
              <ul className="rs-bullets">
                {rows.map((row) => (
                  <li key={row.id}>
                    <HighlightedText text={row.text.trim()} keywords={highlightKeywords} />
                  </li>
                ))}
              </ul>
            </section>
          );
        }
        return null;
      })}
    </div>
  );
}

export function ResumePreview({
  document,
  highlightKeywords,
  onExport,
  exporting,
  fullscreen: controlledFullscreen,
  onToggleFullscreen,
}: {
  document: StudioDocument;
  highlightKeywords?: Set<string>;
  onExport: () => void;
  exporting: boolean;
  fullscreen?: boolean;
  onToggleFullscreen?: () => void;
}) {
  const presentation = document.presentation;
  const size = pageSize(presentation);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState<PreviewMode>("width");
  const [internalFullscreen, setInternalFullscreen] = useState(false);

  const isFullscreen = controlledFullscreen !== undefined ? controlledFullscreen : internalFullscreen;

  function toggleFullscreen() {
    if (onToggleFullscreen) {
      onToggleFullscreen();
    } else {
      setInternalFullscreen((val) => !val);
    }
  }

  const style = useMemo(
    () =>
      ({
        "--rs-font": fontCss(presentation),
        "--rs-size": `${presentation.font_size}pt`,
        "--rs-heading": `${presentation.heading_size}pt`,
        "--rs-weight": String(presentation.heading_weight),
        "--rs-leading": String(presentation.line_height),
        "--rs-para": `${presentation.paragraph_spacing}pt`,
        "--rs-section": `${presentation.section_spacing}pt`,
        "--rs-head-space": `${presentation.heading_spacing}pt`,
        "--rs-bullet-space": `${presentation.bullet_spacing}pt`,
        "--rs-indent": `${presentation.bullet_indent}pt`,
        "--rs-mt": `${presentation.margin_top}mm`,
        "--rs-mr": `${presentation.margin_right}mm`,
        "--rs-mb": `${presentation.margin_bottom}mm`,
        "--rs-ml": `${presentation.margin_left}mm`,
        "--rs-align-header": presentation.header_alignment,
        "--rs-align-heading": presentation.heading_alignment,
        "--rs-accent": presentation.accent_color,
        "--rs-page-w": `${size.width}mm`,
        "--rs-page-h": `${size.height}mm`,
      }) as React.CSSProperties,
    [presentation, size.height, size.width],
  );

  const pagePxW = (size.width / 25.4) * 96;
  const pagePxH = (size.height / 25.4) * 96;

  useEffect(() => {
    function apply() {
      const stage = stageRef.current;
      if (!stage) return;
      const availableW = stage.clientWidth - 32;
      const availableH = stage.clientHeight - 32;

      if (mode === "width") {
        const targetZoom = Math.min(1.25, Math.max(0.28, availableW / pagePxW));
        setZoom(Number(targetZoom.toFixed(2)));
      } else if (mode === "page") {
        const targetZoom = Math.min(availableW / pagePxW, availableH / pagePxH, 1.25);
        setZoom(Number(Math.max(0.28, targetZoom).toFixed(2)));
      }
    }
    apply();
    const observer = new ResizeObserver(apply);
    if (stageRef.current) observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [mode, pagePxH, pagePxW, isFullscreen]);

  const scaledW = Math.round(pagePxW * zoom);
  const scaledH = Math.round(pagePxH * zoom);

  return (
    <div className={`rs-preview ${isFullscreen ? "is-full" : ""}`} style={style}>
      <div className="rs-preview-toolbar">
        <div className="rs-zoom">
          <button
            type="button"
            className="button button-quiet rs-tool-btn"
            onClick={() => {
              setMode("custom");
              setZoom((val) => Math.max(0.25, Number((val - 0.1).toFixed(2))));
            }}
            title="Zoom out"
            aria-label="Zoom out"
          >
            −
          </button>
          <span className="rs-zoom-label">{Math.round(zoom * 100)}%</span>
          <button
            type="button"
            className="button button-quiet rs-tool-btn"
            onClick={() => {
              setMode("custom");
              setZoom((val) => Math.min(2.0, Number((val + 0.1).toFixed(2))));
            }}
            title="Zoom in"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className={`button button-quiet rs-mode-btn ${mode === "width" ? "is-active" : ""}`}
            onClick={() => setMode("width")}
          >
            Fit Width
          </button>
          <button
            type="button"
            className={`button button-quiet rs-mode-btn ${mode === "page" ? "is-active" : ""}`}
            onClick={() => setMode("page")}
          >
            Fit Page
          </button>
        </div>

        <div className="rs-preview-actions">
          <button
            type="button"
            className={`button button-quiet rs-tool-btn ${isFullscreen ? "is-active" : ""}`}
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit focus mode" : "Focus on live preview"}
            aria-label={isFullscreen ? "Exit focus mode" : "Focus on live preview"}
          >
            <CopilotIcon name={isFullscreen ? "collapse" : "expand"} size={14} />
            <span className="rs-btn-label">{isFullscreen ? "Exit Focus" : "Focus View"}</span>
          </button>
          <button
            type="button"
            className="button button-primary rs-export-btn"
            onClick={onExport}
            disabled={exporting}
          >
            <CopilotIcon name={exporting ? "loader" : "resume"} size={14} />
            <span>{exporting ? "Generating PDF…" : "Export PDF"}</span>
          </button>
        </div>
      </div>

      <div className="rs-stage rs-preview-stage rs-preview-viewport" ref={stageRef}>
        <div
          className="rs-page-container"
          style={{
            width: `${scaledW}px`,
            minHeight: `${scaledH}px`,
          }}
        >
          <div
            className="rs-page rs-preview-sheet is-active"
            style={{
              width: `${pagePxW}px`,
              minHeight: `${pagePxH}px`,
              transform: `scale(${zoom})`,
              transformOrigin: "top left",
            }}
            aria-label="Resume live paper preview"
          >
            <div className="rs-page-inner">
              <ResumeFlow
                document={document}
                idPrefix="rs-live-flow"
                highlightKeywords={highlightKeywords}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
