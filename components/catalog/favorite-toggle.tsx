import { Heart } from "lucide-react";

import { toggleFavoriteAction } from "@/app/(public)/favorites/actions";
import { cn } from "@/lib/utils";

type FavoriteToggleProps = {
  productSlug: string;
  isFavorite: boolean;
  next: string;
  variant?: "floating" | "inline" | "product";
  className?: string;
};

export function FavoriteToggle({
  productSlug,
  isFavorite,
  next,
  variant = "floating",
  className,
}: FavoriteToggleProps) {
  const label = isFavorite ? "Убрать из избранного" : "В избранное";

  return (
    <form action={toggleFavoriteAction} className={className}>
      <input type="hidden" name="productSlug" value={productSlug} />
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        aria-label={label}
        aria-pressed={isFavorite}
        className={cn(
          "group/favorite inline-flex items-center justify-center border border-[color:var(--line)] bg-white/92 text-[var(--foreground)] shadow-[0_12px_30px_rgba(21,20,17,0.08)] backdrop-blur transition duration-300 hover:border-[var(--foreground)] hover:bg-[var(--foreground)] hover:text-white",
          variant === "floating" && "size-9 rounded-full sm:size-10",
          variant === "inline" &&
            "h-9 gap-2 rounded-full px-3 font-mono text-[9px] tracking-[0.14em] uppercase",
          variant === "product" &&
            "h-10 gap-2 rounded-full px-4 font-mono text-[10px] tracking-[0.14em] uppercase",
          isFavorite &&
            "border-[var(--accent)] bg-[var(--accent)] text-white hover:border-[var(--foreground)]",
        )}
      >
        <Heart
          className={cn(
            "size-4 transition-transform duration-300 group-hover/favorite:scale-110",
            isFavorite && "fill-current",
          )}
        />
        {variant !== "floating" ? <span>{label}</span> : null}
      </button>
    </form>
  );
}
