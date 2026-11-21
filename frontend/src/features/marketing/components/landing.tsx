import { CopilotIcon } from "@/components/ui/copilot-icons";
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
} from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SyntheticEvent,
} from "react";

import { BrandMark } from "@/components/ui/brand-mark";
import { Navigation5 } from "@/components/ui/navigation-5";
import { DotPattern } from "@/components/landing/DotPattern";
import { AuroraBackground } from "@/components/landing/AuroraBackground";
import { CursorGlow } from "@/components/landing/CursorGlow";
import { MagneticButton } from "@/components/landing/MagneticButton";
import { CountUp } from "@/components/landing/CountUp";
import { usePracticeClock } from "@/components/landing/usePracticeClock";
import { RuixenGradientFooter } from "@/components/ui/ruixen-gradient-footer";

import { MotionProvider, useMotion } from "../motion-context";
import { useReveal } from "../use-reveal";
import { ButtonLink } from "@/shared/ui/primitives";
import { Link } from "@/shared/ui/router-link";
import { prefetchRoute, warmUpBackend } from "@/shared/route-prefetch";

const features = [
  {
    icon: "resume" as const,
    label: "Resume",
    title: "Compare your resume with a job.",
    text: "See which words from the job description appear in the resume you upload.",
  },
  {
    icon: "learning" as const,
    label: "Practice",
    title: "Practice the questions.",
    text: "Study the missing words from that comparison, then answer practice questions.",
  },
  {
    icon: "jobs" as const,
    label: "Jobs",
    title: "Save roles.",
    text: "Keep a list of jobs and mark which ones you applied to.",
  },
];

