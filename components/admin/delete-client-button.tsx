"use client";

import { Trash2 } from "lucide-react";

import { deleteClientAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function DeleteClientButton({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  return (
    <form
      action={deleteClientAction}
      onSubmit={(event) => {
        if (
          !window.confirm(
            `Удалить аккаунт клиента «${clientName}»? Заказы и заявки останутся в истории продаж.`,
          )
        ) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="id" value={clientId} />
      <Button
        type="submit"
        variant="secondary"
        size="sm"
        className="w-full border-red-300 text-red-700 hover:border-red-700 hover:bg-red-700 hover:text-white"
      >
        <Trash2 className="size-3.5" aria-hidden />
        Удалить клиента
      </Button>
    </form>
  );
}
