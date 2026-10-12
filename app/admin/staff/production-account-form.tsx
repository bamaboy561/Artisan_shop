"use client";

import { useActionState } from "react";
import { Factory, UserPlus } from "lucide-react";

import {
  createProductionAccountAction,
  type ProductionAccountFormState,
} from "@/app/admin/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const initialState: ProductionAccountFormState = {};

export function ProductionAccountForm() {
  const [state, formAction, pending] = useActionState(
    createProductionAccountAction,
    initialState,
  );

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
          Название аккаунта или имя
          <Input
            name="firstName"
            autoComplete="given-name"
            placeholder="Например, Станция распила"
            required
          />
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
        <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
          Производственный доступ
          <Select name="accessType" defaultValue="cutting" required>
            <option value="manager">Начальник производства</option>
            <option value="cutting">Общий аккаунт: распил</option>
            <option value="edging">Общий аккаунт: кромка</option>
            <option value="drilling">Общий аккаунт: присадка</option>
          </Select>
        </label>
        <label className="grid gap-2 text-sm font-medium text-[var(--foreground)]">
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
      </div>

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
        {pending ? (
          <Factory className="size-4" />
        ) : (
          <UserPlus className="size-4" />
        )}
        {pending ? "Создаем..." : "Создать производственный доступ"}
      </Button>
    </form>
  );
}
