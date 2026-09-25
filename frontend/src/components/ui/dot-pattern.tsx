"use client";

import { useEffect, useRef } from "react";

import { cn } from "@/shared/utils";

/**
 * Glowing dot field with the same look as Magic UI's DotPattern glow demo.
 * Drawn on one canvas. The registry version mounts a Motion circle per dot,
 * which stalls the main thread once the field covers a viewport.
 */
interface DotPatternProps extends Omit<
  React.SVGProps<SVGSVGElement>,
  "width" | "height" | "x" | "y"
> {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  cx?: number;
  cy?: number;
  cr?: number;
  className?: string;
  glow?: boolean;
}

type Dot = {
  x: number;
  y: number;
  phase: number;
  speed: number;
};

export function DotPattern({
  width = 16,
  height = 16,
  x = 0,
  y = 0,
  cx = 1,
  cy = 1,
  cr = 1,
  className,
  glow = false,
}: DotPatternProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const dots: Dot[] = [];
    let raf = 0;
    let alive = true;
    let cssWidth = 1;
    let cssHeight = 1;
    let color = getComputedStyle(canvas).color;

    const layout = () => {
      const rect = parent.getBoundingClientRect();
      cssWidth = Math.max(1, Math.round(rect.width));
      cssHeight = Math.max(1, Math.round(rect.height));
      const nextWidth = cssWidth;
      const nextHeight = cssHeight;
      if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
        canvas.width = nextWidth;
        canvas.height = nextHeight;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);

      const budget = cssWidth < 720 ? 320 : cssWidth < 1400 ? 480 : 560;
      const spacing = Math.max(
        width,
        height,
        Math.ceil(Math.sqrt((cssWidth * cssHeight) / budget)),
      );
      const cols = Math.max(1, Math.ceil(cssWidth / spacing));
      const rows = Math.max(1, Math.ceil(cssHeight / spacing));
      color = getComputedStyle(canvas).color;
      dots.length = 0;
      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          dots.push({
            x: col * spacing + cx + x,
            y: row * spacing + cy + y,
            phase: Math.random() * Math.PI * 2,
            speed: 0.7 + Math.random() * 1.15,
          });
        }
      }
    };

    const reduced = () =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const draw = (now: number) => {
      ctx.clearRect(0, 0, cssWidth, cssHeight);
      ctx.fillStyle = color;
      const moving = glow && !document.hidden && !reduced();
      const time = now / 1000;
      // Five shared paths instead of one fill per dot.
      const paths = [new Path2D(), new Path2D(), new Path2D(), new Path2D(), new Path2D()];
      for (let i = 0; i < dots.length; i += 1) {
        const dot = dots[i];
        const wave = moving
          ? 0.5 + 0.5 * Math.sin(time * dot.speed + dot.phase)
          : 0.45;
        const bucket = Math.round(wave * 4);
        const radius = cr * (moving ? 1 + (bucket / 4) * 0.5 : 1);
        paths[bucket].moveTo(dot.x + radius, dot.y);
        paths[bucket].arc(dot.x, dot.y, radius, 0, Math.PI * 2);
      }
      for (let bucket = 0; bucket < paths.length; bucket += 1) {
        const wave = bucket / 4;
        ctx.globalAlpha = 0.32 + wave * 0.68;
        ctx.fill(paths[bucket]);
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      if (!alive) return;
      draw(now);
      raf = window.requestAnimationFrame(loop);
    };

    const stop = () => {
      if (raf) window.cancelAnimationFrame(raf);
      raf = 0;
    };

    const start = () => {
      stop();
      if (!alive) return;
      if (!glow || document.hidden || reduced()) {
        draw(performance.now());
        return;
      }
      raf = window.requestAnimationFrame(loop);
    };

    layout();
    start();

    const observer = new ResizeObserver(() => {
      layout();
      if (!raf) draw(performance.now());
    });
    observer.observe(parent);

    const themeObserver = new MutationObserver(() => {
      color = getComputedStyle(canvas).color;
      if (!raf) draw(performance.now());
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "style"],
    });

    const onVisibility = () => start();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      alive = false;
      stop();
      observer.disconnect();
      themeObserver.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [width, height, x, y, cx, cy, cr, glow]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute inset-0 h-full w-full",
        className,
      )}
    />
  );
}
