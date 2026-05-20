"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { shouldBypassNextImageOptimization } from "@/lib/image-optimization";
import { cn } from "@/lib/utils";

export type HomeHeroSlide = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  primaryAction: {
    href: string;
    label: string;
  };
  secondaryAction?: {
    href: string;
    label: string;
  };
  images: Array<{
    src: string;
    alt: string;
  }>;
};

const slideTones = ["bg-[#858866]", "bg-[#c9c2b7]", "bg-[#8b8b80]"];

function HeroButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex h-10 min-w-40 items-center justify-center border border-white/42 px-5 font-mono text-[10px] tracking-[0.16em] text-white uppercase transition hover:bg-white hover:text-black max-sm:w-full sm:h-11 sm:px-6 sm:text-[11px]"
    >
      {children}
    </Link>
  );
}

export function HomeHeroCarousel({ slides }: { slides: HomeHeroSlide[] }) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % slides.length);
    }, 7600);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [slides.length]);

  const activeSlide = slides[activeIndex]!;

  const goToPrev = () => {
    setActiveIndex((current) => (current - 1 + slides.length) % slides.length);
  };

  const goToNext = () => {
    setActiveIndex((current) => (current + 1) % slides.length);
  };

  return (
    <section className="relative -mt-16 min-h-[84svh] overflow-hidden bg-[#11110f] pt-16 text-white lg:-mt-14 lg:min-h-screen lg:pt-14">
      {slides.map((slide, slideIndex) => (
        <div
          key={slide.id}
          className={cn(
            "absolute inset-0 transition-opacity duration-1000",
            slideIndex === activeIndex
              ? "opacity-100"
              : "pointer-events-none opacity-0",
          )}
        >
          <div
            className={cn(
              "absolute inset-0",
              slideTones[slideIndex % slideTones.length],
            )}
          />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_32%,rgba(255,255,255,0.22),transparent_38%),linear-gradient(180deg,rgba(0,0,0,0)_0%,rgba(0,0,0,0.06)_48%,rgba(0,0,0,0.72)_100%)]" />

          <div
            className={cn(
              "absolute inset-x-0 top-[13svh] mx-auto flex h-[31svh] max-w-[1180px] items-center justify-center gap-3 px-5 transition-transform duration-[7600ms] ease-linear sm:top-[12svh] sm:h-[44svh] sm:gap-5 sm:px-8 lg:top-[10svh] lg:h-[58svh] lg:px-16",
              slideIndex === activeIndex ? "scale-[1.015]" : "scale-100",
            )}
          >
            {slide.images.map((image, imageIndex) => (
              <div
                key={`${slide.id}-${image.src || imageIndex}`}
                className={cn(
                  "relative overflow-hidden bg-white/14 shadow-[0_26px_80px_rgba(0,0,0,0.18)] ring-1 ring-white/12",
                  imageIndex === 1
                    ? "h-[29svh] w-[70vw] max-w-[22rem] sm:h-[40svh] sm:w-[58vw] lg:h-[50svh] lg:w-[42vw]"
                    : "hidden h-[24svh] w-[24vw] max-w-[16rem] sm:block sm:h-[32svh] lg:h-[41svh]",
                )}
              >
                {image.src ? (
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    priority={slideIndex === 0}
                    className="object-cover object-center transition duration-700"
                    sizes="(max-width: 640px) 70vw, 28vw"
                    unoptimized={shouldBypassNextImageOptimization(image.src)}
                  />
                ) : (
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,rgba(255,255,255,0.18),transparent_60%),linear-gradient(135deg,#2f2721_0%,#151411_55%,#3a2218_100%)]" />
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={goToPrev}
        className="absolute top-1/2 left-5 z-10 hidden size-10 -translate-y-1/2 items-center justify-center border border-white/22 bg-black/12 text-white/62 backdrop-blur transition hover:bg-white hover:text-black lg:flex"
        aria-label="Предыдущий слайд"
      >
        <ChevronLeft className="size-5" />
      </button>
      <button
        type="button"
        onClick={goToNext}
        className="absolute top-1/2 right-5 z-10 hidden size-10 -translate-y-1/2 items-center justify-center border border-white/22 bg-black/12 text-white/62 backdrop-blur transition hover:bg-white hover:text-black lg:flex"
        aria-label="Следующий слайд"
      >
        <ChevronRight className="size-5" />
      </button>

      <div className="relative mx-auto flex min-h-[calc(84svh-4rem)] max-w-[1500px] flex-col justify-end px-4 pb-[calc(6.15rem+env(safe-area-inset-bottom))] sm:px-8 sm:pb-10 lg:min-h-[calc(100svh-3.5rem)] lg:px-10 lg:pb-8">
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div
            key={activeSlide.id}
            className="rise-in max-w-[31rem] rounded-[1.35rem] bg-black/14 p-3.5 backdrop-blur-sm sm:bg-transparent sm:p-0"
            aria-live="polite"
          >
            <p className="font-mono text-[10px] tracking-[0.22em] text-white/58 uppercase">
              {activeSlide.eyebrow}
            </p>
            <h1 className="mt-2.5 max-w-[14ch] text-[1.65rem] leading-[0.98] font-semibold tracking-[-0.045em] text-balance text-white sm:mt-3 sm:text-[2.55rem] lg:text-[3rem]">
              {activeSlide.title}
            </h1>
            <p className="mt-2.5 max-w-[24rem] text-sm leading-5 text-white/72 sm:mt-3 sm:leading-6">
              {activeSlide.description}
            </p>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row lg:justify-end">
            <HeroButton href={activeSlide.primaryAction.href}>
              {activeSlide.primaryAction.label}
            </HeroButton>
            {activeSlide.secondaryAction ? (
              <HeroButton href={activeSlide.secondaryAction.href}>
                {activeSlide.secondaryAction.label}
              </HeroButton>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex justify-start gap-2 lg:mt-7 lg:justify-center">
          {slides.map((slide, slideIndex) => (
            <button
              key={slide.id}
              type="button"
              onClick={() => setActiveIndex(slideIndex)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                slideIndex === activeIndex
                  ? "w-12 bg-white/70"
                  : "w-2 bg-white/32 hover:bg-white/58",
              )}
              aria-label={`Открыть слайд ${slideIndex + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
