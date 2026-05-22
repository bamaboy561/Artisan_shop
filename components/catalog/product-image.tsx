"use client";

/* eslint-disable @next/next/no-img-element */

import { type ImgHTMLAttributes, useState } from "react";

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

function isRemoteImage(src: string) {
  try {
    const url = new URL(src);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

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

  if (isRemoteImage(src)) {
    const nativeProps = { ...props } as Record<string, unknown>;
    const priority = props.priority;
    const loading = props.loading;
    const decoding = props.decoding;
    const sizes = props.sizes;
    const width = props.width;
    const height = props.height;

    delete nativeProps.priority;
    delete nativeProps.quality;
    delete nativeProps.placeholder;
    delete nativeProps.blurDataURL;
    delete nativeProps.loader;
    delete nativeProps.overrideSrc;
    delete nativeProps.loading;
    delete nativeProps.decoding;
    delete nativeProps.sizes;
    delete nativeProps.width;
    delete nativeProps.height;

    const imgProps = nativeProps as ImgHTMLAttributes<HTMLImageElement>;

    return (
      <img
        {...imgProps}
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        loading={loading ?? (priority ? "eager" : "lazy")}
        decoding={decoding ?? "async"}
        fetchPriority={priority ? "high" : undefined}
        className={cn(fill && "absolute inset-0 h-full w-full", className)}
        onError={() => setFailedSrc(src)}
      />
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