function Reveal({
  as: Tag,
  delay = 0,
  y = 8,
  className,
  children,
}: {
  as: "div" | "article" | "section";
  delay?: number;
  y?: number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useReveal<HTMLDivElement>({ delay, y });
  return (
    <Tag ref={ref as never} className={className}>
      {children}
    </Tag>
  );
}

function HeroCopy() {
  return (
    <div className="home-hero-copy">
      <h1 id="home-hero-title">
        Check your resume.
        <br />
        <span>Practice the interview.</span>
      </h1>
      <p className="home-hero-lede">
        Upload a resume, compare it with a job, and practice answers on video.
      </p>
      <div className="home-actions">
        <span
          onMouseEnter={() => prefetchRoute("/sign-up")}
          onFocus={() => prefetchRoute("/sign-up")}
        >
          <MagneticButton>
            <ButtonLink href="/sign-up" className="home-primary-cta">Get started</ButtonLink>
          </MagneticButton>
        </span>
        <a href="#practice" className="home-text-cta">
          <CopilotIcon name="play" size={14} />{" "}
          See an example
        </a>
      </div>
    </div>
  );
}

function PracticeCopy() {
  const ref = useReveal<HTMLDivElement>({ delay: 0 });
  return (
    <div ref={ref} className="home-practice-copy">
      <h2 id="practice-title">
        Practice
        <br />
        <span>on camera.</span>
      </h2>
      <p>
        Answer questions before the real interview. You can review the session afterward.
      </p>
      <div className="home-check-list">
        <span>
          <CopilotIcon name="check" size={15} /> Camera and
          microphone check
        </span>
        <span>
          <CopilotIcon name="check" size={15} /> Notes after
          each answer
        </span>
        <span>
          <CopilotIcon name="check" size={15} /> A score for
          the session
        </span>
      </div>
      <Link href="/mock-interview/preparation" className="home-inline-link">
        Start a practice interview{" "}
        <CopilotIcon name="go" size={15} />
      </Link>
    </div>
  );
}

function PracticeCard() {
  const ref = useReveal<HTMLDivElement>({
    delay: 80,
    y: 8,
  });
  return (
    <div ref={ref} className="home-practice-card">
      <div className="home-practice-card-top">
        <span>Example</span>
        <b>Not your data</b>
      </div>
      <div className="home-practice-stat">
        <strong><CountUp end={3} /></strong>
        <span>
          sessions
          <br />
          completed
        </span>
        <div className="home-bars">
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
          <i />
        </div>
      </div>
      <div className="home-practice-divider" />
      <div className="home-practice-row">
        <CopilotIcon name="confidence" size={19} />
        <span>
          <b>Camera</b>
          <small>checked before you start</small>
        </span>
        <strong>On</strong>
      </div>
      <div className="home-practice-row">
        <CopilotIcon name="skills" size={19} />
        <span>
          <b>Review</b>
          <small>saved with the session</small>
        </span>
        <strong>Yes</strong>
      </div>
    </div>
  );
}

function SystemSteps() {
  const ref = useReveal<HTMLDivElement>({ delay: 60, y: 8 });
  return (
    <div ref={ref} className="home-steps">
      {features.map((feature) => (
        <article className="home-step" key={feature.label}>
          <div className="home-step-icon">
            <CopilotIcon name={feature.icon} size={22} />
          </div>
          <div className="home-step-copy">
            <h3>{feature.title}</h3>
            <p>{feature.text}</p>
          </div>
        </article>
      ))}
    </div>
  );
}

function ProfileIntro() {
  const ref = useReveal<HTMLDivElement>({ delay: 0 });
  return (
    <div ref={ref}>
      <h2 id="profile-title">
        Resume, practice,
        <br />
        <span>and jobs.</span>
      </h2>
      <p>
        The resume you upload is reused for job matches and practice questions.
      </p>
      <Link href="/resume-analysis?tab=upload" className="home-inline-link">
        Upload a resume{" "}
        <CopilotIcon name="go" size={15} />
      </Link>
    </div>
  );
}

function ProfileSheet() {
  const ref = useReveal<HTMLDivElement>({ delay: 80, y: 8 });
  return (
    <div ref={ref} className="home-profile-sheet">
      <div className="home-sheet-head">
        <span>Example</span>
        <b>Not your account</b>
      </div>
      <div className="home-sheet-main">
        <div className="home-avatar">YP</div>
        <div>
          <h3>Sample profile</h3>
          <p>Example only</p>
        </div>
        <span className="home-sheet-status">Sample</span>
      </div>
      <div className="home-sheet-items">
        <span>
          <CopilotIcon name="resume" size={17} />
          <span className="home-sheet-copy">
            <b>Resume</b>
            <small>One file uploaded</small>
          </span>
          <i>saved</i>
        </span>
        <span>
          <CopilotIcon name="interview" size={17} />
          <span className="home-sheet-copy">
            <b>Practice</b>
            <small>3 example sessions</small>
          </span>
          <i>sample</i>
        </span>
        <span>
          <CopilotIcon name="learning" size={17} />
          <span className="home-sheet-copy">
            <b>Saved jobs</b>
            <small>1 example role</small>
          </span>
          <i>sample</i>
        </span>
      </div>
    </div>
  );
}

function FinalCard() {
  const ref = useReveal<HTMLDivElement>({ delay: 40, y: 8 });
  return (
    <div ref={ref} className="home-frame home-final-card">
      <p className="home-kicker">Create an account</p>
      <h2>
        Upload a resume
        <br />
        to begin.
      </h2>
      <p>
        You can compare it with a job and start a practice interview.
      </p>
      <span
        onMouseEnter={() => prefetchRoute("/sign-up")}
        onFocus={() => prefetchRoute("/sign-up")}
      >
        <MagneticButton>
          <ButtonLink href="/sign-up" className="home-primary-cta">Get started</ButtonLink>
        </MagneticButton>
      </span>
    </div>
  );
}

function HomeDotField() {
  return <div className="home-dot-field" aria-hidden="true"><DotPattern /></div>;
}

function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  return <motion.div className="landing-scroll-progress" style={{ scaleX: scrollYProgress }} aria-hidden="true" />;
}

