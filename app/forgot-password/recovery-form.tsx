"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordRecoveryAction, resetPasswordAction, type PasswordRecoveryState } from "@/app/auth/password-recovery-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: PasswordRecoveryState = {};

export function RecoveryForm({ token }: { token?: string }) {
  const isReset = token !== undefined;
  const [state, action, pending] = useActionState(isReset ? resetPasswordAction : requestPasswordRecoveryAction, initialState);
  return (
    <form action={action} className="mt-6 grid gap-4">
      {isReset ? <>
        <input type="hidden" name="token" value={token} />
        <label className="grid gap-2 text-sm">Новый пароль
          <Input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required disabled={pending || state.success} />
        </label>
        <label className="grid gap-2 text-sm">Повторите пароль
          <Input name="confirmPassword" type="password" autoComplete="new-password" minLength={8} maxLength={128} required disabled={pending || state.success} />
        </label>
      </> : <label className="grid gap-2 text-sm">Email
        <Input name="email" type="email" autoComplete="email" maxLength={254} required disabled={pending} />
      </label>}
      {state.message ? <p role="status" aria-live="polite" className={`rounded-lg border px-4 py-3 text-sm ${state.success ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{state.message}</p> : null}
      {!(isReset && state.success) ? <Button type="submit" variant="accent" disabled={pending}>{pending ? "Подождите..." : isReset ? "Сохранить пароль" : "Отправить ссылку"}</Button> : null}
      <Link href="/login" className="text-sm font-medium hover:text-[var(--accent)]">Вернуться ко входу</Link>
      {isReset && !state.success ? <Link href="/forgot-password" className="text-sm text-[var(--muted)]">Запросить новую ссылку</Link> : null}
    </form>
  );
}
