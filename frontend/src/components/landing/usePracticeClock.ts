import { useEffect, useState } from "react";

export function usePracticeClock(paused = false) {
  const [seconds, setSeconds] = useState(4 * 60 + 18);
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(id);
  }, [paused]);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
