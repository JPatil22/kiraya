"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Counts a rupee figure up from zero the first time it scrolls into view. The
 * server renders the final value, so no-JS clients and crawlers see the real
 * number; the client resets to zero and animates up (masked by the card's own
 * fade-in). Disabled under prefers-reduced-motion.
 */
export function CountUp({
  to,
  duration = 1400,
  prefix = "",
  startDelay = 300,
  className,
}: {
  to: number;
  duration?: number;
  prefix?: string;
  startDelay?: number;
  className?: string;
}) {
  const [value, setValue] = useState(to);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let timer = 0;
    let started = false;

    const run = () => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - t0) / duration);
        const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
        setValue(Math.round(to * eased));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (started) return;
      started = true;
      setValue(0);
      timer = window.setTimeout(run, startDelay);
    };

    const cleanup = () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };

    if (typeof IntersectionObserver === "undefined") {
      start();
      return cleanup;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          start();
          io.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      cleanup();
    };
  }, [to, duration, startDelay]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {value.toLocaleString("en-IN")}
    </span>
  );
}