function LandingInner() {
  const { isMotionPaused } = useMotion();

  useEffect(() => {
    warmUpBackend();
    prefetchRoute("/sign-in");
    prefetchRoute("/sign-up");
    prefetchRoute("/teams");
  }, []);

  return (
    <div
      className="home-page"
      data-motion={isMotionPaused ? "paused" : "running"}
    >
      <HomeDotField />
      <CursorGlow />
      <ScrollProgress />
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>
      <Navigation5 />

      <main id="main-content">
        <section className="home-hero" aria-labelledby="home-hero-title">
          <div className="home-frame home-hero-grid">
            <HeroCopy />
            <HeroVisual />
          </div>
        </section>

        <section
          id="practice"
          tabIndex={-1}
          className="home-practice"
          aria-labelledby="practice-title"
        >
          <AuroraBackground />
          <div className="home-frame home-practice-grid">
            <PracticeCopy />
            <PracticeCard />
          </div>
        </section>

        <section
          id="system"
          tabIndex={-1}
          className="home-system"
          aria-labelledby="system-title"
        >
          <div className="home-frame">
            <Reveal as="div" className="home-system-copy" delay={0}>
              <h2 id="system-title">
                Three things
                <br />
                <span>you can do.</span>
              </h2>
              <p>
                Compare a resume with a job, practice an interview, and save roles.
              </p>
            </Reveal>
            <SystemSteps />
          </div>
        </section>

        <section className="home-profile" aria-labelledby="profile-title">
          <div className="home-frame home-profile-grid">
            <ProfileIntro />
            <ProfileSheet />
          </div>
        </section>

        <section className="home-final">
          <FinalCard />
        </section>
      </main>

      <RuixenGradientFooter gradientHeight="56px" className="home-footer">
        <div className="home-frame home-footer-content">
          <div className="home-footer-top">
            <Link
              href="/"
              className="home-brand"
              aria-label="Career Copilot home"
            >
              <BrandMark compact />
              <span>Career Copilot</span>
            </Link>
            <nav className="home-footer-nav" aria-label="Footer navigation">
              <Link href="/sign-in">Sign in</Link>
              <Link href="/sign-up">Get started</Link>
              <Link href="/teams">Team</Link>
              <a href="#practice">Video practice</a>
              <a href="#system">How it works</a>
            </nav>
          </div>
          <div className="home-footer-meta">
            <span>© 2026 Career Copilot</span>
            <span>Built for candidates</span>
          </div>
        </div>
      </RuixenGradientFooter>
    </div>
  );
}

// Interview demo — questions with pre-written answers for the typewriter
const TYPING_SPEED = 32; // ms per character

const INTERVIEW_QUESTIONS = [
  {
    topic: "Behavioural",
    q: "Tell me about a time you led a project under a tight deadline.",
    a: "I broke the work into daily milestones, flagged the risk on day two, and shipped on time by cutting one non-essential feature.",
  },
  {
    topic: "Delivery",
    q: "Tell me about a project you shipped.",
    a: "We reduced onboarding drop-off by rebuilding the first-run flow around one clear action, measured with a before/after funnel.",
  },
  {
    topic: "Prioritisation",
    q: "How do you decide what to do first?",
    a: "I rank by impact and reversibility — high-impact, hard-to-reverse decisions get the most scrutiny first.",
  },
  {
    topic: "Reflection",
    q: "What would you change about a past technical choice?",
    a: "I would add tests earlier. The rewrite was right, but we paid for missing coverage in the first month.",
  },
];

// Typewriter hook — resets and starts when `active` flips to true
function useTyping(text: string, active: boolean) {
  const [count, setCount] = useState(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setCount(0);
    if (!active) return;

    // Small initial delay so the panel is fully visible before text starts
    const startId = setTimeout(() => {
      const typeNext = () => {
        setCount((current) => {
          if (current >= text.length) return current;
          timeoutRef.current = setTimeout(typeNext, TYPING_SPEED + Math.round(Math.random() * 16 - 8));
          return current + 1;
        });
      };
      typeNext();
    }, 280);

    return () => {
      clearTimeout(startId);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [text, active]);

  return {
    typed: text.slice(0, count),
    done: count >= text.length,
  };
}

type InterviewPhase = "question" | "answering" | "transitioning";

function useInterviewDemo(paused: boolean, active: boolean) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<InterviewPhase>("question");

  useEffect(() => {
    clearTimer();
    if (paused || !active) return clearTimer;
    const q = INTERVIEW_QUESTIONS[idx];

    if (phase === "question") {
      timerRef.current = setTimeout(() => setPhase("answering"), 3000);
    } else if (phase === "answering") {
      // Duration = time to type the full answer + 1.2s pause at end
      const typeDuration = 280 + q.a.length * TYPING_SPEED + 800;
      timerRef.current = setTimeout(
        () => setPhase("transitioning"),
        typeDuration,
      );
    } else {
      // Fade-out transition, then load next question
      timerRef.current = setTimeout(() => {
        setIdx((current) => (current + 1) % INTERVIEW_QUESTIONS.length);
        setPhase("question");
      }, 520);
    }

    return clearTimer;
  }, [active, idx, paused, phase]);

  return { question: INTERVIEW_QUESTIONS[idx], phase };
}

