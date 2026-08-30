import { ArrowRight, Check, Play } from "lucide-react";
import {
  motion,
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
import { CareerIcon } from "@/components/ui/career-icons";
import { BrandMark } from "@/components/ui/brand-mark";
import { Navigation5 } from "@/components/ui/navigation-5";
import { BeamsBackground } from "@/components/ui/beams-background";
import { ParticlesBackground } from "@/components/ui/particles-background";
import { RuixenGradientFooter } from "@/components/ui/ruixen-gradient-footer";
import { AnimatedIcon } from "@/components/ui/animated-icon";
import { MotionProvider, useMotion } from "../motion-context";
import { useReveal } from "../use-reveal";
import { useTheme } from "@/shared/theme";
import { ButtonLink } from "@/shared/ui/primitives";
import { Link } from "@/shared/ui/router-link";
import { prefetchRoute, warmUpBackend } from "@/shared/route-prefetch";

const features = [
  {
    icon: "resume" as const,
    label: "Resume evidence",
    title: "Know what your experience already proves.",
    text: "Turn projects, wins, and skills into a clear story you can carry into every application.",
  },
  {
    icon: "learning" as const,
    label: "Focused preparation",
    title: "Close the gap with a plan you can follow.",
    text: "See the next skill, example, or practice session that makes your target role more reachable.",
  },
  {
    icon: "opportunities" as const,
    label: "Role fit",
    title: "Choose opportunities with context.",
    text: "Connect your profile to roles that make sense for your evidence, goals, and work style.",
  },
];

function useCountUp(target: number, active: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const duration = 900;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [active, target]);
  return value;
}

