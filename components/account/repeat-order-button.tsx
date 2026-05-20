"use client";

import { useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";

import { useCart } from "@/components/providers/cart-provider";
import { repeatOrderAction } from "@/app/account/orders/actions";
import { Button } from "@/components/ui/button";

export function RepeatOrderButton({ orderId }: { orderId: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const { addItem } = useCart();

  const handleRepeat = () => {
    startTransition(async () => {
      try {
        const result = await repeatOrderAction(orderId);
        if (result.success && result.items) {
          for (const item of result.items) {
            addItem(item.productSlug, item.quantity);
          }
          setMessage("Добавлено: " + result.items.length + " поз.");
          setTimeout(() => setMessage(null), 3000);
        } else {
          setMessage(result.error ?? "Не удалось повторить заказ");
          setTimeout(() => setMessage(null), 3000);
        }
      } catch {
        setMessage("Ошибка при повторе заказа");
        setTimeout(() => setMessage(null), 3000);
      }
    });
  };

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={handleRepeat}
      disabled={pending}
      className="gap-1.5"
    >
      <RefreshCw className={`size-3 ${pending ? "animate-spin" : ""}`} />
      {message ?? "Повторить"}
    </Button>
  );
}