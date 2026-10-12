"use client";

import { useState } from "react";
import { Check, LoaderCircle, ShoppingCart } from "lucide-react";

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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDisabled = disabled || pending || !canAddItem(productSlug);
  const label = added ? "Добавлено в корзину" : "Добавить в корзину";

  const handleAdd = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      const wasAdded = await addItem(productSlug, Math.max(1, quantity));
      if (!wasAdded) {
        setError("Недостаточно товара в наличии или товар недоступен.");
        return;
      }
      setAdded(true);
      window.setTimeout(() => setAdded(false), 1500);
    } catch {
      setError("Не удалось добавить товар. Повторите попытку.");
    } finally {
      setPending(false);
    }
  };

  if (compact) {
    return (
      <span className="relative inline-flex">
        <button
          type="button"
          aria-label={label}
          title={label}
          disabled={isDisabled}
          aria-busy={pending}
          onClick={handleAdd}
          className={cn(
            "group/cart inline-flex size-9 items-center justify-center rounded-full border border-[color:var(--line)] bg-white/92 text-[var(--foreground)] shadow-[0_12px_30px_rgba(21,20,17,0.08)] backdrop-blur transition duration-300 hover:border-[var(--accent)] hover:bg-[var(--accent)] hover:text-white disabled:cursor-not-allowed disabled:opacity-45 sm:size-10",
            added && "border-[var(--accent)] bg-[var(--accent)] text-white",
            className,
          )}
        >
          {pending ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : added ? (
            <Check className="size-4 transition-transform duration-300 group-hover/cart:scale-110" />
          ) : (
            <ShoppingCart className="size-4 transition-transform duration-300 group-hover/cart:scale-110" />
          )}
        </button>
        {error ? (
          <span
            role="alert"
            className="absolute top-full right-0 z-30 mt-2 w-52 rounded border border-rose-200 bg-white p-2 text-xs text-rose-700 shadow"
          >
            {error}
          </span>
        ) : null}
        <span className="sr-only" role="status">
          {added ? label : ""}
        </span>
      </span>
    );
  }

  return (
    <span className={cn("inline-flex min-w-0 flex-col", className)}>
      <Button
        variant="accent"
        className="w-full gap-2 px-3 font-sans text-sm tracking-normal normal-case"
        aria-label={pending ? "Добавляем в корзину" : label}
        disabled={isDisabled}
        aria-busy={pending}
        onClick={handleAdd}
      >
        {pending ? (
          <LoaderCircle className="size-4 shrink-0 animate-spin" />
        ) : added ? (
          <Check className="size-4 shrink-0" />
        ) : (
          <ShoppingCart className="size-4 shrink-0" />
        )}
        <span role="status">
          {pending ? "Добавляем…" : added ? "Добавлено" : "В корзину"}
        </span>
      </Button>
      {error ? (
        <span role="alert" className="mt-2 text-xs text-rose-700">
          {error}
        </span>
      ) : null}
    </span>
  );
}
