"use client";

import { useEffect, useRef, useState, type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

type RevealProps = HTMLAttributes<HTMLDivElement> & {
  delayMs?: number;
  threshold?: number;
};

export function Reveal({
  className,
  children,
  delayMs = 0,
  threshold = 0.2,
  style,
  ...props
}: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];

        if (!entry?.isIntersecting) {
          return;
        }

        setIsVisible(true);
        observer.disconnect();
      },
      {
        threshold,
        rootMargin: "0px 0px -10% 0px",
      },
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [threshold]);

  return (
    <div
      ref={ref}
      className={cn(
        "transition-all duration-900 ease-[cubic-bezier(0.2,0.8,0.2,1)] will-change-transform motion-reduce:transition-none",
        isVisible
          ? "blur-0 translate-y-0 opacity-100"
          : "translate-y-8 opacity-0 blur-[2px]",
        className,
      )}
      style={{
        ...style,
        transitionDelay: `${delayMs}ms`,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