function PracticeClock() {
  const { isMotionPaused } = useMotion();
  const reduce = useReducedMotion();
  const clock = usePracticeClock(isMotionPaused || Boolean(reduce));
  return <span>{clock}</span>;
}

function InterviewStage({
  blockVideoInteraction,
}: {
  blockVideoInteraction: (e: SyntheticEvent) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const inView = useInView(stageRef, { margin: "-100px", once: false });
  const [paused, setPaused] = useState(false);
  const { question, phase } = useInterviewDemo(paused, inView);
  const isTransitioning = phase === "transitioning";
  const isAnswering = phase === "answering";

  const { typed, done } = useTyping(question.a, isAnswering);

  return (
    <div
      ref={stageRef}
      className="home-window-stage"
      onClick={blockVideoInteraction}
      onContextMenu={blockVideoInteraction}
      onDragStart={blockVideoInteraction}
    >
      <video
        className="home-camera-video"
        src="/media/interview-practice.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        controlsList="nodownload noplaybackrate"
        disablePictureInPicture
        draggable={false}
        tabIndex={-1}
        onClick={blockVideoInteraction}
        onContextMenu={blockVideoInteraction}
        onDragStart={blockVideoInteraction}
        aria-label="Candidate giving an interview"
      />

      {/* Live pill */}
      <div className="home-live-label">
        <i /> Example
      </div>

      {/* Question card — shown while question is being read */}
      <div
        className={[
          "home-demo-question",
          phase === "question" && !isTransitioning
            ? "home-demo-question--visible"
            : "",
          isTransitioning ? "home-demo-question--out" : "",
        ]
          .join(" ")
          .trim()}
      >
        <span className="home-demo-topic">{question.topic}</span>
        <p>{question.q}</p>
      </div>

      {/* Answer panel — slides up during answering phase */}
      <div
        aria-live="polite"
        className={[
          "home-demo-answer",
          isAnswering && !isTransitioning ? "home-demo-answer--visible" : "",
          isTransitioning ? "home-demo-answer--out" : "",
        ]
          .join(" ")
          .trim()}
      >
        {/* Question context (small, muted) */}
        <p className="home-demo-answer-q">{question.q}</p>

        {/* Typed answer */}
        <p className="home-demo-answer-text">
          {typed}
          {!done && <span className="home-demo-cursor" />}
        </p>

        {/* Status bar */}
        <div className="home-demo-status">
          <span className="home-demo-answering-label">
            <i /> Answering
          </span>
          <div className="home-demo-waveform" aria-hidden>
            {Array.from({ length: 12 }, (_, k) => (
              <i key={k} />
            ))}
          </div>
        </div>
      </div>

      <button
        type="button"
        className="home-demo-toggle"
        aria-label={paused ? "Play demo" : "Pause demo"}
        onClick={() => setPaused((current) => !current)}
      >
        {paused ? "▶" : "Ⅱ"}
      </button>
    </div>
  );
}

function HeroVisual() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { isMotionPaused } = useMotion();
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: wrapRef,
    offset: ["start end", "end start"],
  });
  const y = useTransform(
    scrollYProgress,
    [0, 1],
    reduce || isMotionPaused ? [0, 0] : [18, -60],
  );
  const blockVideoInteraction = (event: SyntheticEvent) =>
    event.preventDefault();

  return (
    <div
      ref={wrapRef}
      className="home-hero-visual"
      role="img"
      aria-label="Example of a practice interview"
    >
      <motion.div className="home-hero-visual-shift" style={{ y }}>
        <div className="home-window">
          <div className="home-window-top">
            <span className="home-window-dots">
              <i />
              <i />
              <i />
            </span>
            <span>Practice</span>
            <PracticeClock />
          </div>
          <InterviewStage blockVideoInteraction={blockVideoInteraction} />
        </div>
      </motion.div>
    </div>
  );
}

export function LandingPage() {
  return (
    <MotionProvider>
      <LandingInner />
    </MotionProvider>
  );
}
