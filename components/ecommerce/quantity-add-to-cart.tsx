"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";

import { AddToCartButton } from "@/components/ecommerce/add-to-cart-button";
import { MAX_CART_ITEM_QUANTITY } from "@/components/providers/cart-provider";
import { cn } from "@/lib/utils";

type QuantityAddToCartProps = {
  productSlug: string;
  disabled?: boolean;
  maxQuantity?: number | null;
  className?: string;
};

export function QuantityAddToCart({
  productSlug,
  disabled = false,
  maxQuantity,
  className,
}: QuantityAddToCartProps) {
  const limit = Math.max(
    1,
    Math.min(MAX_CART_ITEM_QUANTITY, maxQuantity ?? MAX_CART_ITEM_QUANTITY),
  );
  const [quantity, setQuantity] = useState(1);
  const clamp = (value: number) =>
    Math.min(limit, Math.max(1, Math.floor(value) || 1));
  const stepButton =
    "inline-flex size-11 shrink-0 items-center justify-center text-[var(--foreground)] transition hover:bg-[var(--surface)] disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div
      className={cn("grid grid-cols-[auto_minmax(0,1fr)] gap-2.5", className)}
    >
      <div className="flex items-center border border-[color:var(--line)] bg-[var(--surface-strong)]">
        <button
          type="button"
          aria-label="Уменьшить количество"
          className={stepButton}
          disabled={disabled || quantity <= 1}
          onClick={() => setQuantity((value) => clamp(value - 1))}
        >
          <Minus className="size-4" />
        </button>
        <input
          aria-label="Количество"
          inputMode="numeric"
          className="h-11 w-12 bg-transparent text-center text-sm font-semibold text-[var(--foreground)] focus-visible:outline-none"
          value={quantity}
          disabled={disabled}
          onChange={(event) =>
            setQuantity(clamp(Number.parseInt(event.target.value, 10)))
          }
        />
        <button
          type="button"
          aria-label="Увеличить количество"
          className={stepButton}
          disabled={disabled || quantity >= limit}
          onClick={() => setQuantity((value) => clamp(value + 1))}
        >
          <Plus className="size-4" />
        </button>
      </div>
      <AddToCartButton
        productSlug={productSlug}
        disabled={disabled}
        quantity={quantity}
        className="w-full"
      />
    </div>
  );
}
