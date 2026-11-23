"use client";

import { deleteStaffAccountAction } from "@/app/admin/staff/actions";
import { ConfirmDeleteButton } from "@/components/admin/confirm-delete-button";

// Подтверждение прямо на странице: окно браузера (window.confirm) может быть
// заблокировано, и тогда нажатие молча ничего бы не делало.
export function DeleteStaffButton({ id, name }: { id: string; name: string }) {
  return (
    <form action={deleteStaffAccountAction}>
      <input type="hidden" name="id" value={id} />
      <ConfirmDeleteButton
        confirmMessage={`Удалить «${name}»? Вход будет закрыт навсегда, а заказы, заявки и смены останутся в истории.`}
        className="inline-flex h-8 items-center justify-center gap-1.5 border border-red-300 px-3 text-xs font-semibold text-red-700 transition hover:border-red-700 hover:bg-red-700 hover:text-white"
      >
        Удалить сотрудника
      </ConfirmDeleteButton>
    </form>
  );
}
