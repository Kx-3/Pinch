"use client";

import { useEffect, useRef, useState } from "react";

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Ease-out cubic — fast start, gentle settle. */
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Number ticker: interpolates from the previous value to the next one,
 * rendered with tabular numbers so digits never shift.
 */
export function AnimatedNumber({
  value,
  format = (n) => String(Math.round(n)),
  duration = 700,
  animateOnMount = true,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  animateOnMount?: boolean;
  className?: string;
}) {
  const initial = animateOnMount ? 0 : value;
  const [display, setDisplay] = useState(initial);
  const fromRef = useRef(initial);
  const frameRef = useRef<number>(0);


  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    if (prefersReducedMotion()) {
      fromRef.current = to;
      setDisplay(to);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = from + (to - from) * easeOut(t);
      setDisplay(next);
      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, [value, duration]);

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {format(display)}
    </span>
  );
}

