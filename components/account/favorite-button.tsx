"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";

import { toggleFavoriteAction } from "@/app/account/actions";
import { cn } from "@/lib/utils";

export function FavoriteButton({
  productSlug,
  initialActive = false,
  className,
}: {
  productSlug: string;
  initialActive?: boolean;
  className?: string;
}) {
  const [active, setActive] = useState(initialActive);
  const [pending, startTransition] = useTransition();

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startTransition(async () => {
      const result = await toggleFavoriteAction(productSlug);
      if (result.success && typeof result.active === "boolean") {
        setActive(result.active);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={pending}
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[9px] tracking-[0.12em] uppercase transition",
        active
          ? "text-[var(--accent)]"
          : "text-[var(--muted)] hover:text-[var(--foreground)]",
        className,
      )}
      aria-label={active ? "Убрать из избранного" : "Добавить в избранное"}
    >
      <Heart
        className={cn("size-3", active && "fill-[var(--accent)]")}
        strokeWidth={active ? 2 : 1.5}
      />
      {active ? "В избранном" : "В избранное"}
    </button>
  );
}