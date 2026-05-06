"use client";

import { useState } from "react";

import { useCart } from "@/components/providers/cart-provider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AddToCartButtonProps = {
  productSlug: string;
  disabled?: boolean;
  className?: string;
};

export function AddToCartButton({
  productSlug,
  disabled = false,
  className,
}: AddToCartButtonProps) {
  const { addItem } = useCart();
  const [added, setAdded] = useState(false);

  return (
    <Button
      variant="accent"
      className={cn(className)}
      disabled={disabled}
      onClick={() => {
        addItem(productSlug, 1);
        setAdded(true);
        window.setTimeout(() => setAdded(false), 1500);
      }}
    >
      {added ? "Добавлено" : "Добавить в корзину"}
    </Button>
  );
}
