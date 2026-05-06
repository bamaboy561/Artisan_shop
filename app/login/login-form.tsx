"use client";

import Link from "next/link";
import { useEffect, useActionState } from "react";
import { useRouter } from "next/navigation";

import { signInAction, type LoginFormState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: LoginFormState = {};

type LoginFormProps = {
  next: string;
};

export function LoginForm({ next }: LoginFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    signInAction,
    initialState,
  );

  useEffect(() => {
    if (state.success && state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [router, state.redirectTo, state.success]);

  return (
    <form action={formAction} className="mt-6 grid gap-4">
      <input type="hidden" name="next" value={next} />
      <label className="grid gap-2 text-sm text-[var(--foreground)]">
        Email
        <Input
          name="email"
          type="email"
          placeholder="you@artisan.local"
          autoComplete="email"
          required
        />
      </label>
      <label className="grid gap-2 text-sm text-[var(--foreground)]">
        Пароль
        <Input
          name="password"
          type="password"
          placeholder="Введите пароль"
          autoComplete="current-password"
          required
        />
      </label>
      {state.message ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.message}
        </p>
      ) : null}
      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Входим..." : "Войти"}
      </Button>
      <p className="text-sm text-[var(--muted)]">
        Нет аккаунта?{" "}
        <Link
          href={`/register?next=${encodeURIComponent(next)}`}
          className="font-medium text-[var(--foreground)] transition hover:text-[var(--accent)]"
        >
          Создать личный кабинет
        </Link>
      </p>
    </form>
  );
}
