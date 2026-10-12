"use client";

import { LoaderCircle, LockKeyhole, LockKeyholeOpen } from "lucide-react";
import { useFormStatus } from "react-dom";
import { setStaffAccountAccessAction } from "@/app/admin/staff/actions";
import { Button } from "@/components/ui/button";

function AccessSubmit({ isActive }: { isActive: boolean }) {
  const { pending } = useFormStatus();
  const Icon = pending
    ? LoaderCircle
    : isActive
      ? LockKeyhole
      : LockKeyholeOpen;
  return (
    <Button
      type="submit"
      variant="secondary"
      size="sm"
      disabled={pending}
      aria-busy={pending}
    >
      <Icon
        className={pending ? "size-4 animate-spin" : "size-4"}
        aria-hidden
      />
      {pending ? "Сохраняем..." : isActive ? "Заблокировать" : "Разблокировать"}
    </Button>
  );
}

export function StaffAccessButton({
  id,
  name,
  isActive,
}: {
  id: string;
  name: string;
  isActive: boolean;
}) {
  return (
    <form
      action={setStaffAccountAccessAction}
      onSubmit={(event) => {
        const message = isActive
          ? `Заблокировать аккаунт «${name}»? Вход и дальнейшие действия будут запрещены. Заказы и история работы сохранятся.`
          : `Восстановить доступ аккаунту «${name}»?`;
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <input
        type="hidden"
        name="isActive"
        value={isActive ? "false" : "true"}
      />
      <AccessSubmit isActive={isActive} />
    </form>
  );
}
