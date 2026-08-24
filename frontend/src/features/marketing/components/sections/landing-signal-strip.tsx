import { useId } from "react";
import { Link } from "@/shared/ui/router-link";
import { useMotion } from "../../motion-context";

export interface SignalItem {
  id: string;
  role: string;
  location: string;
  mode: string;
  skills: string[];
  href?: string;
}

export type JobSignal = SignalItem;

const DEFAULT_SIGNALS: SignalItem[] = [
  { id: "sig-1", role: "AI Engineer", location: "Bengaluru", mode: "Hybrid", skills: ["Python", "PyTorch", "AWS"] },
  { id: "sig-2", role: "Data Analyst", location: "London", mode: "On-site", skills: ["SQL", "Tableau", "Python"] },
  { id: "sig-3", role: "Backend Engineer", location: "Berlin", mode: "Remote", skills: ["Go", "PostgreSQL", "Docker"] },
  { id: "sig-4", role: "ML Engineer", location: "Singapore", mode: "On-site", skills: ["TensorFlow", "C++", "CUDA"] },
  { id: "sig-5", role: "Product Designer", location: "Toronto", mode: "Hybrid", skills: ["Figma", "UX Research", "Systems"] },
  { id: "sig-6", role: "Cloud Engineer", location: "Sydney", mode: "Remote", skills: ["AWS", "Terraform", "Kubernetes"] },
];

export function LandingSignalStrip({ jobs, signals }: { jobs?: SignalItem[]; signals?: SignalItem[] }) {
  const itemsList = jobs ?? signals ?? DEFAULT_SIGNALS;
  const headingId = useId();
  const { isMotionPaused } = useMotion();

  return (
    <section className="signal-strip-section" aria-labelledby={headingId}>
      <div className="signal-strip-header container">
        <h2 id={headingId} className="signal-strip-title mono">
          Illustrative global roles — opportunity patterns, not live openings.
        </h2>
      </div>

      <div
        className={`signal-strip-rail ${isMotionPaused ? "is-paused" : ""}`}
        aria-label="Illustrative global role signals ticker"
      >
        <div className="signal-strip-track">
          {/* Double content for seamless looping without visible gap */}
          <SignalList items={itemsList} isDuplicate={false} />
          <SignalList items={itemsList} isDuplicate={true} />
        </div>
      </div>
    </section>
  );
}

function SignalList({ items, isDuplicate }: { items: SignalItem[]; isDuplicate: boolean }) {
  return (
    <div className="signal-items-group" aria-hidden={isDuplicate || undefined}>
      {items.map((sig) => {
        const innerContent = (
          <>
            <span className="signal-node-icon" aria-hidden>
              ⨀
            </span>
            <span className="signal-role">{sig.role}</span>
            <span className="signal-sep">·</span>
            <span className="signal-location">{sig.location}</span>
            <span className="signal-sep">·</span>
            <span className="signal-mode">{sig.mode}</span>
            <div className="signal-skills-pills">
              {sig.skills.map((skill) => (
                <span key={skill} className="signal-skill-tag">
                  {skill}
                </span>
              ))}
            </div>
          </>
        );

        if (sig.href && !isDuplicate) {
          return (
            <Link
              key={sig.id}
              href={sig.href}
              className="signal-chip-item job-card-mini"
              aria-label={`${sig.role} in ${sig.location}, ${sig.mode}`}
            >
              {innerContent}
            </Link>
          );
        }

        return (
          <div
            key={`${isDuplicate ? "dup-" : ""}${sig.id}`}
            className="signal-chip-item job-card-mini"
            aria-hidden={isDuplicate || undefined}
          >
            {innerContent}
          </div>
        );
      })}
    </div>
  );
}
