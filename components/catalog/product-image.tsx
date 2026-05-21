"use client";

import { useState } from "react";

import Image, { type ImageProps } from "next/image";

import { shouldBypassNextImageOptimization } from "@/lib/image-optimization";
import { cn } from "@/lib/utils";

type ProductImageProps = Omit<
  ImageProps,
  "src" | "alt" | "onError" | "unoptimized"
> & {
  src?: string | null;
  alt: string;
  fallbackLabel?: string;
  fallbackClassName?: string;
  unoptimized?: boolean;
};

export function ProductImage({
  src,
  alt,
  fallbackLabel = "Нет фото",
  fallbackClassName,
  className,
  unoptimized,
  fill,
  ...props
}: ProductImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const hasError = Boolean(src && failedSrc === src);

  if (!src || hasError) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-[#ece8df] text-[var(--muted)]",
          fill ? "absolute inset-0" : "h-full w-full",
          fallbackClassName,
        )}
        aria-label={alt}
        role="img"
      >
        <span className="px-4 text-center font-mono text-[10px] tracking-[0.18em] uppercase">
          {fallbackLabel}
        </span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      className={className}
      unoptimized={unoptimized ?? shouldBypassNextImageOptimization(src)}
      onError={() => setFailedSrc(src)}
      {...props}
    />
  );
}
