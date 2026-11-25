"use client";

// Первый экран: при прокрутке лист ЛДСП распиливается, детали получают
// кромку и собираются в шкаф. Тексты — обычный HTML поверх сцены, поэтому
// заголовок виден сразу, даже пока 3D ещё грузится.

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { CutScene } from "./cut-hero-scene";
import s from "./storefront.module.css";

export type CutHeroStep = {
  label: string;
  title: string;
  text: string;
  // Отрезок прокрутки, на котором подпись видна.
  from: number;
  to: number;
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function windowOpacity(p: number, from: number, to: number) {
  const fade = 0.04;
  if (p < from - fade || p > to + fade) return 0;
  if (p < from) return (p - from + fade) / fade;
  if (p > to) return 1 - (p - to) / fade;
  return 1;
}

export function CutHero({
  intro,
  finale,
  steps,
}: {
  intro: ReactNode;
  finale: ReactNode;
  steps: CutHeroStep[];
}) {
  const sectionRef = useRef<HTMLElement>(null);
  const stickyRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const introRef = useRef<HTMLDivElement>(null);
  const finaleRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const railRef = useRef<HTMLOListElement>(null);
  const [mode, setMode] = useState<"loading" | "live" | "static" | "failed">(
    "loading",
  );

  useEffect(() => {
    const section = sectionRef.current;
    const sticky = stickyRef.current;
    const canvas = canvasRef.current;
    if (!section || !sticky || !canvas) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const isStatic = reduced.matches;
    let scene: CutScene | null = null;
    let cancelled = false;
    let frame = 0;

    const paintText = (p: number) => {
      const introNode = introRef.current;
      if (introNode) {
        const value = isStatic ? 1 : 1 - clamp01((p - 0.03) / 0.07);
        introNode.style.opacity = String(value);
        introNode.style.transform = `translateY(${(1 - value) * -24}px)`;
        introNode.style.visibility = value > 0 ? "visible" : "hidden";
      }
      stepRefs.current.forEach((node, index) => {
        if (!node) return;
        const step = steps[index];
        const value = isStatic ? 0 : windowOpacity(p, step.from, step.to);
        node.style.opacity = String(value);
        node.style.transform = `translateY(${(1 - value) * 18}px)`;
        node.style.visibility = value > 0 ? "visible" : "hidden";
      });
      const finaleNode = finaleRef.current;
      if (finaleNode) {
        const value = isStatic ? 0 : clamp01((p - 0.9) / 0.06);
        finaleNode.style.opacity = String(value);
        finaleNode.style.transform = `translateY(${(1 - value) * 18}px)`;
        finaleNode.style.visibility = value > 0 ? "visible" : "hidden";
      }
      const rail = railRef.current;
      if (rail) {
        rail.style.setProperty("--cut-progress", String(p));
        const active = isStatic
          ? -1
          : steps.findIndex(
              (step) => p >= step.from - 0.04 && p <= step.to + 0.04,
            );
        Array.from(rail.children).forEach((item, index) => {
          (item as HTMLElement).dataset.active = String(index === active);
          (item as HTMLElement).dataset.done = String(
            !isStatic && p > steps[index].to + 0.04,
          );
        });
      }
    };

    const readProgress = () => {
      if (isStatic) return 1;
      const rect = section.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return 0;
      return clamp01(-rect.top / scrollable);
    };

    const update = () => {
      frame = 0;
      const p = readProgress();
      paintText(p);
      scene?.setProgress(p);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    const resize = () => {
      const { width, height } = sticky.getBoundingClientRect();
      scene?.resize(width, height);
    };
    const observer = new ResizeObserver(resize);

    update();
    import("./cut-hero-scene")
      .then(({ createCutScene }) => {
        if (cancelled) return;
        try {
          scene = createCutScene(canvas);
        } catch {
          setMode("failed");
          return;
        }
        resize();
        scene.setProgress(readProgress());
        observer.observe(sticky);
        setMode(isStatic ? "static" : "live");
      })
      .catch(() => {
        if (!cancelled) setMode("failed");
      });

    if (!isStatic) {
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
    }
    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      observer.disconnect();
      scene?.dispose();
    };
  }, [steps]);

  return (
    <section
      ref={sectionRef}
      className={s.cutHero}
      data-mode={mode}
      aria-label="Artisan в Бишкеке"
    >
      <div ref={stickyRef} className={s.cutSticky}>
        <canvas ref={canvasRef} className={s.cutCanvas} aria-hidden="true" />
        <div className={`${s.container} ${s.cutLayer}`}>
          <div ref={introRef} className={s.cutIntro}>
            {intro}
          </div>
          {steps.map((step, index) => (
            <div
              key={step.label}
              ref={(node) => {
                stepRefs.current[index] = node;
              }}
              className={s.cutStep}
              style={{ opacity: 0, visibility: "hidden" }}
            >
              <span className={s.cutStepIndex}>
                {String(index + 1).padStart(2, "0")} / {steps.length}
              </span>
              <h2>{step.title}</h2>
              <p>{step.text}</p>
            </div>
          ))}
          <div
            ref={finaleRef}
            className={s.cutFinale}
            style={{ opacity: 0, visibility: "hidden" }}
          >
            {finale}
          </div>
          <ol ref={railRef} className={s.cutRail} aria-hidden="true">
            {steps.map((step) => (
              <li key={step.label}>{step.label}</li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
