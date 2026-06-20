"use client";

import { useState } from "react";
import { Check, Plus } from "lucide-react";

import { useCart } from "@/components/providers/cart-provider";
import { cn } from "@/lib/utils";

type AddBundleItemButtonProps = {
  productSlug?: string;
  quantity?: number;
  disabled?: boolean;
  className?: string;
};

export function AddBundleItemButton({
  productSlug,
  quantity = 1,
  disabled = false,
  className,
}: AddBundleItemButtonProps) {
  const { addItem, canAddItem } = useCart();
  const [added, setAdded] = useState(false);
  const isDisabled = disabled || !canAddItem(productSlug);
  const unavailableLabel = !productSlug
    ? "Товар не привязан к каталогу"
    : "Товар недоступен для добавления";

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={() => {
        if (!productSlug) {
          return;
        }

        const wasAdded = addItem(productSlug, Math.max(1, quantity));

        if (!wasAdded) {
          return;
        }

        setAdded(true);
        window.setTimeout(() => setAdded(false), 1400);
      }}
      className={cn(
        "inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--foreground)] text-white transition hover:bg-[var(--accent)] disabled:cursor-not-allowed disabled:bg-[var(--muted)]/45",
        className,
      )}
      aria-label={
        isDisabled
          ? unavailableLabel
          : added
            ? "Добавлено в корзину"
            : "Добавить рекомендацию"
      }
      title={
        isDisabled ? unavailableLabel : added ? "Добавлено" : "Добавить"
      }
    >
      {added ? <Check className="size-4" /> : <Plus className="size-4" />}
    </button>
  );
}
