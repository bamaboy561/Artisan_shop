"use client";

import { useState } from "react";
import { Check, ShoppingCart } from "lucide-react";

import { useCart } from "@/components/providers/cart-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AddToCartButtonProps = {
  productSlug: string;
  disabled?: boolean;
  quantity?: number;
  compact?: boolean;
  className?: string;
};

export function AddToCartButton({
  productSlug,
  disabled = false,
  quantity = 1,
  compact = false,
  className,
}: AddToCartButtonProps) {
  const { addItem, canAddItem } = useCart();
  const [added, setAdded] = useState(false);
  const isDisabled = disabled || !canAddItem(productSlug);
  const label = added ? "Добавлено в корзину" : "Добавить в корзину";

  const handleAdd = () => {
    const wasAdded = addItem(productSlug, Math.max(1, quantity));

    if (!wasAdded) {
      return;
    }

    setAdded(true);
    window.setTimeout(() => setAdded(false), 1500);
  };

  if (compact) {
    return (
      <button
        type="button"
        aria-label={label}
        title={label}
        disabled={isDisabled}
        onClick={handleAdd}
        className={cn(
          "group/cart inline-flex size-9 items-center justify-center rounded-full border border-[color:var(--line)] bg-white/92 text-[var(--foreground)] shadow-[0_12px_30px_rgba(21,20,17,0.08)] backdrop-blur transition duration-300 hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white disabled:cursor-not-allowed disabled:opacity-45 sm:size-10",
          added && "border-[var(--accent)] bg-[var(--accent)] text-white",
          className,
        )}
      >
        {added ? (
          <Check className="size-4 transition-transform duration-300 group-hover/cart:scale-110" />
        ) : (
          <ShoppingCart className="size-4 transition-transform duration-300 group-hover/cart:scale-110" />
        )}
      </button>
    );
  }

  return (
    <Button
      variant="accent"
      className={cn(className)}
      disabled={isDisabled}
      onClick={handleAdd}
    >
      {added ? "Добавлено" : "Добавить в корзину"}
    </Button>
  );
}
