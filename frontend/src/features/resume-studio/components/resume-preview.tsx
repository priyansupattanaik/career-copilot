import { useEffect, useMemo, useRef, useState } from "react";
import { CopilotIcon } from "@/components/ui/copilot-icons";
import {
  FONT_OPTIONS,
  sectionLabel,
  type ResumeContent,
  type PresentationSettings,
  type StudioDocument,
} from "../model/resume-schema";

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

function ResumeFlow({
  document,
  idPrefix,
}: {
  document: StudioDocument;
  idPrefix: string;
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
              <p className="rs-body">{content.summary.trim()}</p>
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
                <p className="rs-body">{lines.join(" · ")}</p>
              ) : (
                lines.map((line) => (
                  <p className="rs-body" key={line}>
                    {line}
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
                      {[entry.title, entry.employer].filter((item) => item.trim()).join(" · ")}
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
                          <li key={row.id}>{row.text.trim()}</li>
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
                    {entry.name.trim()}
                    {entry.url.trim() ? ` — ${entry.url.trim()}` : ""}
                  </p>
                  {entry.description.trim() ? <p className="rs-body">{entry.description.trim()}</p> : null}
                  {entry.technologies.some((item) => item.trim()) ? (
                    <p className="rs-body">{entry.technologies.filter((item) => item.trim()).join(", ")}</p>
                  ) : null}
                  {entry.bullets.some((row) => row.text.trim()) ? (
                    <ul className="rs-bullets">
                      {entry.bullets
                        .filter((row) => row.text.trim())
                        .map((row) => (
                          <li key={row.id}>{row.text.trim()}</li>
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
                    {[entry.degree, entry.institution, entry.specialization].filter((item) => item.trim()).join(" · ")}
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
                  {entry.details.trim() ? <p className="rs-body">{entry.details.trim()}</p> : null}
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
                  {[entry.name, entry.issuer, entry.date].filter((item) => item.trim()).join(" · ")}
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
                  <li key={row.id}>{row.text.trim()}</li>
                ))}
              </ul>
            </section>
          );
        }
        if (key === "languages") {
          const line = content.languages
            .filter((row) => row.language.trim())
            .map((row) =>
              row.proficiency.trim() ? `${row.language.trim()} (${row.proficiency.trim()})` : row.language.trim(),
            )
            .join(" · ");
          if (!line) return null;
          return (
            <section className="rs-section rs-block" key={key} data-keep="section">
              <h2 className="rs-heading">{sectionLabel(key, content)}</h2>
              <p className="rs-body">{line}</p>
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
                {rows.map((item) => (item.label.trim() ? `${item.label.trim()}: ${item.url.trim()}` : item.url.trim())).join(" · ")}
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
                  <li key={row.id}>{row.text.trim()}</li>
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
  onExport,
  exporting,
}: {
  document: StudioDocument;
  onExport: () => void;
  exporting: boolean;
}) {
  const presentation = document.presentation;
  const size = pageSize(presentation);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState<PreviewMode>("width");
  const [pages, setPages] = useState<string[][]>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

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

  useEffect(() => {
    const measure = measureRef.current;
    if (!measure) return;
    const innerHeight =
      measure.clientHeight -
      measure.querySelector(".rs-page-inner")!.clientHeight +
      (measure.querySelector(".rs-page-inner") as HTMLElement).clientHeight;
    const pageInner = measure.querySelector(".rs-page-inner") as HTMLElement | null;
    const limit = pageInner?.clientHeight || 1;
    const blocks = Array.from(measure.querySelectorAll(".rs-block")) as HTMLElement[];
    const packed: string[][] = [[]];
    let used = 0;
    for (const block of blocks) {
      const height = block.offsetHeight;
      const last = packed[packed.length - 1];
      if (last.length && used + height > limit) {
        packed.push([block.outerHTML]);
        used = height;
      } else {
        last.push(block.outerHTML);
        used += height;
      }
    }
    setPages(packed.filter((page) => page.length));
    setPageIndex((current) => Math.min(current, Math.max(0, packed.length - 1)));
    void innerHeight;
  }, [document]);

  useEffect(() => {
    function apply() {
      const stage = stageRef.current;
      if (!stage) return;
      const available = stage.clientWidth - 24;
      const pagePx = (size.width / 25.4) * 96;
      const pageH = (size.height / 25.4) * 96;
      if (mode === "width") setZoom(Math.min(1.15, Math.max(0.35, available / pagePx)));
      if (mode === "page") {
        const availableH = Math.max(240, stage.clientHeight - 24);
        setZoom(Math.min(available / pagePx, availableH / pageH, 1.15));
      }
    }
    apply();
    const observer = new ResizeObserver(apply);
    if (stageRef.current) observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, [mode, size.height, size.width, fullscreen]);

  const pageCount = Math.max(1, pages.length);

  return (
    <div className={`rs-preview ${fullscreen ? "is-full" : ""}`} style={style}>
      <div className="rs-preview-toolbar">
        <div className="rs-zoom">
          <button type="button" className="button button-quiet" onClick={() => { setMode("custom"); setZoom((value) => Math.max(0.4, value - 0.1)); }} aria-label="Zoom out">
            −
          </button>
          <span>{Math.round(zoom * 100)}%</span>
          <button type="button" className="button button-quiet" onClick={() => { setMode("custom"); setZoom((value) => Math.min(1.6, value + 0.1)); }} aria-label="Zoom in">
            +
          </button>
          <button type="button" className="button button-quiet" onClick={() => setMode("width")}>
            Fit width
          </button>
          <button type="button" className="button button-quiet" onClick={() => setMode("page")}>
            Fit page
          </button>
        </div>
        {pageCount > 1 ? (
          <div className="rs-page-nav">
            <button type="button" className="button button-quiet" disabled={pageIndex === 0} onClick={() => setPageIndex((value) => Math.max(0, value - 1))} aria-label="Previous page">
              <CopilotIcon name="back" size={14} />
            </button>
            <span>
              {pageIndex + 1} / {pageCount}
            </span>
            <button type="button" className="button button-quiet" disabled={pageIndex >= pageCount - 1} onClick={() => setPageIndex((value) => Math.min(pageCount - 1, value + 1))} aria-label="Next page">
              <CopilotIcon name="next" size={14} />
            </button>
          </div>
        ) : null}
        <div className="rs-preview-actions">
          <button type="button" className="button button-quiet" onClick={() => setFullscreen((value) => !value)}>
            {fullscreen ? "Exit preview" : "Fullscreen"}
          </button>
          <button type="button" className="button button-primary" onClick={onExport} disabled={exporting}>
            <CopilotIcon name="resume" size={14} />
            {exporting ? "Exporting…" : "Export PDF"}
          </button>
        </div>
      </div>
      <div className="rs-stage" ref={stageRef}>
        {pages.length ? (
          pages.map((html, index) => (
            <div
              className={`rs-page ${index === pageIndex ? "is-active" : ""}`}
              key={`page-${index}`}
              style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}
              aria-label={`Resume page ${index + 1} of ${pageCount}`}
            >
              <div className="rs-page-inner" dangerouslySetInnerHTML={{ __html: html.join("") }} />
            </div>
          ))
        ) : (
          <div className="rs-page is-active" style={{ transform: `scale(${zoom})`, transformOrigin: "top center" }}>
            <div className="rs-page-inner">
              <ResumeFlow document={document} idPrefix="rs-live-flow" />
            </div>
          </div>
        )}
      </div>
      <div className="rs-measure" aria-hidden ref={measureRef}>
        <div className="rs-page">
          <div className="rs-page-inner">
            <ResumeFlow document={document} idPrefix="rs-measure-flow" />
          </div>
        </div>
      </div>
    </div>
  );
}
