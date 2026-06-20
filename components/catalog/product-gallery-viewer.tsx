"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ExternalLink, X } from "lucide-react";

import { ProductImage } from "@/components/catalog/product-image";
import { cn } from "@/lib/utils";

type ProductGalleryViewerProps = {
  images: string[];
  productName: string;
};

export function ProductGalleryViewer({
  images,
  productName,
}: ProductGalleryViewerProps) {
  const gallery = images.filter(Boolean);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const activeImage = gallery[activeIndex] ?? "";
  const viewerImage =
    viewerIndex === null ? null : (gallery[viewerIndex] ?? null);
  const hasMultipleImages = gallery.length > 1;

  const getWrappedIndex = (index: number) => {
    if (gallery.length === 0) {
      return 0;
    }

    return (index + gallery.length) % gallery.length;
  };

  const showImage = (index: number) => {
    setActiveIndex(getWrappedIndex(index));
  };

  const openImage = (index: number) => {
    const nextIndex = getWrappedIndex(index);

    setActiveIndex(nextIndex);
    setViewerIndex(nextIndex);
  };

  useEffect(() => {
    if (viewerIndex === null) {
      document.body.style.overflow = "";
      return;
    }

    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = "";
    };
  }, [viewerIndex]);

  useEffect(() => {
    if (viewerIndex === null) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setViewerIndex(null);
        return;
      }

      if (gallery.length <= 1) {
        return;
      }

      if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
        setViewerIndex((currentIndex) => {
          if (currentIndex === null) {
            return currentIndex;
          }

          const direction = event.key === "ArrowLeft" ? -1 : 1;
          const nextIndex =
            (currentIndex + direction + gallery.length) % gallery.length;

          setActiveIndex(nextIndex);

          return nextIndex;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [gallery.length, viewerIndex]);

  if (gallery.length === 0) {
    return (
      <div className="relative aspect-[0.95] overflow-hidden bg-[#dad7cf] sm:aspect-[0.86]">
        <ProductImage
          src=""
          alt={productName}
          fill
          fallbackLabel="Нет фото"
          className="object-cover"
          sizes="(max-width: 1024px) 100vw, 58vw"
        />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 sm:space-y-4">
        <div className="relative">
          <button
            type="button"
            onClick={() => openImage(activeIndex)}
            className="group relative block aspect-[0.95] w-full overflow-hidden bg-[#dad7cf] text-left sm:aspect-[0.86]"
            aria-label="Открыть фото товара в полном размере"
          >
            <ProductImage
              src={activeImage}
              alt={productName}
              fill
              priority
              fallbackLabel="Нет фото"
              className="object-cover transition duration-500 group-hover:scale-[1.02]"
              sizes="(max-width: 1024px) 100vw, 58vw"
            />
            <span className="absolute right-3 bottom-3 inline-flex min-h-9 items-center justify-center bg-black/72 px-4 font-mono text-[10px] tracking-[0.16em] text-white uppercase backdrop-blur">
              Открыть фото
            </span>
          </button>

          {hasMultipleImages ? (
            <>
              <button
                type="button"
                onClick={() => showImage(activeIndex - 1)}
                className="absolute top-1/2 left-3 inline-flex size-11 -translate-y-1/2 items-center justify-center bg-black/62 text-white backdrop-blur transition hover:bg-black/78"
                aria-label="Previous image"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => showImage(activeIndex + 1)}
                className="absolute top-1/2 right-3 inline-flex size-11 -translate-y-1/2 items-center justify-center bg-black/62 text-white backdrop-blur transition hover:bg-black/78"
                aria-label="Next image"
              >
                <ChevronRight className="size-5" />
              </button>
              <span className="absolute bottom-3 left-3 inline-flex min-h-9 items-center justify-center bg-black/62 px-3 font-mono text-[10px] tracking-[0.16em] text-white uppercase backdrop-blur">
                {activeIndex + 1} / {gallery.length}
              </span>
            </>
          ) : null}
        </div>

        {hasMultipleImages ? (
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <div className="grid w-max grid-flow-col gap-3 sm:w-auto sm:grid-flow-row sm:grid-cols-2">
              {gallery.slice(0, 5).map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  onClick={() => openImage(index)}
                  className={cn(
                    "relative aspect-square w-[8.25rem] overflow-hidden bg-[#dad7cf] text-left transition sm:w-auto",
                    index === activeIndex
                      ? "ring-2 ring-[var(--foreground)] ring-offset-2 ring-offset-[#f1eee8]"
                      : "opacity-78 hover:opacity-100",
                  )}
                  aria-label={`Открыть фото ${index + 1} в полном размере`}
                >
                  <ProductImage
                    src={image}
                    alt={`${productName} - фото ${index + 1}`}
                    fill
                    fallbackLabel="Нет фото"
                    className="object-cover"
                    sizes="(max-width: 1024px) 40vw, 28vw"
                  />
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {viewerImage ? (
        <div className="fixed inset-0 z-[90] bg-black/86 px-3 py-4 backdrop-blur-sm sm:px-6 sm:py-6">
          <div className="mx-auto flex h-full max-w-[1500px] flex-col gap-3">
            <div className="flex items-center justify-between gap-3 text-white">
              <p className="min-w-0 truncate text-sm font-medium">
                {productName}
              </p>
              <div className="flex items-center gap-2">
                <a
                  href={viewerImage}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex size-10 items-center justify-center border border-white/24 bg-white/10 transition hover:bg-white/18"
                  aria-label="Открыть оригинал фото в новой вкладке"
                >
                  <ExternalLink className="size-4" />
                </a>
                <button
                  type="button"
                  onClick={() => setViewerIndex(null)}
                  className="inline-flex size-10 items-center justify-center border border-white/24 bg-white/10 transition hover:bg-white/18"
                  aria-label="Закрыть просмотр фото"
                >
                  <X className="size-5" />
                </button>
              </div>
            </div>

            <div
              className="relative min-h-0 flex-1 overflow-hidden bg-black/20"
              aria-label="Закрыть просмотр фото"
            >
              <ProductImage
                src={viewerImage}
                alt={productName}
                fill
                fallbackLabel="Нет фото"
                className="object-contain"
                sizes="100vw"
                priority
              />

              {hasMultipleImages && viewerIndex !== null ? (
                <>
                  <button
                    type="button"
                    onClick={() => openImage(viewerIndex - 1)}
                    className="absolute top-1/2 left-3 inline-flex size-12 -translate-y-1/2 items-center justify-center border border-white/18 bg-black/42 text-white backdrop-blur transition hover:bg-black/62 sm:left-5 sm:size-14"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="size-6" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openImage(viewerIndex + 1)}
                    className="absolute top-1/2 right-3 inline-flex size-12 -translate-y-1/2 items-center justify-center border border-white/18 bg-black/42 text-white backdrop-blur transition hover:bg-black/62 sm:right-5 sm:size-14"
                    aria-label="Next image"
                  >
                    <ChevronRight className="size-6" />
                  </button>
                  <span className="absolute bottom-4 left-1/2 inline-flex -translate-x-1/2 items-center justify-center bg-black/62 px-4 py-2 font-mono text-[11px] tracking-[0.16em] text-white uppercase backdrop-blur">
                    {viewerIndex + 1} / {gallery.length}
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
