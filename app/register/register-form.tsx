"use client";

import Link from "next/link";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { registerAction, type RegisterFormState } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: RegisterFormState = {};

type RegisterFormProps = {
  next: string;
};

export function RegisterForm({ next }: RegisterFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    registerAction,
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

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm text-[var(--foreground)]">
          Имя
          <Input
            name="firstName"
            placeholder="Ирина"
            autoComplete="given-name"
            required
          />
        </label>
        <label className="grid gap-2 text-sm text-[var(--foreground)]">
          Фамилия
          <Input
            name="lastName"
            placeholder="Кузнецова"
            autoComplete="family-name"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm text-[var(--foreground)]">
          Телефон
          <Input
            name="phone"
            type="tel"
            placeholder="+7 900 000-00-00"
            autoComplete="tel"
          />
        </label>
        <label className="grid gap-2 text-sm text-[var(--foreground)]">
          Компания / студия
          <Input
            name="companyName"
            placeholder="Studio Form"
            autoComplete="organization"
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm text-[var(--foreground)]">
        Email
        <Input
          name="email"
          type="email"
          placeholder="project@artisan.pro"
          autoComplete="email"
          required
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm text-[var(--foreground)]">
          Пароль
          <Input
            name="password"
            type="password"
            placeholder="Минимум 8 символов"
            autoComplete="new-password"
            required
          />
        </label>
        <label className="grid gap-2 text-sm text-[var(--foreground)]">
          Повторите пароль
          <Input
            name="confirmPassword"
            type="password"
            placeholder="Повторите пароль"
            autoComplete="new-password"
            required
          />
        </label>
      </div>

      {state.message ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {state.message}
        </p>
      ) : null}

      <Button type="submit" variant="accent" disabled={pending}>
        {pending ? "Создаем кабинет..." : "Создать кабинет"}
      </Button>

      <p className="text-sm text-[var(--muted)]">
        Уже есть аккаунт?{" "}
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          className="font-medium text-[var(--foreground)] transition hover:text-[var(--accent)]"
        >
          Войти
        </Link>
      </p>
    </form>
  );
}
