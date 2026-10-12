"use client";

import { useState } from "react";
import { Check, LoaderCircle, Plus } from "lucide-react";

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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDisabled = disabled || pending || !canAddItem(productSlug);
  const unavailableLabel = !productSlug
    ? "Товар не привязан к каталогу"
    : "Товар недоступен для добавления";

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        disabled={isDisabled}
        aria-busy={pending}
        onClick={async () => {
          if (!productSlug || pending) {
            return;
          }

          setPending(true);
          setError(null);
          try {
            const wasAdded = await addItem(productSlug, Math.max(1, quantity));
            if (!wasAdded) {
              setError("Недостаточно товара в наличии или товар недоступен.");
              return;
            }
            setAdded(true);
            window.setTimeout(() => setAdded(false), 1400);
          } catch {
            setError("Не удалось добавить товар. Повторите попытку.");
          } finally {
            setPending(false);
          }
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
        title={isDisabled ? unavailableLabel : added ? "Добавлено" : "Добавить"}
      >
        {pending ? (
          <LoaderCircle className="size-4 animate-spin" />
        ) : added ? (
          <Check className="size-4" />
        ) : (
          <Plus className="size-4" />
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
    </span>
  );
}
