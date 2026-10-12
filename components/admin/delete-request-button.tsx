"use client";

import { LoaderCircle, Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { deleteRequestAction } from "@/app/admin/actions";
import { cn } from "@/lib/utils";

type DeleteRequestButtonProps = {
  requestId: string;
  requestNumber: string;
  returnTo: "/admin/requests" | "/admin/cutting" | "/admin/production";
  compact?: boolean;
};

function DeleteRequestSubmitButton({
  requestNumber,
  compact,
}: Pick<DeleteRequestButtonProps, "requestNumber" | "compact">) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={`Удалить заявку ${requestNumber}`}
      title={`Удалить заявку ${requestNumber}`}
      className={cn(
        "inline-flex shrink-0 items-center justify-center gap-2 border border-red-200 font-semibold text-red-700 transition hover:border-red-700 hover:bg-red-700 hover:text-white disabled:cursor-wait disabled:opacity-60",
        compact ? "size-9" : "h-10 px-4 text-xs tracking-[0.08em] uppercase",
      )}
    >
      {pending ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <Trash2 className="size-4" aria-hidden="true" />
      )}
      {compact ? null : <span>{pending ? "Удаляем..." : "Удалить"}</span>}
    </button>
  );
}

export function DeleteRequestButton({
  requestId,
  requestNumber,
  returnTo,
  compact = false,
}: DeleteRequestButtonProps) {
  return (
    <form
      action={deleteRequestAction}
      onSubmit={(event) => {
        const confirmed = window.confirm(
          `Удалить заявку ${requestNumber}? Она исчезнет из распила и производства. Связанные заказы сохранятся. Это действие нельзя отменить.`,
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="requestId" value={requestId} />
      <input type="hidden" name="confirmDeleteRequest" value="DELETE" />
      <input type="hidden" name="returnTo" value={returnTo} />
      <DeleteRequestSubmitButton
        requestNumber={requestNumber}
        compact={compact}
      />
    </form>
  );
}
