import { useEffect, useRef } from "react";

type ParticleTheme = "light" | "dark";

interface Particle {
  x: number;
  y: number;
  size: number;
  alpha: number;
  targetAlpha: number;
  dx: number;
  dy: number;
  magnetism: number;
  translateX: number;
  translateY: number;
}

export interface ParticlesBackgroundProps {
  theme?: ParticleTheme;
  paused?: boolean;
  quantity?: number;
  className?: string;
}

const PARTICLE_COLOR: Record<ParticleTheme, string> = {
  light: "37, 61, 190",
  dark: "158, 172, 255",
};

export function ParticlesBackground({
  theme = "light",
  paused = false,
  quantity = 520,
  className = "",
}: ParticlesBackgroundProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    const context = canvas.getContext("2d");
    if (!context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const color = PARTICLE_COLOR[theme];

    const createParticle = (): Particle => {
      const { width, height } = sizeRef.current;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        size: Math.random() * 2.2 + 1.5,
        alpha: 0,
        targetAlpha: Math.random() * 0.22 + 0.78,
        dx: (Math.random() - 0.5) * 0.08,
        dy: (Math.random() - 0.5) * 0.08,
        magnetism: Math.random() * 3.9 + 0.1,
        translateX: 0,
        translateY: 0,
      };
    };

    const resize = () => {
      const rect = wrapper.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeRef.current = { width: Math.max(1, rect.width), height: Math.max(1, rect.height), dpr };
      canvas.width = Math.round(sizeRef.current.width * dpr);
      canvas.height = Math.round(sizeRef.current.height * dpr);
      canvas.style.width = `${sizeRef.current.width}px`;
      canvas.style.height = `${sizeRef.current.height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      particlesRef.current = Array.from({ length: quantity }, createParticle);
    };

    const draw = (animate: boolean) => {
      const { width, height } = sizeRef.current;
      context.clearRect(0, 0, width, height);
      particlesRef.current.forEach((particle) => {
        const edgeDistance = Math.min(
          particle.x + particle.translateX,
          width - particle.x - particle.translateX,
          particle.y + particle.translateY,
          height - particle.y - particle.translateY,
        );
        const edgeFade = Math.max(0, Math.min(1, edgeDistance / 26));
        if (animate) particle.alpha += (particle.targetAlpha * edgeFade - particle.alpha) * 0.04;
        else particle.alpha = particle.targetAlpha * edgeFade;

        context.beginPath();
        context.arc(particle.x + particle.translateX, particle.y + particle.translateY, particle.size, 0, Math.PI * 2);
        context.shadowBlur = 10;
        context.shadowColor = `rgba(${color}, ${Math.min(0.9, particle.alpha + 0.2)})`;
        context.fillStyle = `rgba(${color}, ${particle.alpha})`;
        context.fill();
        context.shadowBlur = 0;

        if (!animate) return;
        particle.x += particle.dx;
        particle.y += particle.dy;
        particle.translateX += (mouseRef.current.x / (50 / particle.magnetism) - particle.translateX) / 50;
        particle.translateY += (mouseRef.current.y / (50 / particle.magnetism) - particle.translateY) / 50;
        if (particle.x < -particle.size) particle.x = width + particle.size;
        if (particle.x > width + particle.size) particle.x = -particle.size;
        if (particle.y < -particle.size) particle.y = height + particle.size;
        if (particle.y > height + particle.size) particle.y = -particle.size;
      });
    };

    const animate = () => {
      draw(true);
      frameRef.current = window.requestAnimationFrame(animate);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = {
        x: event.clientX - rect.left - sizeRef.current.width / 2,
        y: event.clientY - rect.top - sizeRef.current.height / 2,
      };
    };

    resize();
    if (reducedMotion || paused) draw(false);
    else animate();
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    const observer = new ResizeObserver(resize);
    observer.observe(wrapper);

    return () => {
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [paused, quantity, theme]);

  return (
    <div ref={wrapperRef} className={`home-particles ${className}`} data-particle-theme={theme} aria-hidden="true">
      <canvas ref={canvasRef} />
    </div>
  );
}
