"use client";

import { useState, type MouseEvent } from "react";
import { Check, Plus } from "lucide-react";

import { useCart } from "@/components/providers/cart-provider";
import { cn } from "@/lib/utils";

type ProductCardCartChipProps = {
  productSlug: string;
  disabled?: boolean;
  className?: string;
};

export function ProductCardCartChip({
  productSlug,
  disabled = false,
  className,
}: ProductCardCartChipProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    // The card is wrapped in <Link>. Prevent navigation when clicking the chip.
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    addItem(productSlug, 1);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1400);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label="Добавить в корзину"
      className={cn(
        "inline-flex h-9 items-center gap-1.5 border px-3 font-mono text-[10px] tracking-[0.14em] uppercase transition disabled:cursor-not-allowed disabled:opacity-45",
        added
          ? "border-[var(--accent)] bg-[var(--accent)] text-white"
          : "border-[var(--foreground)] bg-[var(--foreground)] text-white hover:bg-[#9d573d] hover:border-[#9d573d]",
        className,
      )}
    >
      {added ? (
        <Check className="size-3.5" strokeWidth={2.5} />
      ) : (
        <Plus className="size-3.5" strokeWidth={2.5} />
      )}
      <span>{added ? "Добавлено" : "В корзину"}</span>
    </button>
  );
}
