"use client";

import Image from "next/image";

import { shouldBypassNextImageOptimization } from "@/lib/image-optimization";

export function HoverImageSwap({
  src,
  hoverSrc,
  alt,
  fill = true,
  priority = false,
  className = "",
  sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw",
}: {
  src: string;
  hoverSrc?: string;
  alt: string;
  fill?: boolean;
  priority?: boolean;
  className?: string;
  sizes?: string;
}) {
  const hasHover = hoverSrc && hoverSrc.length > 0;

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Image
        src={src}
        alt={alt}
        fill={fill}
        priority={priority}
        className={`object-cover transition-all duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${hasHover ? "group-hover:opacity-0 group-hover:scale-[1.08]" : "group-hover:scale-[1.06]"} ${className}`}
        sizes={sizes}
        unoptimized={shouldBypassNextImageOptimization(src)}
      />
      {hasHover ? (
        <Image
          src={hoverSrc}
          alt={`${alt} – альтернативный вид`}
          fill={fill}
          className={`object-cover opacity-0 transition-all duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-100 group-hover:scale-[1.04] ${className}`}
          sizes={sizes}
          unoptimized={shouldBypassNextImageOptimization(hoverSrc)}
        />
      ) : null}
    </div>
  );
}