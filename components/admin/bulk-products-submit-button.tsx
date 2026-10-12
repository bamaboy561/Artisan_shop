"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

// Кнопка массовых действий над товарами. Перед изменением цены на процент
// спрашивает подтверждение: это действие сразу меняет цены на сайте.
export function BulkProductsSubmitButton({
  checkboxSelector,
}: {
  checkboxSelector: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="secondary"
      className="h-9 w-full lg:w-auto"
      disabled={pending}
      onClick={(event) => {
        const form = event.currentTarget.form;

        if (!form) {
          return;
        }

        const data = new FormData(form);

        if (data.get("bulkAction") !== "price-percent") {
          return;
        }

        const percent = Number.parseFloat(String(data.get("pricePercent")));
        const selectedCount = document.querySelectorAll(
          `${checkboxSelector}:checked`,
        ).length;

        if (!Number.isFinite(percent) || percent === 0) {
          event.preventDefault();
          window.alert(
            "Укажите, на сколько процентов изменить цену: например 5 или -10.",
          );
          return;
        }

        if (
          !window.confirm(
            `Изменить цену у выбранных товаров (${selectedCount}) на ${percent > 0 ? "+" : ""}${percent}%? Цены на сайте изменятся сразу, отменить нельзя.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      {pending ? "Применяем..." : "Применить"}
    </Button>
  );
}
