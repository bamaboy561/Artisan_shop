"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { deleteOrderAction } from "@/app/admin/actions";

type DeleteOrderButtonProps = {
  orderId: string;
  orderNumber: string;
};

function DeleteOrderSubmitButton({ orderNumber }: { orderNumber: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={`Удалить заказ ${orderNumber}`}
      title={`Удалить заказ ${orderNumber}`}
      className="inline-flex size-8 shrink-0 items-center justify-center border border-red-200 text-red-700 transition hover:border-red-700 hover:bg-red-700 hover:text-white disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Trash2 className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}

export function DeleteOrderButton({
  orderId,
  orderNumber,
}: DeleteOrderButtonProps) {
  return (
    <form
      action={deleteOrderAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Удалить заказ ${orderNumber}? Это действие нельзя отменить. Резерв товара вернется в остатки, а бонусы будут пересчитаны.`,
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="confirmDeleteOrder" value="DELETE" />
      <DeleteOrderSubmitButton orderNumber={orderNumber} />
    </form>
  );
}
