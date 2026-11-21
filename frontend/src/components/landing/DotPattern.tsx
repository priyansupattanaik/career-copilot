import { useEffect, useRef } from "react";

const GRID = 34;
const INFLUENCE = 180;

export function DotPattern() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    let width = 1;
    let height = 1;
    let dpr = 1;
    let frame = 0;
    let running = true;
    let reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: -1000, y: -1000 };
    const dots: Array<{ x: number; y: number; glow: number }> = [];

    const resize = () => {
      const bounds = canvas.getBoundingClientRect();
      width = Math.max(1, Math.ceil(bounds.width));
      height = Math.max(1, Math.ceil(bounds.height));
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots.length = 0;
      for (let y = 0; y < height + GRID; y += GRID) {
        for (let x = 0; x < width + GRID; x += GRID) dots.push({ x, y, glow: 0 });
      }
      draw();
    };

    const draw = () => {
      context.clearRect(0, 0, width, height);
      const dark = document.documentElement.classList.contains("dark") ||
        document.documentElement.dataset.theme === "dark";
      const accent = dark ? "138,99,255" : "79,70,229";
      for (const dot of dots) {
        const distance = Math.hypot(dot.x - pointer.x, dot.y - pointer.y);
        const target = reduced ? 0 : Math.max(0, 1 - distance / INFLUENCE);
        dot.glow += (target - dot.glow) * 0.12;
        const radius = 1.2 + dot.glow * 2.2;
        context.beginPath();
        context.arc(dot.x, dot.y, radius, 0, Math.PI * 2);
        context.fillStyle = dot.glow > 0.01
          ? `rgba(${accent},${0.14 + dot.glow * 0.5})`
          : `rgba(100,100,110,${dark ? 0.18 : 0.14})`;
        context.fill();
      }
    };

    const tick = () => {
      if (!running) return;
      draw();
      frame = window.requestAnimationFrame(tick);
    };
    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
    };
    const onVisibility = () => {
      running = !document.hidden;
      if (running && !reduced) {
        window.cancelAnimationFrame(frame);
        frame = window.requestAnimationFrame(tick);
      }
    };
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onMotionChange = () => {
      reduced = motionQuery.matches;
      if (reduced) window.cancelAnimationFrame(frame);
      else if (running) frame = window.requestAnimationFrame(tick);
      draw();
    };

    resize();
    window.addEventListener("resize", resize);
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    motionQuery.addEventListener("change", onMotionChange);
    if (!reduced) frame = window.requestAnimationFrame(tick);
    return () => {
      running = false;
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
      motionQuery.removeEventListener("change", onMotionChange);
    };
  }, []);

  return <canvas ref={canvasRef} className="landing-dot-pattern" aria-hidden="true" />;
}
