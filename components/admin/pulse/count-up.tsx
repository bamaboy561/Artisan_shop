"use client";

import { useEffect, useRef, useState } from "react";

// Число «добегает» до значения при открытии страницы.
export function CountUp({
  value,
  suffix = "",
}: {
  value: number;
  suffix?: string;
}) {
  const [shown, setShown] = useState(value);
  const from = useRef(0);

  useEffect(() => {
    const instant = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const k = instant ? 1 : Math.min(1, (now - start) / 1200);
      setShown(
        Math.round(origin + (value - origin) * (1 - Math.pow(1 - k, 3))),
      );
      if (k < 1) frame = requestAnimationFrame(tick);
      else from.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <>
      {new Intl.NumberFormat("ru-RU").format(shown)}
      {suffix}
    </>
  );
}