function usePracticeClock(paused: boolean) {
  const [seconds, setSeconds] = useState(4 * 60 + 18);
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setSeconds((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [paused]);
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}

function Reveal({
  as: Tag,
  delay = 0,
  y = 22,
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
      <p className="home-kicker">A calmer way to get ready</p>
      <h1 id="home-hero-title">
        Show up
        <br />
        <span>ready.</span>
      </h1>
      <p className="home-hero-lede">
        Career Copilot helps you understand your experience, practise the
        interview on video, and take your next step with confidence.
      </p>
      <div className="home-actions">
        <span
          onMouseEnter={() => prefetchRoute("/sign-up")}
          onFocus={() => prefetchRoute("/sign-up")}
        >
          <ButtonLink href="/sign-up" className="home-primary-cta">
            Get started
          </ButtonLink>
        </span>
        <a href="#practice" className="home-text-cta">
          <AnimatedIcon icon={Play} size={14} fill="currentColor" aria-hidden />{" "}
          See the practice room
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
        Confidence is
        <br />
        <span>a practice habit.</span>
      </h2>
      <p>
        Answer realistic questions on camera before the real conversation.
        Review the moments that matter and come back with a better answer.
      </p>
      <div className="home-check-list">
        <span>
          <AnimatedIcon icon={Check} size={15} aria-hidden /> Camera and
          microphone readiness
        </span>
        <span>
          <AnimatedIcon icon={Check} size={15} aria-hidden /> Clear feedback
          after every answer
        </span>
        <span>
          <AnimatedIcon icon={Check} size={15} aria-hidden /> Evidence, pace,
          and clarity signals
        </span>
      </div>
      <Link href="/mock-interview/preparation" className="home-inline-link">
        Start a video practice session{" "}
        <AnimatedIcon icon={ArrowRight} size={15} aria-hidden />
      </Link>
    </div>
  );
}

function PracticeCard() {
  const [live, setLive] = useState(false);
  const ref = useReveal<HTMLDivElement>({
    delay: 120,
    y: 28,
    onReveal: () => setLive(true),
  });
  const sessions = useCountUp(3, live);
  return (
    <div ref={ref} className="home-practice-card">
      <div className="home-practice-card-top">
        <span>illustrative practice history</span>
        <b>sample week</b>
      </div>
      <div className="home-practice-stat">
        <strong>{sessions}</strong>
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
        <CareerIcon name="confidence" size={19} />
        <span>
          <b>Confidence</b>
          <small>steadier than last session</small>
        </span>
        <strong>+18%</strong>
      </div>
      <div className="home-practice-row">
        <CareerIcon name="signal" size={19} />
        <span>
          <b>Clarity</b>
          <small>strong opening, sharper close</small>
        </span>
        <strong>+11%</strong>
      </div>
    </div>
  );
}

function SystemSteps() {
  const ref = useReveal<HTMLDivElement>({ delay: 80, y: 24 });
  return (
    <div ref={ref} className="home-steps">
      {features.map((feature) => (
        <article className="home-step" key={feature.label}>
          <div className="home-step-icon">
            <CareerIcon name={feature.icon} size={22} />
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
        Your progress,
        <br />
        <span>in one place.</span>
      </h2>
      <p>
        Keep the resume you are shaping, the answers you are practising, the
        skills you are learning, and the roles you are considering connected.
      </p>
      <Link href="/resume-analysis?tab=upload" className="home-inline-link">
        Bring in my resume{" "}
        <AnimatedIcon icon={ArrowRight} size={15} aria-hidden />
      </Link>
    </div>
  );
}

function ProfileSheet() {
  const ref = useReveal<HTMLDivElement>({ delay: 140, y: 28 });
  return (
    <div ref={ref} className="home-profile-sheet">
      <div className="home-sheet-head">
        <span>illustrative profile preview</span>
        <b>sample data</b>
      </div>
      <div className="home-sheet-main">
        <div className="home-avatar">YP</div>
        <div>
          <h3>Your profile</h3>
          <p>Backend engineer, Bengaluru</p>
        </div>
        <span className="home-sheet-status">78% ready</span>
      </div>
      <div className="home-sheet-items">
        <span>
          <CareerIcon name="resume" size={17} />
          <b>Resume evidence</b>
          <small>12 confirmed signals</small>
          <i>ready</i>
        </span>
        <span>
          <CareerIcon name="interview" size={17} />
          <b>Video practice</b>
          <small>3 sessions this week</small>
          <i>growing</i>
        </span>
        <span>
          <CareerIcon name="learning" size={17} />
          <b>Next skill route</b>
          <small>Make system design visible</small>
          <i>next</i>
        </span>
      </div>
    </div>
  );
}

function FinalCard() {
  const ref = useReveal<HTMLDivElement>({ delay: 60, y: 30 });
  return (
    <div ref={ref} className="home-frame home-final-card">
      <p className="home-kicker">The next interview is a little less unknown</p>
      <h2>
        Start with
        <br />
        one good answer.
      </h2>
      <p>
        Build a profile that helps you see what you bring, what to practise, and
        where to go next.
      </p>
      <span
        onMouseEnter={() => prefetchRoute("/sign-up")}
        onFocus={() => prefetchRoute("/sign-up")}
      >
        <ButtonLink href="/sign-up" className="home-primary-cta">
          Get started
        </ButtonLink>
      </span>
    </div>
  );
}

function LandingInner() {
  const { isMotionPaused } = useMotion();
  const { resolvedTheme } = useTheme();

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
      <BeamsBackground
        theme={resolvedTheme}
        paused={isMotionPaused}
        intensity="subtle"
        className="home-beams"
      />
      <ParticlesBackground
        theme={resolvedTheme}
        paused={isMotionPaused}
        className="home-particles-layer"
      />
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
                From “I’m not sure”
                <br />
                <span>to “I know my next move.”</span>
              </h2>
              <p>
                Every part of Career Copilot points back to one question: what
                would make you more ready for the role you want?
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

      <RuixenGradientFooter gradientHeight="44vh" className="home-footer">
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
            <span className="home-footer-tagline">
              Private career preparation
            </span>
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
            <span className="home-status">
              <i className="home-status-dot" aria-hidden /> Evidence-first ·
              scores from confirmed work only
            </span>
            <span>Built for candidates</span>
          </div>
        </div>
      </RuixenGradientFooter>
    </div>
  );
}

// Interview demo questions — varied, never the same two in a row
const INTERVIEW_QUESTIONS = [
  { q: "Tell me about a time you led a project under a tight deadline.", topic: "Behavioural", duration: 7500 },
  { q: "How do you prioritise when everything feels urgent?", topic: "Situational", duration: 7000 },
  { q: "Walk me through a technical decision you'd make differently today.", topic: "Technical", duration: 8000 },
  { q: "Describe a moment you received difficult feedback. What did you do?", topic: "Behavioural", duration: 7500 },
  { q: "What does good collaboration look like to you?", topic: "Culture", duration: 6500 },
  { q: "How do you keep up with fast-changing tools in your field?", topic: "Growth", duration: 7000 },
];

function buildSequence(len: number): number[] {
  const arr = Array.from({ length: len }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

type InterviewPhase = "question" | "answering";

function useInterviewDemo(paused: boolean) {
  const seqRef = useRef<number[]>(buildSequence(INTERVIEW_QUESTIONS.length));
  const posRef = useRef(0);

  const getNext = () => {
    if (posRef.current >= seqRef.current.length) {
      const last = seqRef.current[seqRef.current.length - 1];
      const next = buildSequence(INTERVIEW_QUESTIONS.length);
      if (next[0] === last && next.length > 1) {
        [next[0], next[next.length - 1]] = [next[next.length - 1], next[0]];
      }
      seqRef.current = next;
      posRef.current = 0;
    }
    return seqRef.current[posRef.current++];
  };

  const [idx, setIdx] = useState(() => {
    posRef.current = 1;
    return seqRef.current[0];
  });
  const [phase, setPhase] = useState<InterviewPhase>("question");
  const [fading, setFading] = useState(false);

  useEffect(() => {
    if (paused) return;
    const QUESTION_SHOW = 2800;
    let tid: ReturnType<typeof setTimeout>;

    if (phase === "question") {
      tid = setTimeout(() => setPhase("answering"), QUESTION_SHOW);
    } else {
      const answerDuration = INTERVIEW_QUESTIONS[idx].duration;
      tid = setTimeout(() => {
        setFading(true);
        setTimeout(() => {
          setIdx(getNext());
          setPhase("question");
          setFading(false);
        }, 480);
      }, answerDuration);
    }
    return () => clearTimeout(tid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, idx, paused]);

  return { question: INTERVIEW_QUESTIONS[idx], phase, fading };
}

function PracticeClock() {
  const { isMotionPaused } = useMotion();
  const reduce = useReducedMotion();
  const clock = usePracticeClock(isMotionPaused || Boolean(reduce));
  return <span>{clock}</span>;
}

function InterviewStage({
  paused,
  blockVideoInteraction,
}: {
  paused: boolean;
  blockVideoInteraction: (e: SyntheticEvent) => void;
}) {
  const { question, phase, fading } = useInterviewDemo(paused);

  return (
    <div
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
        <i /> live practice
      </div>

      {/* Question card — fades in on question phase */}
      <div
        className={`home-demo-question${phase === "question" && !fading ? " home-demo-question--visible" : ""}${fading ? " home-demo-question--out" : ""}`}
        aria-live="polite"
      >
        <span className="home-demo-topic">{question.topic}</span>
        <p>{question.q}</p>
      </div>

      {/* Answering overlay — shown during answer phase */}
      <div
        className={`home-demo-answer${phase === "answering" && !fading ? " home-demo-answer--visible" : ""}${fading ? " home-demo-answer--out" : ""}`}
      >
        <span className="home-demo-answering-label">
          <i /> Answering
        </span>
        <div className="home-demo-waveform" aria-hidden>
          {Array.from({ length: 14 }, (_, k) => <i key={k} />)}
        </div>
      </div>
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
    reduce || isMotionPaused ? [0, 0] : [18, -36],
  );
  const blockVideoInteraction = (event: SyntheticEvent) =>
    event.preventDefault();

  return (
    <div
      ref={wrapRef}
      className="home-hero-visual"
      role="img"
      aria-label="Video interview practice workspace preview"
    >
      <motion.div className="home-hero-visual-shift" style={{ y }}>
        <div className="home-window">
          <div className="home-window-top">
            <span className="home-window-dots">
              <i />
              <i />
              <i />
            </span>
            <span>practice room</span>
            <PracticeClock />
          </div>
          <InterviewStage
            paused={isMotionPaused || Boolean(reduce)}
            blockVideoInteraction={blockVideoInteraction}
          />
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
