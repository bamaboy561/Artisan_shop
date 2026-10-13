"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

const confirmMessages: Record<string, string> = {
  cancel: "Отменить выбранные заказы",
  complete: "Завершить выбранные заказы",
};

// Кнопка массовых действий над заказами. Отмена и завершение сразу меняют
// резерв товара, бонусы и уведомляют клиентов, поэтому спрашивает
// подтверждение.
export function BulkOrdersSubmitButton({
  checkboxSelector,
}: {
  checkboxSelector: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="secondary"
      disabled={pending}
      onClick={(event) => {
        const form = event.currentTarget.form;
        const action = form ? String(new FormData(form).get("bulkAction")) : "";
        const message = confirmMessages[action];

        if (!message) {
          return;
        }

        const selectedCount = document.querySelectorAll(
          `${checkboxSelector}:checked`,
        ).length;

        if (
          !window.confirm(
            `${message} (${selectedCount})? Клиенты получат уведомления, отменить действие нельзя.`,
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
