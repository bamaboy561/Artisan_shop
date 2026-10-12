"use client";

import { LoaderCircle, Undo2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { rollbackLoyaltyTransactionAction } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

type RollbackLoyaltyTransactionButtonProps = {
  transactionId: string;
  points: number;
  clientName: string;
  returnQuery: string;
};

function RollbackSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      variant="secondary"
      size="sm"
      disabled={pending}
      className="w-full border-red-200 text-red-700 hover:border-red-700 hover:bg-red-700 hover:text-white"
    >
      {pending ? (
        <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Undo2 className="size-3.5" aria-hidden="true" />
      )}
      {pending ? "Откатываем" : "Откатить"}
    </Button>
  );
}

export function RollbackLoyaltyTransactionButton({
  transactionId,
  points,
  clientName,
  returnQuery,
}: RollbackLoyaltyTransactionButtonProps) {
  return (
    <form
      action={rollbackLoyaltyTransactionAction}
      onSubmit={(event) => {
        const signedPoints = `${points > 0 ? "+" : ""}${points}`;
        const confirmed = window.confirm(
          `Откатить операцию ${signedPoints} баллов у клиента «${clientName}»? В журнале появится отдельная обратная операция.`,
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }}
    >
      <input type="hidden" name="transactionId" value={transactionId} />
      <input type="hidden" name="returnQuery" value={returnQuery} />
      <input type="hidden" name="confirmRollback" value="ROLLBACK" />
      <RollbackSubmitButton />
    </form>
  );
}
