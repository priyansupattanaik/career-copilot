"use client";

// BeamsBackground — used by the team page.
// Canvas light-beams in the brand palette (blue #526bff / #9eacff with rare
// lime #e7ff62 accents), theme-aware (paper in light, black in dark), sized to
// the viewport, and fully static under `prefers-reduced-motion` or when the
// page's motion pause is active.

import { useEffect, useRef } from "react";
import { motion } from "motion/react";

type BeamTheme = "light" | "dark";

export interface BeamsBackgroundProps {
  theme?: BeamTheme;
  paused?: boolean;
  intensity?: "subtle" | "medium" | "strong";
  className?: string;
  children?: React.ReactNode;
}

interface Beam {
  x: number;
  y: number;
  width: number;
  length: number;
  angle: number;
  speed: number;
  opacity: number;
  hue: number;
  saturation: number;
  lightness: number;
  pulse: number;
  pulseSpeed: number;
  gradient?: CanvasGradient;
}

function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

function pickHue(index: number): { hue: number; saturation: number; lightness: number } {
  // Every 8th beam is the lime accent; the rest live in the brand-blue band.
  if (index % 8 === 7) return { hue: 68, saturation: 95, lightness: 62 };
  const blueBand = [224, 230, 218, 234];
  return { hue: blueBand[index % blueBand.length], saturation: 88, lightness: 63 };
}

function createBeam(width: number, height: number, index: number): Beam {
  const tone = pickHue(index);
  return {
    x: Math.random() * width * 1.4 - width * 0.2,
    y: Math.random() * height * 1.4 - height * 0.2,
    width: 26 + Math.random() * 54,
    length: height * 1.15,
    angle: -35 + Math.random() * 10,
    speed: 0.35 + Math.random() * 0.8,
    opacity: 0.16 + Math.random() * 0.2,
    hue: tone.hue,
    saturation: tone.saturation,
    lightness: tone.lightness,
    pulse: Math.random() * Math.PI * 2,
    pulseSpeed: 0.015 + Math.random() * 0.025,
  };
}

const OPACITY_MAP = {
  subtle: 0.85,
  medium: 1,
  strong: 1,
} as const;

const THEME_DIM = { light: 0.85, dark: 1 } as const;

export function BeamsBackground({
  theme = "light",
  paused = false,
  intensity = "subtle",
  className,
  children,
}: BeamsBackgroundProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const beamsRef = useRef<Beam[]>([]);
  const frameRef = useRef<number>(0);
  const sizeRef = useRef({ w: 0, h: 0 });

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dim = THEME_DIM[theme] * OPACITY_MAP[intensity];
    const totalBeams = 16;

    // Paint a half-resolution viewport canvas and let the browser upscale it.
    // A full-device-pixel canvas plus a per-frame blur filter is what made
    // scrolling hitch. Softness comes from the upscale, not from ctx.filter.
    let paintedWidth = 0;
    let paintedHeight = 0;
    const resize = () => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      if (w === paintedWidth && h === paintedHeight && canvas.width > 0) return;
      paintedWidth = w;
      paintedHeight = h;
      const scale = 0.5;
      sizeRef.current = { w, h };
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      beamsRef.current = Array.from({ length: totalBeams }, (_, i) =>
        createBeam(w, h, i),
      );
    };

    function resetBeam(beam: Beam, index: number) {
      const { w, h } = sizeRef.current;
      const column = index % 3;
      const spacing = w / 3;
      beam.y = h + 120;
      beam.x = column * spacing + spacing / 2 + (Math.random() - 0.5) * spacing * 0.5;
      beam.width = 90 + Math.random() * 90;
      beam.speed = 0.3 + Math.random() * 0.35;
      const tone = pickHue(index);
      beam.hue = tone.hue;
      beam.saturation = tone.saturation;
      beam.lightness = tone.lightness;
      beam.opacity = 0.12 + Math.random() * 0.1;
      beam.gradient = undefined;
    }

    function draw(beam: Beam) {
      ctx!.save();
      ctx!.translate(beam.x, beam.y);
      ctx!.rotate((beam.angle * Math.PI) / 180);
      const pulsing = beam.opacity * (0.8 + Math.sin(beam.pulse) * 0.2) * dim;
      if (!beam.gradient) {
        const gradient = ctx!.createLinearGradient(0, 0, 0, beam.length);
        const hsla = (alpha: number) =>
          `hsla(${beam.hue}, ${beam.saturation}%, ${beam.lightness}%, ${alpha})`;
        gradient.addColorStop(0, hsla(0));
        gradient.addColorStop(0.15, hsla(0.55));
        gradient.addColorStop(0.5, hsla(1));
        gradient.addColorStop(0.85, hsla(0.55));
        gradient.addColorStop(1, hsla(0));
        beam.gradient = gradient;
      }
      ctx!.fillStyle = beam.gradient;
      ctx!.globalAlpha = pulsing;
      ctx!.fillRect(-beam.width / 2, 0, beam.width, beam.length);
      ctx!.restore();
    }

    function frame() {
      const { w, h } = sizeRef.current;
      ctx!.clearRect(0, 0, w, h);
      const beams = beamsRef.current;
      for (let index = 0; index < beams.length; index += 1) {
        const beam = beams[index];
        beam.y -= beam.speed;
        beam.pulse += beam.pulseSpeed;
        if (beam.y + beam.length < -120) resetBeam(beam, index);
        draw(beam);
      }
    }

    function loop() {
      if (document.hidden) {
        frameRef.current = 0;
        return;
      }
      frame();
      frameRef.current = requestAnimationFrame(loop);
    }

    resize();
    if (reducedMotion || paused) {
      frame();
    } else {
      loop();
    }

    const onResize = () => {
      resize();
      if (reducedMotion || paused) frame();
    };
    window.addEventListener("resize", onResize);

    const onVisibility = () => {
      if (reducedMotion || paused) return;
      if (document.hidden) {
        if (frameRef.current) cancelAnimationFrame(frameRef.current);
        frameRef.current = 0;
        return;
      }
      if (!frameRef.current) loop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [theme, paused, intensity]);

  const veil = theme === "dark" ? "rgb(0 0 0 / 6%)" : "rgb(255 255 255 / 10%)";

  return (
    <div ref={wrapperRef} className={cn("home-beams-root", className)} aria-hidden>
      <canvas
        ref={canvasRef}
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100dvh",
          pointerEvents: "none",
        }}
      />
      <motion.div
        aria-hidden
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: veil,
          pointerEvents: "none",
        }}
        animate={{ opacity: paused ? 0.6 : [0.35, 0.7, 0.35] }}
        transition={{ duration: 10, ease: "easeInOut", repeat: Number.POSITIVE_INFINITY }}
      />
      {children}
    </div>
  );
}
