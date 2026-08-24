import { Link } from "@/shared/ui/router-link";

export interface SequenceStage {
  id: string;
  number: string;
  verb: string;
  title: string;
  description: string;
  href: string;
  visualLabel: string;
}

const STAGES: SequenceStage[] = [
  {
    id: "stage-1",
    number: "01",
    verb: "Understand",
    title: "Resume + Job Description",
    description: "Extract structured evidence from your work experience and target role descriptions.",
    href: "/resume-analysis?tab=upload",
    visualLabel: "Parsing structural experience & role requirements",
  },
  {
    id: "stage-2",
    number: "02",
    verb: "Verify",
    title: "Evidence-Backed Skill Matching",
    description: "Map verified skills directly to source resume text without relying on keyword inflation.",
    href: "/resume-analysis?tab=ats",
    visualLabel: "Connecting confirmed evidence to role criteria",
  },
  {
    id: "stage-3",
    number: "03",
    verb: "Improve",
    title: "Grounded Resume Recommendations",
    description: "Receive exact, evidence-grounded revisions to present your true capabilities clearly.",
    href: "/resume-analysis",
    visualLabel: "Generating deterministic ATS & bullet refinements",
  },
  {
    id: "stage-4",
    number: "04",
    verb: "Practice",
    title: "Realistic Interview Preparation",
    description: "Simulate technical and behavioral questions in an interactive practice chamber.",
    href: "/mock-interview/preparation",
    visualLabel: "Live voice/video question timeline & feedback",
  },
  {
    id: "stage-5",
    number: "05",
    verb: "Learn",
    title: "Skill-Gap Learning Route",
    description: "Follow a clear transit map of targeted resources to close identified evidence gaps.",
    href: "/learning",
    visualLabel: "Targeted skill-gap curriculum & verification",
  },
  {
    id: "stage-6",
    number: "06",
    verb: "Discover",
    title: "Relevant Opportunities",
    description: "Uncover global role signals matched against your evolving career profile evidence.",
    href: "/jobs",
    visualLabel: "Radar job matching based on confirmed milestones",
  },
];

export function LandingSequence() {
  return (
    <section id="journey" className="sequence-section section" aria-label="Career Navigation Sequence">
      <div className="container">
        <div className="sequence-header">
          <p className="eyebrow mono">FROM SIGNAL TO DIRECTION</p>
          <h2 className="sequence-title">One connected career journey.</h2>
          <p className="sequence-subtitle">
            Every step builds upon verified evidence, from initial parsing to interview preparation and opportunity discovery.
          </p>
        </div>

        <div className="sequence-timeline">
          {/* Vertical Trajectory Line */}
          <div className="sequence-trajectory-line journey-progress-line" aria-hidden />

          <div className="sequence-checkpoints">
            {STAGES.map((stage, idx) => {
              const side = idx % 2 === 0 ? "left" : "right";
              return (
                <div
                  key={stage.id}
                  className={`sequence-checkpoint-row journey-stage-row ${side === "left" ? "align-left" : "align-right"}`}
                  data-side={side}
                  data-stage={stage.number}
                >
                  <div className="sequence-node journey-stage-node" aria-hidden>
                    <span className="sequence-node-dot" />
                  </div>

                  <div
                    className="sequence-card journey-stage-card"
                    data-journey-card
                    data-journey-stage={stage.number}
                  >
                    <div className="sequence-card-header">
                      <span className="sequence-number mono">{stage.number}</span>
                      <span className="sequence-verb-badge mono">{stage.verb}</span>
                    </div>

                    <h3 className="sequence-card-title">{stage.title}</h3>
                    <p className="sequence-card-desc">{stage.description}</p>

                    <div className="sequence-visual-chip mono">
                      <span className="chip-indicator" />
                      {stage.visualLabel}
                    </div>

                    <Link className="sequence-card-link journey-stage-link" href={stage.href}>
                      Open {stage.verb}
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
