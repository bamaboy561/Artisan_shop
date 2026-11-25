"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { deleteOrderAction } from "@/app/admin/actions";

type DeleteOrderButtonProps = {
  orderId: string;
  orderNumber: string;
};

function ConfirmSubmit() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      autoFocus
      disabled={pending}
      className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-red-600 px-3 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? (
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
      ) : null}
      {pending ? "Удаляем..." : "Да, удалить"}
    </button>
  );
}

// Пункт «Удалить…» в меню «⋯» строки заказа. Подтверждение прямо на
// странице, а не окном браузера: окно браузер может заблокировать.
export function DeleteOrderButton({
  orderId,
  orderNumber,
}: DeleteOrderButtonProps) {
  const [armed, setArmed] = useState(false);

  return (
    <form action={deleteOrderAction}>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="confirmDeleteOrder" value="DELETE" />
      {armed ? (
        <div
          role="alertdialog"
          aria-live="assertive"
          className="grid gap-2 rounded-[10px] border border-red-200 bg-red-50 p-3"
        >
          <p className="text-xs leading-5 text-red-900">
            Удалить заказ {orderNumber}? Резерв вернётся в остатки, бонусы
            пересчитаются. Отменить нельзя.
          </p>
          <div className="flex items-center gap-3">
            <ConfirmSubmit />
            <button
              type="button"
              onClick={() => setArmed(false)}
              className="text-xs text-zinc-600 underline underline-offset-2"
            >
              Отмена
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setArmed(true)}
          aria-label={`Удалить заказ ${orderNumber}`}
          className="flex h-9 w-full items-center gap-2.5 rounded-[8px] px-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Удалить…
        </button>
      )}
    </form>
  );
}
