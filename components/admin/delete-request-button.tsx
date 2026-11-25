"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { deleteRequestAction } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

type DeleteRequestButtonProps = {
  requestId: string;
  requestNumber: string;
  returnTo: "/admin/requests" | "/admin/cutting" | "/admin/production";
  compact?: boolean;
  // «menu» — пункт в меню «⋯» строки списка.
  variant?: "button" | "menu";
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

// Подтверждение прямо на странице, а не окном браузера: окно браузер может
// заблокировать, и тогда нажатие молча пропадает.
export function DeleteRequestButton({
  requestId,
  requestNumber,
  returnTo,
  compact = false,
  variant = "button",
}: DeleteRequestButtonProps) {
  const [armed, setArmed] = useState(false);

  return (
    <form action={deleteRequestAction}>
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="confirmDeleteRequest" value="DELETE" />
      <input type="hidden" name="returnTo" value={returnTo} />
      {armed ? (
        <div
          role="alertdialog"
          aria-live="assertive"
          className="grid max-w-xs gap-2 rounded-[10px] border border-red-200 bg-red-50 p-3 text-left"
        >
          <p className="text-xs leading-5 text-red-900">
            Удалить заявку {requestNumber}? Она исчезнет из распила и
            производства, связанные заказы сохранятся. Отменить нельзя.
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
          aria-label={`Удалить заявку ${requestNumber}`}
          title={`Удалить заявку ${requestNumber}`}
          className={cn(
            "inline-flex shrink-0 items-center gap-2 font-semibold text-red-700 transition",
            variant === "menu"
              ? "h-9 w-full rounded-[8px] px-2.5 text-sm font-medium hover:bg-red-50"
              : "justify-center rounded-[var(--radius-control)] border border-red-200 hover:border-red-700 hover:bg-red-700 hover:text-white",
            variant === "button" && (compact ? "size-9" : "h-10 px-4 text-sm"),
          )}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          {compact && variant === "button" ? null : <span>Удалить…</span>}
        </button>
      )}
    </form>
  );
}
