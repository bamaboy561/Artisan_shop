"use client";

import { useActionState } from "react";
import { UserPlus } from "lucide-react";

import {
  createCuttingManagerAccountAction,
  type CuttingManagerAccountFormState,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const initialState: CuttingManagerAccountFormState = {};

export function CuttingManagerForm() {
  const [state, formAction, pending] = useActionState(
    createCuttingManagerAccountAction,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
          Имя
          <Input name="firstName" autoComplete="given-name" required />
        </label>
        <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
          Фамилия
          <Input name="lastName" autoComplete="family-name" />
        </label>
        <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
          Email для входа
          <Input name="email" type="email" autoComplete="off" required />
        </label>
        <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
          Телефон
          <Input name="phone" type="tel" autoComplete="tel" />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-medium text-[var(--foreground)] md:max-w-[calc(50%-0.5rem)]">
        Временный пароль
        <Input
          name="password"
          type="password"
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          required
        />
      </label>

      {state.message ? (
        <p
          className={cn(
            "border px-4 py-3 text-sm",
            state.status === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-700",
          )}
        >
          {state.message}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="accent"
        className="justify-self-start"
        disabled={pending}
      >
        <UserPlus className="size-4" />
        {pending ? "Создаем..." : "Создать доступ"}
      </Button>
    </form>
  );
}
